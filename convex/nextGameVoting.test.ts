import { describe, expect, it } from 'vitest';
import { resolveVotingRound } from './nextGameVoting';

describe('resolveVotingRound', () => {
  it('accepts exactly two thirds as a supermajority', () => {
    expect(resolveVotingRound(['trivia', 'typeRacer'], ['trivia', 'trivia', 'typeRacer'], 1)).toEqual({
      kind: 'awaitingOwner',
      recommendation: 'trivia',
    });
  });

  it('opens a runoff when round one has no supermajority', () => {
    expect(resolveVotingRound(['trivia', 'typeRacer'], ['trivia', 'typeRacer'], 1)).toEqual({
      kind: 'runoff',
      finalists: ['trivia', 'typeRacer'],
    });
  });

  it('uses canonical game order when both choices advance', () => {
    expect(resolveVotingRound(['typeRacer', 'trivia'], ['trivia', 'typeRacer'], 1)).toEqual({
      kind: 'runoff',
      finalists: ['trivia', 'typeRacer'],
    });
  });

  it('does not recommend a game when the runoff is tied', () => {
    expect(resolveVotingRound(['trivia', 'typeRacer'], ['trivia', 'typeRacer'], 2)).toEqual({
      kind: 'awaitingOwner',
      recommendation: null,
    });
  });
});
