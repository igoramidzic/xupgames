import { Presence } from '@convex-dev/presence';
import { v } from 'convex/values';
import { components } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, mutation, query } from './_generated/server';
import { fail, MAX_PLAYERS, normalizePoint, validateSessionToken } from './domain';

const HEARTBEAT_INTERVAL_MS = 10_000;
const PRESENCE_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const cursorValidator = v.object({
  x: v.number(),
  y: v.number(),
  displayName: v.string(),
});

const cursorStateValidator = v.object({
  memberId: v.id('roomMembers'),
  online: v.boolean(),
  cursor: v.union(cursorValidator, v.null()),
});

const presence = new Presence<Id<'rooms'>, Id<'roomMembers'>>(components.presence);

async function requireActiveMember(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  rawSessionToken: string
): Promise<Doc<'roomMembers'>> {
  const sessionToken = validateSessionToken(rawSessionToken);
  const room = await ctx.db.get('rooms', roomId);
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
    .withIndex('by_roomId_and_guestId', (index) => index.eq('roomId', roomId).eq('guestId', guest._id))
    .unique();
  if (membership === null) {
    fail('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  if (!membership.isActive) {
    fail('MEMBER_INACTIVE', 'Rejoin the room before sharing your cursor.');
  }
  return membership;
}

function validatePresenceSessionId(sessionId: string): string {
  if (!PRESENCE_SESSION_ID_PATTERN.test(sessionId)) {
    fail('INVALID_PRESENCE_SESSION', 'The cursor presence session is invalid.');
  }
  return sessionId;
}

function parseCursorData(data: unknown): { x: number; y: number; displayName: string } | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const candidate = data as Record<string, unknown>;
  if (
    typeof candidate.x !== 'number' ||
    !Number.isFinite(candidate.x) ||
    candidate.x < 0 ||
    candidate.x > 1 ||
    typeof candidate.y !== 'number' ||
    !Number.isFinite(candidate.y) ||
    candidate.y < 0 ||
    candidate.y > 1 ||
    typeof candidate.displayName !== 'string'
  ) {
    return null;
  }

  return {
    x: candidate.x,
    y: candidate.y,
    displayName: candidate.displayName,
  };
}

export const heartbeat = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    presenceSessionId: v.string(),
    clearCursor: v.boolean(),
  },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, args) => {
    const membership = await requireActiveMember(ctx, args.roomId, args.sessionToken);
    const presenceSessionId = validatePresenceSessionId(args.presenceSessionId);
    const tokens = await presence.heartbeat(ctx, args.roomId, membership._id, presenceSessionId, HEARTBEAT_INTERVAL_MS);

    if (args.clearCursor) {
      await presence.updateRoomUser(ctx, args.roomId, membership._id, null);
    }
    return tokens;
  },
});

export const updateCursor = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    cursor: v.union(
      v.object({
        x: v.number(),
        y: v.number(),
      }),
      v.null()
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const membership = await requireActiveMember(ctx, args.roomId, args.sessionToken);
    const cursor =
      args.cursor === null ? null : { ...normalizePoint(args.cursor), displayName: membership.displayName };
    return await presence.updateRoomUser(ctx, args.roomId, membership._id, cursor);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  returns: v.array(cursorStateValidator),
  handler: async (ctx, args) => {
    const states = await presence.list(ctx, args.roomToken, MAX_PLAYERS + 1);
    return states.map((state) => ({
      memberId: state.userId,
      online: state.online,
      cursor: parseCursorData(state.data),
    }));
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await presence.disconnect(ctx, args.sessionToken);
  },
});
