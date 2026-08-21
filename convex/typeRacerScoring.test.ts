import { describe, expect, it } from 'vitest';
import {
  type ComparableTypeRacerProgress,
  calculateTypeRacerAccuracy,
  calculateTypeRacerWpm,
  compareTypeRacerProgress,
} from './typeRacerScoring';

function progress(overrides: Partial<ComparableTypeRacerProgress> = {}): ComparableTypeRacerProgress {
  return {
    status: 'racing',
    finishedAt: null,
    correctChars: 20,
    wpm: 40,
    accuracy: 98,
    updatedAt: 1,
    ...overrides,
  };
}

describe('type racer scoring', () => {
  it('uses standard five-character words per minute', () => {
    expect(calculateTypeRacerWpm(300, 60_000)).toBe(60);
    expect(calculateTypeRacerWpm(0, 60_000)).toBe(0);
  });

  it('tracks accuracy from attempted character keys', () => {
    expect(calculateTypeRacerAccuracy(100, 3)).toBe(97);
    expect(calculateTypeRacerAccuracy(0, 0)).toBe(100);
  });

  it('puts finishers first, then ranks unfinished racers by progress and speed', () => {
    const field = [
      progress({ correctChars: 80, wpm: 100 }),
      progress({ status: 'finished', finishedAt: 2_000, correctChars: 100, wpm: 70 }),
      progress({ correctChars: 80, wpm: 110 }),
      progress({ status: 'finished', finishedAt: 1_500, correctChars: 100, wpm: 75 }),
    ];
    field.sort(compareTypeRacerProgress);
    expect(field.map((entry) => entry.finishedAt ?? entry.wpm)).toEqual([1_500, 2_000, 110, 100]);
  });
});
