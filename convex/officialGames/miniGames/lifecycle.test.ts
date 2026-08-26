import { describe, expect, it, vi } from 'vitest';
import { initializeMiniGamesGame, prepareMiniGamesGame } from './lifecycle';

function context(existing: Record<string, unknown> | null) {
  const index = { eq: vi.fn(() => index) };
  const insert = vi.fn(async () => 'state-id');
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

describe('Mini Game Mix lifecycle', () => {
  it('initializes idempotently', async () => {
    const missing = context(null);
    await initializeMiniGamesGame(missing.ctx as never, 'room-1' as never);
    expect(missing.insert).toHaveBeenCalledWith(
      'miniGamesGameStates',
      expect.objectContaining({ roomId: 'room-1', phase: 'lobby', configuredRoundCount: 10 })
    );

    const existing = context({ _id: 'state-1' });
    await initializeMiniGamesGame(existing.ctx as never, 'room-1' as never);
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('preserves the configured round count when replaying', async () => {
    const existing = context({ _id: 'state-1', configuredRoundCount: 15 });
    await prepareMiniGamesGame(existing.ctx as never, 'room-1' as never);
    expect(existing.patch).toHaveBeenCalledWith(
      'miniGamesGameStates',
      'state-1',
      expect.objectContaining({ phase: 'lobby', totalRounds: 15, currentRoundId: null })
    );
    expect(existing.patch.mock.calls[0]?.[2]).not.toHaveProperty('configuredRoundCount');
  });
});
