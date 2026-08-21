import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { MAX_PLAYERS } from './domain';

const MAX_VISIBLE_LEFT_MEMBERS = MAX_PLAYERS;

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export async function listActiveRoomMembers(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>
): Promise<Doc<'roomMembers'>[]> {
  const activeMembers = await ctx.db
    .query('roomMembers')
    .withIndex('by_roomId_and_isActive', (index) => index.eq('roomId', roomId).eq('isActive', true))
    .take(MAX_PLAYERS + 1);
  if (activeMembers.length > MAX_PLAYERS) {
    throw new Error('Room capacity invariant violated.');
  }
  return activeMembers;
}

export async function listActiveHumanRoomMembers(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>
): Promise<Doc<'roomMembers'>[]> {
  const members = await listActiveRoomMembers(ctx, roomId);
  const humanFlags = await Promise.all(
    members.map(async (member) => {
      if (member.memberKind !== undefined) {
        return member.memberKind === 'player';
      }
      const legacyBot = await ctx.db
        .query('playtestBots')
        .withIndex('by_memberId', (index) => index.eq('memberId', member._id))
        .first();
      return legacyBot === null;
    })
  );
  return members.filter((_, index) => humanFlags[index]);
}

export async function listRoomMembersForDisplay(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>
): Promise<Doc<'roomMembers'>[]> {
  const [activeMembers, leftMembers] = await Promise.all([
    listActiveRoomMembers(ctx, roomId),
    ctx.db
      .query('roomMembers')
      .withIndex('by_roomId_and_isActive', (index) => index.eq('roomId', roomId).eq('isActive', false))
      .order('desc')
      .take(MAX_VISIBLE_LEFT_MEMBERS),
  ]);

  return [...activeMembers, ...leftMembers].sort((first, second) => first.joinedAt - second.joinedAt);
}
