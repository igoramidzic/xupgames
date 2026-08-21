import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, mutation, type QueryCtx, query } from './_generated/server';
import {
  fail,
  generateRoomCode,
  MAX_PLAYERS,
  normalizeDisplayName,
  normalizeRoomCode,
  normalizeRoomPassword,
  validateSessionToken,
} from './domain';
import { gameTypeValidator } from './games';
import { createPasswordCredential, verifyPasswordCredential } from './passwords';

const roomStatusValidator = v.union(v.literal('open'), v.literal('closed'));

const previewResultValidator = v.union(
  v.object({ kind: v.literal('not_found') }),
  v.object({
    kind: v.literal('room'),
    code: v.string(),
    gameType: gameTypeValidator,
    status: roomStatusValidator,
    activeMemberCount: v.number(),
    maxPlayers: v.number(),
    ownerName: v.string(),
    isPasswordProtected: v.boolean(),
  })
);

const currentMemberValidator = v.object({
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  isActive: v.boolean(),
  joinedAt: v.number(),
  leftAt: v.union(v.number(), v.null()),
});

const activeMemberValidator = v.object({
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  isOwner: v.boolean(),
  joinedAt: v.number(),
});

const sessionResultValidator = v.union(
  v.object({ kind: v.literal('not_found') }),
  v.object({ kind: v.literal('not_member') }),
  v.object({
    kind: v.literal('session'),
    roomId: v.id('rooms'),
    code: v.string(),
    gameType: gameTypeValidator,
    status: roomStatusValidator,
    activeMemberCount: v.number(),
    maxPlayers: v.number(),
    isOwner: v.boolean(),
    currentMember: currentMemberValidator,
    activeMembers: v.array(activeMemberValidator),
  })
);

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

async function findRoomByCode(ctx: DatabaseReaderContext, code: string): Promise<Doc<'rooms'> | null> {
  return await ctx.db
    .query('rooms')
    .withIndex('by_code', (index) => index.eq('code', code))
    .unique();
}

async function findGuestByToken(
  ctx: DatabaseReaderContext,
  sessionToken: string
): Promise<Doc<'guestSessions'> | null> {
  return await ctx.db
    .query('guestSessions')
    .withIndex('by_sessionToken', (index) => index.eq('sessionToken', sessionToken))
    .unique();
}

async function findMembership(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  guestId: Id<'guestSessions'>
): Promise<Doc<'roomMembers'> | null> {
  return await ctx.db
    .query('roomMembers')
    .withIndex('by_roomId_and_guestId', (index) => index.eq('roomId', roomId).eq('guestId', guestId))
    .unique();
}

async function upsertGuest(
  ctx: MutationCtx,
  sessionToken: string,
  displayName: string,
  now: number
): Promise<Doc<'guestSessions'>> {
  const existing = await findGuestByToken(ctx, sessionToken);
  if (existing !== null) {
    if (existing.displayName !== displayName) {
      await ctx.db.patch('guestSessions', existing._id, { displayName, updatedAt: now });
      return { ...existing, displayName, updatedAt: now };
    }
    return existing;
  }

  const guestId = await ctx.db.insert('guestSessions', {
    sessionToken,
    displayName,
    createdAt: now,
    updatedAt: now,
  });
  const guest = await ctx.db.get('guestSessions', guestId);
  if (guest === null) {
    throw new Error('New guest session could not be loaded.');
  }
  return guest;
}

function getRoomPasswordCredential(room: Doc<'rooms'>) {
  const fields = [room.passwordHash, room.passwordSalt, room.passwordIterations];
  const isPasswordProtected = fields.some((field) => field !== undefined);
  if (!isPasswordProtected) {
    return null;
  }
  if (room.passwordHash === undefined || room.passwordSalt === undefined || room.passwordIterations === undefined) {
    throw new Error('Room password credential is incomplete.');
  }
  return {
    hash: room.passwordHash,
    salt: room.passwordSalt,
    iterations: room.passwordIterations,
  };
}

