import { describe, expect, it, vi } from 'vitest';
import { hasEveryoneLockedIn, initialize, prepare } from './game';

type RegisteredMutation = {
  handler: (ctx: unknown, args: { roomId: string }) => Promise<null>;
};

function componentContext(initialState: Record<string, unknown> | null) {
  let state = initialState;
  const index = { eq: vi.fn(() => index) };
  const insert = vi.fn(async (_table: string, value: Record<string, unknown>) => {
    state = { _id: 'state-1', ...value };
    return 'state-1';
  });
  const patch = vi.fn(async (_table: string, _id: string, value: Record<string, unknown>) => {
    state = { ...state, ...value };
  });
  return {
    ctx: {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return { unique: vi.fn(async () => state) };
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

describe('Trendline component lifecycle', () => {
  it('initializes once and remains idempotent', async () => {
    const { ctx, insert } = componentContext(null);
    const handler = (initialize as unknown as RegisteredMutation).handler;
    await handler(ctx, { roomId: 'room-1' });
    await handler(ctx, { roomId: 'room-1' });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith('gameStates', expect.objectContaining({ roomId: 'room-1', phase: 'lobby' }));
  });

  it('resets a completed game without changing its game number', async () => {
    const { ctx, patch } = componentContext({
      _id: 'state-1',
      roomId: 'room-1',
      gameNumber: 4,
      phase: 'complete',
      currentRoundNumber: 6,
    });
    await (prepare as unknown as RegisteredMutation).handler(ctx, { roomId: 'room-1' });
    expect(patch).toHaveBeenCalledWith(
      'gameStates',
      'state-1',
      expect.objectContaining({ phase: 'lobby', currentRoundNumber: 0, preparationId: null })
    );
    expect(patch.mock.calls[0][2]).not.toHaveProperty('gameNumber');
  });
});

describe('Trendline early round close', () => {
  it('detects when every active member has locked in', () => {
    expect(hasEveryoneLockedIn(['member-1', 'member-2'], ['member-2', 'member-1', 'left-member'])).toBe(true);
    expect(hasEveryoneLockedIn(['member-1', 'member-2'], ['member-1'])).toBe(false);
    expect(hasEveryoneLockedIn([], [])).toBe(false);
  });
});
