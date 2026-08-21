import { describe, expect, it } from 'vitest';
import { shouldCommitTriviaScoreOnSubmit, shouldRevealTriviaQuestion, TRIVIA_REVEAL_DURATION_MS } from './triviaEngine';

describe('trivia round completion', () => {
  it('reveals as soon as every active player has answered', () => {
    expect(shouldRevealTriviaQuestion(1, 2)).toBe(false);
    expect(shouldRevealTriviaQuestion(2, 2)).toBe(true);
  });

  it('does not reveal an empty room', () => {
    expect(shouldRevealTriviaQuestion(0, 0)).toBe(false);
  });

  it('keeps the answer reveal visible for seven seconds', () => {
    expect(TRIVIA_REVEAL_DURATION_MS).toBe(7_000);
  });

  it('defers scores for new rounds while preserving legacy round behavior', () => {
    expect(shouldCommitTriviaScoreOnSubmit('on_reveal')).toBe(false);
    expect(shouldCommitTriviaScoreOnSubmit('on_submit')).toBe(true);
    expect(shouldCommitTriviaScoreOnSubmit(undefined)).toBe(true);
  });
});
