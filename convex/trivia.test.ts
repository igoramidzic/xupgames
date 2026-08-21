import { describe, expect, it } from 'vitest';
import { calculateTriviaPoints, TRIVIA_ANSWER_DURATION_MS } from './triviaScoring';

describe('trivia scoring', () => {
  it('awards more points for faster correct answers', () => {
    expect(calculateTriviaPoints(0)).toBe(1_000);
    expect(calculateTriviaPoints(TRIVIA_ANSWER_DURATION_MS / 2)).toBe(750);
    expect(calculateTriviaPoints(TRIVIA_ANSWER_DURATION_MS)).toBe(500);
  });

  it('clamps response times to the scoring window', () => {
    expect(calculateTriviaPoints(-1_000)).toBe(1_000);
    expect(calculateTriviaPoints(TRIVIA_ANSWER_DURATION_MS + 1_000)).toBe(500);
  });
});
