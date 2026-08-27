import { describe, expect, it, vi } from 'vitest';
import {
  closePromptArcadeGame,
  enrollPromptArcadePlaytestBot,
  initializePromptArcadeGame,
  preparePromptArcadeGame,
} from './lifecycle';

function context(existing: Record<string, unknown> | null) {
  const index = { eq: vi.fn(() => index) };
  const insert = vi.fn(async (_table: string, _value: Record<string, unknown>) => 'state-id');
  const patch = vi.fn(async (_table: string, _id: string, _value: Record<string, unknown>) => undefined);
  return {
    ctx: {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return { unique: vi.fn(async () => existing) };
          }),
        })),
        insert,
        patch,
      },
    },
    insert,
    patch,
  };
}

describe('Prompt Arcade lifecycle', () => {
  it('initializes exactly once', async () => {
    const missing = context(null);
    await initializePromptArcadeGame(missing.ctx as never, 'room-1' as never);
    expect(missing.insert).toHaveBeenCalledWith(
      'promptArcadeGameStates',
      expect.objectContaining({ roomId: 'room-1', gameNumber: 0, phase: 'lobby', playlistStarted: false })
    );
    const existing = context({ _id: 'state-1' });
    await initializePromptArcadeGame(existing.ctx as never, 'room-1' as never);
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('resets only operational state for a later room game', async () => {
    const existing = context({ _id: 'state-1', gameNumber: 4, phase: 'complete' });
    await preparePromptArcadeGame(existing.ctx as never, 'room-1' as never);
    expect(existing.patch).toHaveBeenCalledWith(
      'promptArcadeGameStates',
      'state-1',
      expect.objectContaining({ phase: 'lobby', currentRoundId: null, playlistStarted: false })
    );
    expect(existing.patch.mock.calls[0]?.[2]).not.toHaveProperty('gameNumber');
  });

  it('completes the game and invalidates every unfinished generation lease when the room closes', async () => {
    const state = {
      _id: 'state-1',
      roomId: 'room-1',
      gameNumber: 4,
      phase: 'generating',
      currentRoundId: null,
    };
    const entries = [
      { _id: 'entry-1', status: 'generating', attempt: 2 },
      { _id: 'entry-2', status: 'ready', attempt: 1 },
      { _id: 'entry-3', status: 'played', attempt: 1 },
    ];
    const index = { eq: vi.fn(() => index) };
    const patch = vi.fn(async () => undefined);
    const ctx = {
      db: {
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return {
              unique: vi.fn(async () => (table === 'promptArcadeGameStates' ? state : null)),
              take: vi.fn(async () => (table === 'promptArcadeEntries' ? entries : [])),
            };
          }),
        })),
        patch,
      },
    };

    await closePromptArcadeGame(ctx as never, 'room-1' as never, 5_000);

    expect(patch).toHaveBeenCalledWith(
      'promptArcadeEntries',
      'entry-1',
      expect.objectContaining({ status: 'withdrawn', attempt: 3, statusUpdatedAt: 5_000 })
    );
    expect(patch).toHaveBeenCalledWith(
      'promptArcadeEntries',
      'entry-2',
      expect.objectContaining({ status: 'withdrawn', attempt: 2, statusUpdatedAt: 5_000 })
    );
    expect(patch).not.toHaveBeenCalledWith('promptArcadeEntries', 'entry-3', expect.anything());
    expect(patch).toHaveBeenCalledWith('promptArcadeGameStates', 'state-1', {
      phase: 'complete',
      currentRoundId: null,
      phaseStartedAt: 5_000,
      phaseEndsAt: null,
    });
  });

  it('enrolls an owner-provisioned playtest bot while prompt collection is open', async () => {
    const index = { eq: vi.fn(() => index) };
    const insert = vi.fn(async (table: string) => `${table}-id`);
    const patch = vi.fn(async () => undefined);
    const ctx = {
      db: {
        get: vi.fn(async (table: string) =>
          table === 'roomMembers'
            ? {
                _id: 'member-bot-1',
                roomId: 'room-1',
                memberKind: 'playtestBot',
                isActive: true,
                displayName: 'Bot 01',
              }
            : null
        ),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return {
              unique: vi.fn(async () =>
                table === 'promptArcadeGameStates'
                  ? {
                      _id: 'state-1',
                      gameNumber: 2,
                      phase: 'prompting',
                      playlistStarted: false,
                    }
                  : null
              ),
              take: vi.fn(async () => []),
            };
          }),
        })),
        insert,
        patch,
      },
    };

    await enrollPromptArcadePlaytestBot(
      ctx as never,
      {
        roomId: 'room-1' as never,
        memberId: 'member-bot-1' as never,
        displayName: 'Bot 01',
      },
      1_000
    );

    expect(insert).toHaveBeenCalledWith(
      'promptArcadeEntries',
      expect.objectContaining({ memberId: 'member-bot-1', status: 'writing', order: 0 })
    );
    expect(insert).toHaveBeenCalledWith(
      'promptArcadeScores',
      expect.objectContaining({ memberId: 'member-bot-1', totalScore: 0 })
    );
    expect(patch).toHaveBeenCalledWith('promptArcadeGameStates', 'state-1', { participantCount: 1 });
  });
});
