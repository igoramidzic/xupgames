import { parse } from 'acorn';

export const PROMPT_ARCADE_MAX_PLAYERS = 30;
export const PROMPT_ARCADE_MAX_PROMPT_CHARACTERS = 1_000;
export const PROMPT_ARCADE_MIN_DURATION_MS = 8_000;
export const PROMPT_ARCADE_MAX_DURATION_MS = 45_000;
export const PROMPT_ARCADE_MAX_CODE_BYTES = 60_000;
export const PROMPT_ARCADE_COUNTDOWN_MS = 8_000;
export const PROMPT_ARCADE_RESULTS_MS = 10_000;
export const PROMPT_ARCADE_STALE_GENERATION_MS = 120_000;
export const PROMPT_ARCADE_ARTIFACT_GRACE_MS = 60 * 60 * 1_000;

export type PromptArcadeScoringMode = 'speed' | 'quality' | 'qualityAndSpeed';

export type GeneratedPromptArcadeArtifact = {
  title: string;
  interpretation: string;
  instructions: string;
  durationMs: number;
  scoringMode: PromptArcadeScoringMode;
  code: string;
};

const BANNED_CODE_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /```/, label: 'Markdown code fences' },
  { pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(/, label: 'network APIs' },
  { pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/, label: 'browser storage' },
  { pattern: /document\s*\.\s*(?:cookie|write)\b/, label: 'document-wide writes' },
  { pattern: /\b(?:eval|Function)\s*\(/, label: 'dynamic code evaluation' },
  { pattern: /\bnew\s+Function\b/, label: 'dynamic code evaluation' },
  { pattern: /\bimport\s*(?:\(|[{'"*])/, label: 'imports' },
  {
    pattern: /\b(?:window|globalThis|self|document)\s*\.\s*(?:parent|top|opener|location|open)\b/,
    label: 'navigation',
  },
  {
    pattern: /\b(?:window|globalThis|self|document)\s*\[\s*['"](?:parent|top|opener|location|open)['"]\s*\]/,
    label: 'navigation',
  },
  { pattern: /\blocation\b/, label: 'navigation' },
  { pattern: /(?:^|[^\w$.])open\s*\(/m, label: 'navigation' },
  { pattern: /\bpostMessage\s*\(/, label: 'cross-frame messaging' },
  { pattern: /<\s*form\b|\.\s*submit\s*\(/, label: 'form submission' },
  { pattern: /\.\s*innerHTML\s*=/, label: 'HTML string injection' },
  { pattern: /\bwhile\s*\(\s*(?:true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/, label: 'obvious infinite loops' },
];

function isScoringMode(value: unknown): value is PromptArcadeScoringMode {
  return value === 'speed' || value === 'quality' || value === 'qualityAndSpeed';
}

export function normalizePromptArcadePrompt(prompt: string): string {
  const normalized = prompt.normalize('NFKC').trim();
  const characters = Array.from(normalized);
  const hasInvalidControlCharacter = characters.some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127) && character !== '\n' && character !== '\t';
  });
  if (characters.length < 1 || characters.length > PROMPT_ARCADE_MAX_PROMPT_CHARACTERS || hasInvalidControlCharacter) {
    throw new Error(`Describe a game using 1–${PROMPT_ARCADE_MAX_PROMPT_CHARACTERS} visible characters.`);
  }
  return normalized;
}

function stringField(value: unknown, field: string, maxCharacters: number, errors: string[]): string {
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string.`);
    return '';
  }
  const normalized = value.normalize('NFKC').trim();
  const length = Array.from(normalized).length;
  if (length < 1 || length > maxCharacters) {
    errors.push(`${field} must contain 1–${maxCharacters} characters.`);
  }
  return normalized;
}

export function parseGeneratedArtifact(value: unknown): {
  artifact: GeneratedPromptArcadeArtifact | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { artifact: null, errors: ['The model response must be a JSON object.'] };
  }
  const record = value as Record<string, unknown>;
  const title = stringField(record.title, 'title', 80, errors);
  const interpretation = stringField(record.interpretation, 'interpretation', 600, errors);
  const instructions = stringField(record.instructions, 'instructions', 700, errors);
  const code = stringField(record.code, 'code', PROMPT_ARCADE_MAX_CODE_BYTES, errors);
  if (!Number.isInteger(record.durationMs)) {
    errors.push('durationMs must be an integer.');
  }
  const durationMs = typeof record.durationMs === 'number' ? record.durationMs : 0;
  if (durationMs < PROMPT_ARCADE_MIN_DURATION_MS || durationMs > PROMPT_ARCADE_MAX_DURATION_MS) {
    errors.push(`durationMs must be between ${PROMPT_ARCADE_MIN_DURATION_MS} and ${PROMPT_ARCADE_MAX_DURATION_MS}.`);
  }
  if (!isScoringMode(record.scoringMode)) {
    errors.push('scoringMode must be speed, quality, or qualityAndSpeed.');
  }
  if (errors.length > 0 || !isScoringMode(record.scoringMode)) return { artifact: null, errors };
  const artifact = { title, interpretation, instructions, durationMs, scoringMode: record.scoringMode, code };
  return { artifact, errors: validateGeneratedArtifact(artifact) };
}

