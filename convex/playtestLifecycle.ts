import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

export const DISCONNECTED_HUMAN_GRACE_MS = 30_000;
export const ROOM_LIFECYCLE_CHECK_INTERVAL_MS = 1_000;

type MemberPresenceState = {
  userId: Id<'roomMembers'>;
  online: boolean;
  lastDisconnected: number;
};

export function shouldCheckRoomLifecycle(lastTickAt: number | null, now: number): boolean {
  if (lastTickAt === null) {
    return true;
  }
  return Math.floor(lastTickAt / ROOM_LIFECYCLE_CHECK_INTERVAL_MS) < Math.floor(now / ROOM_LIFECYCLE_CHECK_INTERVAL_MS);
}

export function hasHumanDisconnectedBeyondGrace(
  activeHumanMemberIds: readonly Id<'roomMembers'>[],
  presenceStates: readonly MemberPresenceState[],
  now: number
): boolean {
  const activeHumanIds = new Set(activeHumanMemberIds);
  return presenceStates.some(
    (state) =>
      activeHumanIds.has(state.userId) &&
      !state.online &&
      state.lastDisconnected > 0 &&
      now - state.lastDisconnected >= DISCONNECTED_HUMAN_GRACE_MS
  );
}

export async function beginStoppingPlaytest(ctx: MutationCtx, run: Doc<'playtestRuns'>, reason: string): Promise<void> {
  if (!run.isActive || run.status === 'stopping' || run.status === 'stopped') {
    return;
  }
  await ctx.db.patch('playtestRuns', run._id, {
    status: 'stopping',
    stopReason: reason,
  });
  const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(0, internal.playtests.cleanup, {
    runId: run._id,
  });
  void scheduledId;
}

export async function stopActivePlaytestForRoom(ctx: MutationCtx, roomId: Id<'rooms'>, reason: string): Promise<void> {
  const run = await ctx.db
    .query('playtestRuns')
    .withIndex('by_roomId_and_isActive', (index) => index.eq('roomId', roomId).eq('isActive', true))
    .unique();
  if (run !== null) {
    await beginStoppingPlaytest(ctx, run, reason);
  }
}
