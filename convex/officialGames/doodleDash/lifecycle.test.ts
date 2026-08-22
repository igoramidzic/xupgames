import { describe, expect, it, vi } from 'vitest';
import { initializeDoodleDashGame, prepareDoodleDashGame } from './lifecycle';

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

describe('Doodle Dash lifecycle', () => {
  it('initializes exactly once when retried', async () => {
    const missing = context(null);
    await initializeDoodleDashGame(missing.ctx as never, 'room-1' as never);
    expect(missing.insert).toHaveBeenCalledWith(
      'doodleDashGameStates',
      expect.objectContaining({ roomId: 'room-1', phase: 'lobby', gameNumber: 0 })
    );

    const existing = context({ _id: 'state-1', roomId: 'room-1' });
    await initializeDoodleDashGame(existing.ctx as never, 'room-1' as never);
    expect(existing.insert).not.toHaveBeenCalled();
  });

  it('resets operational state without replacing saved configuration', async () => {
    const existing = context({ _id: 'state-1', configuredRoundCount: 3, configuredDrawDurationMs: 60_000 });
    await prepareDoodleDashGame(existing.ctx as never, 'room-1' as never);
    expect(existing.patch).toHaveBeenCalledWith(
      'doodleDashGameStates',
      'state-1',
      expect.objectContaining({ phase: 'lobby', currentRoundId: null })
    );
    expect(existing.patch.mock.calls[0]?.[2]).not.toHaveProperty('configuredRoundCount');
    expect(existing.patch.mock.calls[0]?.[2]).not.toHaveProperty('configuredDrawDurationMs');
  });
});