export function validateGeneratedArtifact(artifact: GeneratedPromptArcadeArtifact): string[] {
  const errors: string[] = [];
  const byteLength = new TextEncoder().encode(artifact.code).byteLength;
  if (byteLength > PROMPT_ARCADE_MAX_CODE_BYTES) {
    errors.push(`code must be at most ${PROMPT_ARCADE_MAX_CODE_BYTES} UTF-8 bytes.`);
  }
  for (const banned of BANNED_CODE_PATTERNS) {
    if (banned.pattern.test(artifact.code)) errors.push(`code may not use ${banned.label}.`);
  }
  return errors;
}

type AstNode = { type: string; [key: string]: unknown };

function isAstNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
}

function visitAst(value: unknown, visitor: (node: AstNode) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visitAst(item, visitor);
    return;
  }
  if (!isAstNode(value)) return;
  visitor(value);
  for (const [key, child] of Object.entries(value)) {
    if (key === 'start' || key === 'end' || key === 'loc') continue;
    visitAst(child, visitor);
  }
}

function isPromptArcadeRegistrationCall(node: AstNode): boolean {
  if (node.type !== 'CallExpression' || !isAstNode(node.callee) || node.callee.type !== 'MemberExpression') {
    return false;
  }
  if (node.callee.computed !== false || !isAstNode(node.callee.object) || !isAstNode(node.callee.property)) {
    return false;
  }
  return (
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'window' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'registerPromptArcadeGame'
  );
}

function hasMountFunctionArgument(node: AstNode): boolean {
  if (!Array.isArray(node.arguments) || node.arguments.length !== 1) return false;
  const definition = node.arguments[0];
  if (!isAstNode(definition) || definition.type !== 'ObjectExpression' || !Array.isArray(definition.properties)) {
    return false;
  }
  return definition.properties.some((property) => {
    if (!isAstNode(property) || property.type !== 'Property' || property.computed !== false) return false;
    const key = property.key;
    const isMountKey =
      isAstNode(key) &&
      ((key.type === 'Identifier' && key.name === 'mount') || (key.type === 'Literal' && key.value === 'mount'));
    return (
      isMountKey &&
      isAstNode(property.value) &&
      (property.value.type === 'FunctionExpression' || property.value.type === 'ArrowFunctionExpression')
    );
  });
}

function isTopLevelRegistrationStatement(node: unknown): boolean {
  return (
    isAstNode(node) &&
    node.type === 'ExpressionStatement' &&
    isAstNode(node.expression) &&
    isPromptArcadeRegistrationCall(node.expression) &&
    hasMountFunctionArgument(node.expression)
  );
}

/** Parses only; generated code is never evaluated by backend validation. */
export function validateGeneratedJavaScript(code: string): string[] {
  let program: unknown;
  try {
    program = parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch (error) {
    return [
      `code must be valid classic-script JavaScript${
        error instanceof SyntaxError && error.message.length > 0 ? `: ${error.message}` : '.'
      }`,
    ];
  }
  let registrationCount = 0;
  visitAst(program, (node) => {
    if (isPromptArcadeRegistrationCall(node)) registrationCount += 1;
  });
  if (registrationCount !== 1) {
    return ['code must call window.registerPromptArcadeGame(...) exactly once as executable JavaScript.'];
  }
  const topLevelRegistrations =
    isAstNode(program) && program.type === 'Program' && Array.isArray(program.body)
      ? program.body.filter(isTopLevelRegistrationStatement).length
      : 0;
  return topLevelRegistrations === 1
    ? []
    : ['code must register a top-level game object with a mount(root, api) function.'];
}

export function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function scorePromptArcadeResult(
  scoringMode: PromptArcadeScoringMode,
  qualityInput: number,
  elapsedMsInput: number,
  durationMs: number
): { quality: number; elapsedMs: number; speed: number; score: number } {
  const quality = clampUnitInterval(qualityInput);
  const safeDurationMs = Math.max(1, durationMs);
  const elapsedMs = Math.max(
    0,
    Math.min(safeDurationMs, Number.isFinite(elapsedMsInput) ? elapsedMsInput : safeDurationMs)
  );
  const speed = clampUnitInterval(1 - elapsedMs / safeDurationMs);
  const rawScore =
    scoringMode === 'speed' ? speed * 1_000 : scoringMode === 'quality' ? quality * 1_000 : quality * 750 + speed * 250;
  return { quality, elapsedMs: Math.round(elapsedMs), speed, score: Math.round(rawScore) };
}

export function normalizeMetricLabel(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = value.normalize('NFKC').trim();
  return normalized.length === 0 ? null : Array.from(normalized).slice(0, 80).join('');
}

export function normalizeMetricValue(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.max(-1_000_000_000, Math.min(1_000_000_000, value));
}
