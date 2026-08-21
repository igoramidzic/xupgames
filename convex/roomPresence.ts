import { Presence } from '@convex-dev/presence';
import { v } from 'convex/values';
import { components } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { fail, MAX_PLAYERS, validateSessionToken } from './domain';

const HEARTBEAT_INTERVAL_MS = 2_000;
const PRESENCE_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const memberPresenceValidator = v.object({
  memberId: v.id('roomMembers'),
  online: v.boolean(),
});

const presence = new Presence<Id<'rooms'>, Id<'roomMembers'>>(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    presenceSessionId: v.string(),
  },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, args) => {
    const sessionToken = validateSessionToken(args.sessionToken);
    if (!PRESENCE_SESSION_ID_PATTERN.test(args.presenceSessionId)) {
      fail('INVALID_PRESENCE_SESSION', 'The room presence session is invalid.');
    }
    const room = await ctx.db.get('rooms', args.roomId);
    if (room === null) {
      fail('ROOM_NOT_FOUND', 'Room not found.');
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
      .withIndex('by_roomId_and_guestId', (index) => index.eq('roomId', args.roomId).eq('guestId', guest._id))
      .unique();
    if (membership === null) {
      fail('NOT_A_MEMBER', 'You are not a member of this room.');
    }
    if (!membership.isActive) {
      fail('MEMBER_INACTIVE', 'Rejoin the room before connecting.');
    }

    return await presence.heartbeat(ctx, args.roomId, membership._id, args.presenceSessionId, HEARTBEAT_INTERVAL_MS);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  returns: v.array(memberPresenceValidator),
  handler: async (ctx, args) => {
    const states = await presence.list(ctx, args.roomToken, MAX_PLAYERS + 1);
    return states.map((state) => ({ memberId: state.userId, online: state.online }));
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await presence.disconnect(ctx, args.sessionToken);
  },
});
