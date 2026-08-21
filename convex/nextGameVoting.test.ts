import { describe, expect, it } from 'vitest';
import { resolveVotingRound } from './nextGameVoting';

describe('resolveVotingRound', () => {
  it('accepts exactly two thirds as a supermajority', () => {
    expect(resolveVotingRound(['drawing', 'trivia', 'typeRacer'], ['trivia', 'trivia', 'drawing'], 1)).toEqual({
      kind: 'awaitingOwner',
      recommendation: 'trivia',
    });
  });

  it('opens a runoff when round one has no supermajority', () => {
    expect(
      resolveVotingRound(['drawing', 'trivia', 'typeRacer'], ['drawing', 'drawing', 'trivia', 'typeRacer'], 1)
    ).toEqual({ kind: 'runoff', finalists: ['drawing', 'trivia', 'typeRacer'] });
  });

  it('keeps tied second-place choices in the runoff', () => {
    expect(
      resolveVotingRound(
        ['drawing', 'trivia', 'typeRacer'],
        ['drawing', 'drawing', 'drawing', 'trivia', 'trivia', 'typeRacer', 'typeRacer'],
        1
      )
    ).toEqual({ kind: 'runoff', finalists: ['drawing', 'trivia', 'typeRacer'] });
  });

  it('does not recommend a game when the runoff is tied', () => {
    expect(resolveVotingRound(['drawing', 'typeRacer'], ['drawing', 'typeRacer'], 2)).toEqual({
      kind: 'awaitingOwner',
      recommendation: null,
    });
  });
});
