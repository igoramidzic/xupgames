import { describe, expect, it } from 'vitest';
import {
  createDoodleDashHintOrder,
  doodleDashEditDistance,
  doodleDashRevealedLetterCount,
  doodleDashWordLengths,
  estimateDoodleDashMinutes,
  isCloseDoodleDashGuess,
  latestActiveDoodleDashStroke,
  maskDoodleDashWord,
  nextRedoDoodleDashStroke,
  normalizeDoodleDashGuessForComparison,
  normalizeDoodleDashGuessText,
} from './doodleDashEngine';

describe('Doodle Dash secret word hints', () => {
  it('masks every letter while preserving spaces and punctuation', () => {
    expect(maskDoodleDashWord('ice cream', [0, 4, 1, 5, 2, 6, 7, 8], 2)).toBe('I _ _   C _ _ _ _');
    expect(doodleDashWordLengths('ice cream')).toEqual([3, 5]);
  });

  it('reveals no more than three letters at quarter intervals', () => {
    expect(doodleDashRevealedLetterCount(1_000, 41_000, 10_999, 8)).toBe(0);
    expect(doodleDashRevealedLetterCount(1_000, 41_000, 11_000, 8)).toBe(1);
    expect(doodleDashRevealedLetterCount(1_000, 41_000, 31_000, 8)).toBe(3);
  });

  it('creates a stable permutation of drawable character positions', () => {
    expect(createDoodleDashHintOrder('hot dog', () => 0)).toEqual(expect.arrayContaining([0, 1, 2, 4, 5, 6]));
    expect(createDoodleDashHintOrder('hot dog', () => 0)).toHaveLength(6);
  });
});

describe('Doodle Dash guesses', () => {
  it('compares words without spacing, punctuation, case, or accents', () => {
    expect(normalizeDoodleDashGuessForComparison('  ICE-Crème! ')).toBe('icecreme');
  });

  it('keeps safe public guess copy and rejects invalid messages', () => {
    expect(normalizeDoodleDashGuessText('  a   snowman  ')).toBe('a snowman');
    expect(() => normalizeDoodleDashGuessText('')).toThrow('INVALID_GUESS');
    expect(() => normalizeDoodleDashGuessText(`hi${String.fromCharCode(7)}`)).toThrow('INVALID_GUESS');
  });

  it('marks small misspellings close without treating the answer itself as close', () => {
    expect(doodleDashEditDistance('giraffe', 'girafe')).toBe(1);
    expect(isCloseDoodleDashGuess('girafe', 'giraffe')).toBe(true);
    expect(isCloseDoodleDashGuess('buterfly', 'butterfly')).toBe(true);
    expect(isCloseDoodleDashGuess('giraffe', 'giraffe')).toBe(false);
    expect(isCloseDoodleDashGuess('horse', 'giraffe')).toBe(false);
  });
});

describe('Doodle Dash lobby estimate', () => {
  it('scales with the live player count, rounds, and drawing duration', () => {
    expect(estimateDoodleDashMinutes(2, 2, 45_000)).toBe(4);
    expect(estimateDoodleDashMinutes(4, 2, 45_000)).toBe(8);
    expect(estimateDoodleDashMinutes(4, 1, 30_000)).toBe(3);
  });
});

describe('Doodle Dash drawing history', () => {
  const strokes = [{ sequence: 1 }, { sequence: 2, isUndone: true }, { sequence: 3, isUndone: true }];

  it('targets the latest active action for undo', () => {
    expect(latestActiveDoodleDashStroke(strokes)?.sequence).toBe(1);
  });

  it('targets the oldest undone action for redo', () => {
    expect(nextRedoDoodleDashStroke(strokes)?.sequence).toBe(2);
  });
});
