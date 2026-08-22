import type { Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

export const DOODLE_DASH_CHOICE_DURATION_MS = 8_000;
export const DOODLE_DASH_REVEAL_DURATION_MS = 5_000;
export const DOODLE_DASH_FINAL_COUNTDOWN_MS = 12_000;
export const DOODLE_DASH_MAX_STROKES = 750;
export const DOODLE_DASH_MAX_STROKE_POINTS = 128;
export const DOODLE_DASH_MAX_MESSAGES_PER_MEMBER = 40;
export const DOODLE_DASH_MAX_VISIBLE_MESSAGES = 200;
export const DOODLE_DASH_COLORS = [
  '#142747',
  '#3155d9',
  '#1596d2',
  '#13a8a8',
  '#16856b',
  '#f1b91c',
  '#f28c28',
  '#ef5b50',
  '#d93c91',
  '#7c4dcc',
  '#8a5a3b',
  '#ffffff',
] as const;

export function latestActiveDoodleDashStroke<T extends { isUndone?: boolean }>(strokes: readonly T[]): T | undefined {
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (stroke !== undefined && stroke.isUndone !== true) return stroke;
  }
  return undefined;
}

export function nextRedoDoodleDashStroke<T extends { isUndone?: boolean }>(strokes: readonly T[]): T | undefined {
  return strokes.find((stroke) => stroke.isUndone === true);
}

export function estimateDoodleDashMinutes(
  participantCount: number,
  roundCount: number,
  drawDurationMs: number
): number {
  const players = Math.max(1, Math.floor(participantCount));
  const rounds = Math.max(1, Math.floor(roundCount));
  const turnDurationMs = DOODLE_DASH_CHOICE_DURATION_MS + drawDurationMs + DOODLE_DASH_REVEAL_DURATION_MS;
  return Math.max(1, Math.ceil((players * rounds * turnDurationMs) / 60_000));
}

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export async function findDoodleDashGameState(ctx: DatabaseReaderContext, roomId: Id<'rooms'>) {
  return await ctx.db
    .query('doodleDashGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

export async function findDoodleDashRound(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  gameNumber: number,
  turnNumber: number
) {
  return await ctx.db
    .query('doodleDashRounds')
    .withIndex('by_roomId_and_gameNumber_and_turnNumber', (index) =>
      index.eq('roomId', roomId).eq('gameNumber', gameNumber).eq('turnNumber', turnNumber)
    )
    .unique();
}

function letterPositions(word: string): number[] {
  return Array.from(word)
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => /[\p{L}\p{N}]/u.test(character))
    .map(({ index }) => index);
}

export function createDoodleDashHintOrder(word: string, random: () => number = Math.random): number[] {
  const positions = letterPositions(word);
  for (let index = positions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
  }
  return positions;
}

export function doodleDashRevealedLetterCount(
  drawStartedAt: number | null,
  drawEndsAt: number | null,
  now: number,
  letterCount: number
): number {
  if (drawStartedAt === null || drawEndsAt === null || letterCount <= 1) {
    return 0;
  }
  const duration = Math.max(1, drawEndsAt - drawStartedAt);
  const progress = Math.min(1, Math.max(0, (now - drawStartedAt) / duration));
  return Math.min(letterCount - 1, 3, Math.floor(progress * 4));
}

export function maskDoodleDashWord(word: string, hintOrder: readonly number[], revealCount: number): string {
  const revealed = new Set(hintOrder.slice(0, revealCount));
  return Array.from(word)
    .map((character, index) => {
      if (!/[\p{L}\p{N}]/u.test(character)) {
        return character;
      }
      return revealed.has(index) ? character.toUpperCase() : '_';
    })
    .join(' ');
}

export function doodleDashWordLengths(word: string): number[] {
  return word
    .trim()
    .split(/\s+/u)
    .map((part) => Array.from(part).filter((character) => /[\p{L}\p{N}]/u.test(character)).length)
    .filter((length) => length > 0);
}

export function normalizeDoodleDashGuessText(rawGuess: string): string {
  const normalized = rawGuess.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  const characters = Array.from(normalized);
  const hasControlCharacter = characters.some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
  if (characters.length < 1 || characters.length > 80 || hasControlCharacter) {
    throw new Error('INVALID_GUESS');
  }
  return normalized;
}

export function normalizeDoodleDashGuessForComparison(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function doodleDashEditDistance(left: string, right: string): number {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  const previous = rightCharacters.map((_, index) => index + 1);
  previous.unshift(0);

  for (let leftIndex = 1; leftIndex <= leftCharacters.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= rightCharacters.length; rightIndex += 1) {
      const substitutionCost = leftCharacters[leftIndex - 1] === rightCharacters[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[rightCharacters.length] ?? leftCharacters.length;
}

export function isCloseDoodleDashGuess(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeDoodleDashGuessForComparison(guess);
  const normalizedAnswer = normalizeDoodleDashGuessForComparison(answer);
  if (normalizedGuess === normalizedAnswer || normalizedAnswer.length < 4) {
    return false;
  }
  const allowedDistance = normalizedAnswer.length >= 8 ? 2 : 1;
  return doodleDashEditDistance(normalizedGuess, normalizedAnswer) <= allowedDistance;
}
