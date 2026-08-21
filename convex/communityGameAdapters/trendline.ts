import { components } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type DatabaseReaderContext = Pick<QueryCtx, 'runQuery'>;

export async function initializeTrendlineGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  await ctx.runMutation(components.trendline.game.initialize, { roomId });
}

export async function prepareTrendlineGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  await ctx.runMutation(components.trendline.game.prepare, { roomId });
}

export async function syncTrendlineMembership(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<void> {
  await ctx.runMutation(components.trendline.game.enrollMember, {
    roomId,
    member: { memberId: membership._id, displayName: membership.displayName },
    now,
  });
}

export async function trendlineGameIsComplete(ctx: DatabaseReaderContext, roomId: Id<'rooms'>): Promise<boolean> {
  const state = await ctx.runQuery(components.trendline.game.getStatus, { roomId });
  return state?.phase === 'complete';
}