export const preview = query({
  args: { code: v.string() },
  returns: previewResultValidator,
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const room = await findRoomByCode(ctx, code);
    if (room === null) {
      return { kind: 'not_found' as const };
    }

    const ownerMembership = await findMembership(ctx, room._id, room.ownerGuestId);
    if (ownerMembership === null) {
      throw new Error('Room owner membership is missing.');
    }

    return {
      kind: 'room' as const,
      code: room.code,
      gameType: room.gameType,
      status: room.status,
      activeMemberCount: room.activeMemberCount,
      maxPlayers: room.maxPlayers,
      ownerName: ownerMembership.displayName,
      isPasswordProtected: getRoomPasswordCredential(room) !== null,
    };
  },
});

export const getSession = query({
  args: { code: v.string(), sessionToken: v.string() },
  returns: sessionResultValidator,
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const sessionToken = validateSessionToken(args.sessionToken);
    const room = await findRoomByCode(ctx, code);
    if (room === null) {
      return { kind: 'not_found' as const };
    }

    const guest = await findGuestByToken(ctx, sessionToken);
    if (guest === null) {
      return { kind: 'not_member' as const };
    }

    const membership = await findMembership(ctx, room._id, guest._id);
    if (membership === null) {
      return { kind: 'not_member' as const };
    }

    const activeMemberships = await ctx.db
      .query('roomMembers')
      .withIndex('by_roomId_and_isActive', (index) => index.eq('roomId', room._id).eq('isActive', true))
      .take(MAX_PLAYERS + 1);
    if (activeMemberships.length > MAX_PLAYERS) {
      throw new Error('Room capacity invariant violated.');
    }

    return {
      kind: 'session' as const,
      roomId: room._id,
      code: room.code,
      gameType: room.gameType,
      status: room.status,
      activeMemberCount: room.activeMemberCount,
      maxPlayers: room.maxPlayers,
      isOwner: room.ownerGuestId === guest._id,
      currentMember: {
        memberId: membership._id,
        displayName: membership.displayName,
        isActive: membership.isActive,
        joinedAt: membership.joinedAt,
        leftAt: membership.leftAt,
      },
      activeMembers: activeMemberships.map((activeMembership) => ({
        memberId: activeMembership._id,
        displayName: activeMembership.displayName,
        isOwner: activeMembership.guestId === room.ownerGuestId,
        joinedAt: activeMembership.joinedAt,
      })),
    };
  },
});

export const create = mutation({
  args: {
    gameType: v.optional(gameTypeValidator),
    sessionToken: v.string(),
    displayName: v.string(),
    password: v.optional(v.string()),
  },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const sessionToken = validateSessionToken(args.sessionToken);
    const displayName = normalizeDisplayName(args.displayName);
    const gameType = args.gameType ?? 'drawing';
    const password = args.password === undefined ? null : normalizeRoomPassword(args.password);
    const passwordCredential = password === null ? null : await createPasswordCredential(password);
    const now = Date.now();
    const guest = await upsertGuest(ctx, sessionToken, displayName, now);

    let code: string | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateRoomCode();
      if ((await findRoomByCode(ctx, candidate)) === null) {
        code = candidate;
        break;
      }
    }
    if (code === null) {
      throw new Error('Could not allocate a unique room code.');
    }

    const roomId = await ctx.db.insert('rooms', {
      code,
      gameType,
      status: 'open',
      maxPlayers: MAX_PLAYERS,
      activeMemberCount: 1,
      ownerGuestId: guest._id,
      ...(passwordCredential === null
        ? {}
        : {
            passwordHash: passwordCredential.hash,
            passwordSalt: passwordCredential.salt,
            passwordIterations: passwordCredential.iterations,
          }),
      createdAt: now,
      closedAt: null,
    });
    switch (gameType) {
      case 'drawing':
        await ctx.db.insert('drawingGameStates', {
          roomId,
          nextStrokeSequence: 1,
        });
        break;
      case 'trivia':
        await ctx.db.insert('triviaGameStates', {
          roomId,
          gameNumber: 0,
          phase: 'lobby',
          currentQuestionNumber: 0,
          totalQuestions: 10,
          phaseStartedAt: null,
          phaseEndsAt: null,
        });
        break;
      default: {
        const unsupportedGameType: never = gameType;
        throw new Error(`Unsupported game type: ${unsupportedGameType}`);
      }
    }
    await ctx.db.insert('roomMembers', {
      roomId,
      guestId: guest._id,
      displayName,
      isActive: true,
      joinedAt: now,
      leftAt: null,
    });

    return { code };
  },
});

