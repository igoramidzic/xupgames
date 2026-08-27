import { describe, expect, it } from 'vitest';
import {
  type GeneratedPromptArcadeArtifact,
  normalizePromptArcadePrompt,
  PROMPT_ARCADE_COUNTDOWN_MS,
  PROMPT_ARCADE_CREATOR_BONUS_POINTS,
  PROMPT_ARCADE_MAX_PLAYERS,
  PROMPT_ARCADE_MAX_PROMPT_CHARACTERS,
  PROMPT_ARCADE_RATING_MS,
  parseGeneratedArtifact,
  scorePromptArcadeResult,
  validateGeneratedArtifact,
  validateGeneratedJavaScript,
} from './engine';

function artifact(code: string): GeneratedPromptArcadeArtifact {
  return {
    title: 'Circle Sprint',
    interpretation: 'Draw the closest possible circle.',
    instructions: 'Draw one circle, then release the pointer.',
    durationMs: 20_000,
    scoringMode: 'qualityAndSpeed',
    code,
  };
}

const VALID_CODE = `window.registerPromptArcadeGame({
  mount(root, api) {
    const button = document.createElement('button');
    button.textContent = 'Finish';
    button.addEventListener('click', () => api.finish({ quality: 1, metricLabel: 'Roundness', metricValue: 100 }));
    root.append(button);
    return () => button.remove();
  }
});`;

describe('Prompt Arcade engine', () => {
  it('leaves eight seconds for the introduction and five seconds for peer ratings', () => {
    expect(PROMPT_ARCADE_COUNTDOWN_MS).toBe(8_000);
    expect(PROMPT_ARCADE_RATING_MS).toBe(5_000);
    expect(PROMPT_ARCADE_CREATOR_BONUS_POINTS).toBe(500);
  });

  it('scores every standardized mode and clamps client-controlled values', () => {
    expect(scorePromptArcadeResult('speed', 0.2, 0, 20_000).score).toBe(1_000);
    expect(scorePromptArcadeResult('speed', 1, 10_000, 20_000).score).toBe(500);
    expect(scorePromptArcadeResult('quality', 2, 20_000, 20_000)).toMatchObject({ quality: 1, score: 1_000 });
    expect(scorePromptArcadeResult('quality', -1, -5_000, 20_000)).toMatchObject({
      quality: 0,
      elapsedMs: 0,
      score: 0,
    });
    expect(scorePromptArcadeResult('qualityAndSpeed', 1, 10_000, 20_000).score).toBe(875);
    expect(scorePromptArcadeResult('speed', 1, Number.POSITIVE_INFINITY, 20_000)).toMatchObject({
      elapsedMs: 20_000,
      score: 0,
    });
  });

  it('accepts the runtime contract and rejects dangerous capabilities', () => {
    expect(validateGeneratedArtifact(artifact(VALID_CODE))).toEqual([]);
    const rejectedSnippets = [
      'fetch("https://example.com")',
      'localStorage.setItem("score", "1")',
      'eval("2 + 2")',
      'new Function("return 1")()',
      'location.href = "https://example.com"',
      'document.location = "https://example.com"',
      'window["location"] = "https://example.com"',
      'open("https://example.com")',
      'window["open"]("https://example.com")',
      'while (true) {}',
      'for (;;) {}',
    ];
    for (const snippet of rejectedSnippets) {
      expect(validateGeneratedArtifact(artifact(`${VALID_CODE}\n${snippet}`))).not.toEqual([]);
    }
  });

  it('requires exactly one executable game registration and a strict structured artifact', () => {
    expect(validateGeneratedJavaScript('const score = 1;')).toContain(
      'code must call window.registerPromptArcadeGame(...) exactly once as executable JavaScript.'
    );
    expect(validateGeneratedJavaScript(`${VALID_CODE}\n${VALID_CODE}`)).toContain(
      'code must call window.registerPromptArcadeGame(...) exactly once as executable JavaScript.'
    );
    expect(validateGeneratedJavaScript(VALID_CODE)).toEqual([]);
    expect(parseGeneratedArtifact({ ...artifact(VALID_CODE) })).toEqual({
      artifact: artifact(VALID_CODE),
      errors: [],
    });
    expect(parseGeneratedArtifact({ ...artifact(VALID_CODE), durationMs: 1_000 }).errors).toContain(
      'durationMs must be between 8000 and 45000.'
    );
  });

  it('rejects malformed JavaScript and ignores registration text in strings and comments', () => {
    expect(validateGeneratedJavaScript('window.registerPromptArcadeGame({ mount(root, api) {')).toEqual([
      expect.stringMatching(/^code must be valid classic-script JavaScript/),
    ]);
    const falsePositives = `
      // window.registerPromptArcadeGame({ mount() {} });
      const example = "window.registerPromptArcadeGame({ mount() {} })";
    `;
    expect(validateGeneratedJavaScript(falsePositives)).toContain(
      'code must call window.registerPromptArcadeGame(...) exactly once as executable JavaScript.'
    );
    expect(validateGeneratedJavaScript(`${falsePositives}\n${VALID_CODE}`)).toEqual([]);
  });

  it('requires the executable registration to expose a top-level mount function', () => {
    expect(validateGeneratedJavaScript('window.registerPromptArcadeGame({});')).toContain(
      'code must register a top-level game object with a mount(root, api) function.'
    );
    expect(validateGeneratedJavaScript(`if (false) { ${VALID_CODE} }`)).toContain(
      'code must register a top-level game object with a mount(root, api) function.'
    );
    expect(validateGeneratedJavaScript("window['registerPromptArcadeGame']({ mount() {} });")).toContain(
      'code must call window.registerPromptArcadeGame(...) exactly once as executable JavaScript.'
    );
  });

  it('normalizes player prompts with only a sensible length and control-character bound', () => {
    expect(PROMPT_ARCADE_MAX_PLAYERS).toBe(30);
    expect(normalizePromptArcadePrompt('  first to draw a perfect circle  ')).toBe('first to draw a perfect circle');
    expect(normalizePromptArcadePrompt('line one\nline two')).toBe('line one\nline two');
    expect(() => normalizePromptArcadePrompt('')).toThrow(/1–1000/);
    expect(() => normalizePromptArcadePrompt('a'.repeat(PROMPT_ARCADE_MAX_PROMPT_CHARACTERS + 1))).toThrow(/1–1000/);
    expect(() => normalizePromptArcadePrompt('hello\u0000world')).toThrow(/1–1000/);
  });
});
