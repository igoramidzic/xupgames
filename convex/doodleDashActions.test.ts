import { describe, expect, it, vi } from 'vitest';
import { recordDoodleDashCorrectGuess } from './doodleDash';

function indexedResult<T>(result: (values: Record<string, unknown>) => T) {
  return (_name: string, configure: (index: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
    const values: Record<string, unknown> = {};
    const index = {
      eq(field: string, value: unknown) {
        values[field] = value;
        return index;
      },
    };
    configure(index);
    return { unique: vi.fn(async () => result(values)) };
  };
}

describe('Doodle Dash authoritative bot actions', () => {
  it('records a correct bot guess through normal scoring and countdown rules', async () => {
    const room = { _id: 'room-1' };
    const state = {
      _id: 'state-1',
      roomId: 'room-1',
      gameNumber: 2,
      phase: 'drawing',
      currentRoundId: 'round-1',
      turnOrder: ['drawer-1', 'bot-member-1', 'human-2'],
      configuredDrawDurationMs: 45_000,
      phaseEndsAt: 145_000,
    };
    const round = {
      _id: 'round-1',
      roomId: 'room-1',
      gameNumber: 2,
      turnNumber: 1,
      status: 'drawing',
      drawerMemberId: 'drawer-1',
      selectedWord: 'giraffe',
      drawStartedAt: 100_000,
      drawEndsAt: 145_000,
      correctGuessCount: 0,
      firstCorrectAt: null,
    };
    const membership = {
      _id: 'bot-member-1',
      roomId: 'room-1',
      displayName: 'Bot 01',
      isActive: true,
    };
    const guesserScore = {
      _id: 'score-bot',
      memberId: 'bot-member-1',
      displayName: 'Bot 01',
      totalPoints: 0,
      guessPoints: 0,
      wordsGuessed: 0,
    };
    const drawerScore = {
      _id: 'score-drawer',
      memberId: 'drawer-1',
      totalPoints: 0,
      drawPoints: 0,
      correctGuessers: 0,
    };
    const insert = vi.fn(async () => 'inserted-id');
    const patch = vi.fn(async () => null);
    const runAfter = vi.fn(async () => 'scheduled-id');
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === 'doodleDashScores') {
            return {
              withIndex: indexedResult((values) => (values.memberId === 'bot-member-1' ? guesserScore : drawerScore)),
            };
          }
          if (table === 'doodleDashCorrectGuesses') {
            return { withIndex: indexedResult(() => null) };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        get: vi.fn(async (table: string, id: string) => (table === 'roomMembers' ? { _id: id, isActive: true } : null)),
        insert,
        patch,
      },
      scheduler: { runAfter },
    };

    const result = await recordDoodleDashCorrectGuess(
      ctx as never,
      room as never,
      state as never,
      round as never,
      membership as never,
      105_000
    );

    expect(result).toEqual({ kind: 'accepted', pointsAwarded: expect.any(Number) });
    expect(insert).toHaveBeenCalledWith(
      'doodleDashCorrectGuesses',
      expect.objectContaining({ memberId: 'bot-member-1', roundId: 'round-1' })
    );
    expect(insert).toHaveBeenCalledWith(
      'doodleDashMessages',
      expect.objectContaining({ memberId: 'bot-member-1', kind: 'correct' })
    );
    expect(patch).toHaveBeenCalledWith('doodleDashScores', 'score-bot', expect.objectContaining({ wordsGuessed: 1 }));
    expect(patch).toHaveBeenCalledWith(
      'doodleDashScores',
      'score-drawer',
      expect.objectContaining({ correctGuessers: 1 })
    );
    expect(patch).toHaveBeenCalledWith('doodleDashGameStates', 'state-1', { phaseEndsAt: 117_000 });
    expect(runAfter).toHaveBeenCalledWith(12_000, 'internal.doodleDash.endTurn', {
      stateId: 'state-1',
      roundId: 'round-1',
      gameNumber: 2,
      turnNumber: 1,
    });
  });
});
