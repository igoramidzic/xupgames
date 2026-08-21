import { ConvexError } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';
import { reserveTrendlineStart, submitTrendlinePrediction } from './trendline';

const sessionToken = 'a'.repeat(32);

function queryResult(value: unknown) {
  const index = { eq: vi.fn(() => index) };
  return {
    withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
      configure(index);
      return { unique: vi.fn(async () => value) };
    }),
  };
}

function context({
  gameType = 'trendline',
  guest = { _id: 'guest-1' },
  membership = { _id: 'member-1', guestId: 'guest-1', isActive: true },
  ownerGuestId = 'guest-1',
}: {
  gameType?: 'trivia' | 'trendline';
  guest?: { _id: string } | null;
  membership?: { _id: string; guestId: string; isActive: boolean } | null;
  ownerGuestId?: string;
} = {}) {
  const room = { _id: 'room-1', gameType, status: 'open', ownerGuestId };
  const runMutation = vi.fn(async (_reference: unknown, _args: unknown) => ({ kind: 'reserved', gameNumber: 3 }));
  return {
    ctx: {
      db: {
        get: vi.fn(async () => room),
        query: vi.fn((table: string) => queryResult(table === 'guestSessions' ? guest : membership)),
      },
      runMutation,
    },
    runMutation,
  };
}

function submissionContext(allLockedIn: boolean) {
  const room = { _id: 'room-1', gameType: 'trendline', status: 'open', ownerGuestId: 'guest-1' };
  const guest = { _id: 'guest-1' };
  const membership = { _id: 'member-1', guestId: 'guest-1', isActive: true };
  const otherMembership = { _id: 'member-2', guestId: 'guest-2', isActive: true };
  const index = { eq: vi.fn(() => index) };
  const runMutation = vi.fn(async () => ({
    kind: 'accepted' as const,
    allLockedIn,
    gameNumber: 3,
    roundNumber: 2,
  }));
  const runAfter = vi.fn(async () => 'scheduled-id');
  return {
    ctx: {
      db: {
        get: vi.fn(async () => room),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return {
              unique: vi.fn(async () => (table === 'guestSessions' ? guest : membership)),
              take: vi.fn(async () => [membership, otherMembership]),
            };
          }),
        })),
      },
      runMutation,
      scheduler: { runAfter },
    },
    runMutation,
    runAfter,
  };
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    return (error as ConvexError<{ code: string }>).data.code;
  }
}

describe('Trendline community wrapper authorization', () => {
  it('rejects the wrong game before invoking the component', async () => {
    const { ctx, runMutation } = context({ gameType: 'trivia' });
    await expect(
      errorCode(reserveTrendlineStart(ctx as never, { roomId: 'room-1' as never, sessionToken }))
    ).resolves.toBe('WRONG_GAME_TYPE');
    expect(runMutation).not.toHaveBeenCalled();
  });

  it('rejects non-members, inactive members, and non-owners', async () => {
    const missing = context({ guest: null });
    await expect(
      errorCode(reserveTrendlineStart(missing.ctx as never, { roomId: 'room-1' as never, sessionToken }))
    ).resolves.toBe('NOT_A_MEMBER');

    const inactive = context({ membership: { _id: 'member-1', guestId: 'guest-1', isActive: false } });
    await expect(
      errorCode(reserveTrendlineStart(inactive.ctx as never, { roomId: 'room-1' as never, sessionToken }))
    ).resolves.toBe('MEMBER_INACTIVE');

    const nonOwner = context({ ownerGuestId: 'guest-2' });
    await expect(
      errorCode(reserveTrendlineStart(nonOwner.ctx as never, { roomId: 'room-1' as never, sessionToken }))
    ).resolves.toBe('NOT_ROOM_OWNER');
  });

  it('passes only validated parent IDs and preparation metadata into the component', async () => {
    const { ctx, runMutation } = context();
    await expect(
      reserveTrendlineStart(ctx as never, { roomId: 'room-1' as never, sessionToken })
    ).resolves.toMatchObject({ gameNumber: 3 });
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ roomId: 'room-1', preparationId: expect.any(String), now: expect.any(Number) })
    );
    expect(runMutation.mock.calls[0][1]).not.toHaveProperty('sessionToken');
  });
});

describe('Trendline early round close', () => {
  it('schedules an immediate close after the final active member locks in', async () => {
    const { ctx, runMutation, runAfter } = submissionContext(true);
    await expect(
      submitTrendlinePrediction(ctx as never, {
        roomId: 'room-1' as never,
        sessionToken,
        roundId: 'round-2',
        values: Array.from({ length: 24 }, () => 0.5),
      })
    ).resolves.toBeNull();

    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eligibleMemberIds: ['member-1', 'member-2'] })
    );
    expect(runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      roomId: 'room-1',
      gameNumber: 3,
      roundNumber: 2,
    });
  });

  it('keeps the normal timer when an active member has not locked in', async () => {
    const { ctx, runAfter } = submissionContext(false);
    await submitTrendlinePrediction(ctx as never, {
      roomId: 'room-1' as never,
      sessionToken,
      roundId: 'round-2',
      values: Array.from({ length: 24 }, () => 0.5),
    });
    expect(runAfter).not.toHaveBeenCalled();
  });
});