export const join = mutation({
  args: { code: v.string(), sessionToken: v.string(), displayName: v.string(), password: v.optional(v.string()) },
  returns: v.object({ code: v.string() }),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const sessionToken = validateSessionToken(args.sessionToken);
    const displayName = normalizeDisplayName(args.displayName);
    const room = await findRoomByCode(ctx, code);
    if (room === null) {
      fail('ROOM_NOT_FOUND', 'Room not found.');
    }
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }

    const passwordCredential = getRoomPasswordCredential(room);
    if (passwordCredential !== null) {
      if (args.password === undefined || args.password.trim() === '') {
        fail('ROOM_PASSWORD_REQUIRED', 'Enter the room password.');
      }
      const password = normalizeRoomPassword(args.password);
      if (!(await verifyPasswordCredential(password, passwordCredential))) {
        fail('INVALID_ROOM_PASSWORD', 'That room password is incorrect.');
      }
    }

    const now = Date.now();
    const guest = await upsertGuest(ctx, sessionToken, displayName, now);
    const existingMembership = await findMembership(ctx, room._id, guest._id);

    if (existingMembership?.isActive) {
      if (existingMembership.displayName !== displayName) {
        await ctx.db.patch('roomMembers', existingMembership._id, { displayName });
      }
      return { code: room.code };
    }
    if (room.activeMemberCount >= room.maxPlayers) {
      fail('ROOM_FULL', 'This room already has 50 active members.');
    }

    if (existingMembership !== null) {
      await ctx.db.patch('roomMembers', existingMembership._id, {
        displayName,
        isActive: true,
        leftAt: null,
      });
    } else {
      await ctx.db.insert('roomMembers', {
        roomId: room._id,
        guestId: guest._id,
        displayName,
        isActive: true,
        joinedAt: now,
        leftAt: null,
      });
    }
    await ctx.db.patch('rooms', room._id, {
      activeMemberCount: room.activeMemberCount + 1,
    });

    return { code: room.code };
  },
});

export const leave = mutation({
  args: { code: v.string(), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const sessionToken = validateSessionToken(args.sessionToken);
    const room = await findRoomByCode(ctx, code);
    if (room === null) {
      return null;
    }
    const guest = await findGuestByToken(ctx, sessionToken);
    if (guest === null) {
      return null;
    }
    const membership = await findMembership(ctx, room._id, guest._id);
    if (membership === null || !membership.isActive) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch('roomMembers', membership._id, { isActive: false, leftAt: now });
    const ownerIsLeaving = room.ownerGuestId === guest._id;
    await ctx.db.patch('rooms', room._id, {
      activeMemberCount: Math.max(0, room.activeMemberCount - 1),
      status: ownerIsLeaving ? 'closed' : room.status,
      closedAt: ownerIsLeaving && room.status === 'open' ? now : room.closedAt,
    });
    return null;
  },
});

export const close = mutation({
  args: { code: v.string(), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const sessionToken = validateSessionToken(args.sessionToken);
    const room = await findRoomByCode(ctx, code);
    if (room === null) {
      fail('ROOM_NOT_FOUND', 'Room not found.');
    }
    const guest = await findGuestByToken(ctx, sessionToken);
    if (guest === null || guest._id !== room.ownerGuestId) {
      fail('NOT_ROOM_OWNER', 'Only the room owner can close this room.');
    }
    if (room.status === 'open') {
      await ctx.db.patch('rooms', room._id, { status: 'closed', closedAt: Date.now() });
    }
    return null;
  },
});
