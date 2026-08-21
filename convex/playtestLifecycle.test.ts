import { describe, expect, it, vi } from 'vitest';
import type { Id } from './_generated/dataModel';
import {
  DISCONNECTED_HUMAN_GRACE_MS,
  hasHumanDisconnectedBeyondGrace,
  shouldCheckRoomLifecycle,
  stopActivePlaytestForRoom,
} from './playtestLifecycle';

const humanMemberId = 'human-member' as Id<'roomMembers'>;
const botMemberId = 'bot-member' as Id<'roomMembers'>;

describe('playtest room lifecycle', () => {
  it('checks room lifecycle once per interval bucket', () => {
    expect(shouldCheckRoomLifecycle(null, 1_000)).toBe(true);
    expect(shouldCheckRoomLifecycle(1_100, 1_999)).toBe(false);
    expect(shouldCheckRoomLifecycle(1_999, 2_000)).toBe(true);
  });

  it('stops for an active human who remains disconnected through the grace period', () => {
    const now = 100_000;
    expect(
      hasHumanDisconnectedBeyondGrace(
        [humanMemberId],
        [
          {
            userId: humanMemberId,
            online: false,
            lastDisconnected: now - DISCONNECTED_HUMAN_GRACE_MS,
          },
        ],
        now
      )
    ).toBe(true);
  });

  it('ignores brief disconnects, bots, inactive humans, and reconnected humans', () => {
    const now = 100_000;
    expect(
      hasHumanDisconnectedBeyondGrace(
        [humanMemberId],
        [
          {
            userId: humanMemberId,
            online: false,
            lastDisconnected: now - DISCONNECTED_HUMAN_GRACE_MS + 1,
          },
          {
            userId: botMemberId,
            online: false,
            lastDisconnected: now - DISCONNECTED_HUMAN_GRACE_MS,
          },
        ],
        now
      )
    ).toBe(false);
    expect(
      hasHumanDisconnectedBeyondGrace(
        [humanMemberId],
        [
          { userId: humanMemberId, online: true, lastDisconnected: 0 },
          {
            userId: 'inactive-human' as Id<'roomMembers'>,
            online: false,
            lastDisconnected: now - DISCONNECTED_HUMAN_GRACE_MS,
          },
        ],
        now
      )
    ).toBe(false);
  });

  it('starts cleanup when a room loses its last human', async () => {
    const run = {
      _id: 'run-id',
      status: 'running',
      isActive: true,
    };
    const index = {
      eq: vi.fn(() => index),
    };
    const patch = vi.fn(async () => null);
    const runAfter = vi.fn(async () => 'scheduled-id');
    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn((_name: string, configure: (value: typeof index) => unknown) => {
            configure(index);
            return { unique: vi.fn(async () => run) };
          }),
        })),
        patch,
      },
      scheduler: { runAfter },
    };

    await stopActivePlaytestForRoom(ctx as never, 'room-id' as Id<'rooms'>, 'The last player left the room.');

    expect(patch).toHaveBeenCalledWith('playtestRuns', 'run-id', {
      status: 'stopping',
      stopReason: 'The last player left the room.',
    });
    expect(runAfter).toHaveBeenCalledWith(0, 'internal.playtests.cleanup', { runId: 'run-id' });
  });
});
