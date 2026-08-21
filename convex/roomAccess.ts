import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { fail, validateSessionToken } from './domain';
import type { GameType } from './games';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export type RoomAccessOptions = {
  gameType?: GameType;
  requireActive?: boolean;
  requireOwner?: boolean;
  allowPlaytestBots?: boolean;
};

/**
 * Shared authorization boundary for every official and community game wrapper.
 * A community component never receives a raw guest session token; the app
 * verifies it here, then passes only the minimum room/member values it needs.
 */
export async function requireRoomMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  rawSessionToken: string,
  options: RoomAccessOptions = {}
): Promise<{ room: Doc<'rooms'>; membership: Doc<'roomMembers'> }> {
  const sessionToken = validateSessionToken(rawSessionToken);
  const room = await ctx.db.get('rooms', roomId);
  if (room === null) {
    fail('ROOM_NOT_FOUND', 'Room not found.');
  }
  if (options.gameType !== undefined && room.gameType !== options.gameType) {
    fail('WRONG_GAME_TYPE', 'This room is running a different game.');
  }
  const guest = await ctx.db
    .query('guestSessions')
    .withIndex('by_sessionToken', (index) => index.eq('sessionToken', sessionToken))
    .unique();
  if (guest === null) {
    fail('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  const membership = await ctx.db
    .query('roomMembers')
    .withIndex('by_roomId_and_guestId', (index) => index.eq('roomId', room._id).eq('guestId', guest._id))
    .unique();
  if (membership === null) {
    fail('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  if (options.requireActive === true && !membership.isActive) {
    fail('MEMBER_INACTIVE', 'Rejoin the room before continuing.');
  }
  if (options.allowPlaytestBots === false && membership.memberKind === 'playtestBot') {
    fail('ROOM_ACTION_NOT_ELIGIBLE', 'Playtest bots cannot perform this room action.');
  }
  if (options.requireOwner === true && room.ownerGuestId !== guest._id) {
    fail('NOT_ROOM_OWNER', 'Only the room owner can perform this action.');
  }
  return { room, membership };
}
