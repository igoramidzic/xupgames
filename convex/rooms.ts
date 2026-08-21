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
import { createInitialRoomGame } from './roomGames';
import { listActiveHumanRoomMembers, listRoomMembersForDisplay } from './roomMembers';
import { enrollTypeRacerMemberInActiveRace } from './typeRacer';

const roomStatusValidator = v.union(v.literal('open'), v.literal('closed'));
const ownershipReasonValidator = v.union(v.literal('created'), v.literal('transferred'), v.literal('claimed'));

const previewResultValidator = v.union(
  v.object({ kind: v.literal('not_found') }),
  v.object({
    kind: v.literal('room'),
    code: v.string(),
    gameType: gameTypeValidator,
    status: roomStatusValidator,
    activeMemberCount: v.number(),
    maxPlayers: v.number(),
    ownerName: v.union(v.string(), v.null()),
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

const memberValidator = v.object({
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  isOwner: v.boolean(),
  isActive: v.boolean(),
  joinedAt: v.number(),
  leftAt: v.union(v.number(), v.null()),
});

const sessionResultValidator = v.union(
  v.object({ kind: v.literal('not_found') }),
  v.object({ kind: v.literal('not_member') }),
  v.object({
    kind: v.literal('session'),
    roomId: v.id('rooms'),
    code: v.string(),
    gameType: gameTypeValidator,
    currentGameId: v.union(v.id('roomGames'), v.null()),
    status: roomStatusValidator,
    activeMemberCount: v.number(),
    maxPlayers: v.number(),
    isOwner: v.boolean(),
    ownershipVersion: v.number(),
    ownershipReason: ownershipReasonValidator,
    currentMember: currentMemberValidator,
    members: v.array(memberValidator),
  })
);

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

async function syncGameMembership(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<void> {
  switch (room.gameType) {
    case 'drawing':
    case 'trivia':
      return;
    case 'typeRacer':
      await enrollTypeRacerMemberInActiveRace(ctx, room._id, membership, now);
      return;
    default: {
      const unsupportedGameType: never = room.gameType;
      throw new Error(`Unsupported game type: ${unsupportedGameType}`);
    }
  }
}

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

    const ownerMembership = room.ownerGuestId === null ? null : await findMembership(ctx, room._id, room.ownerGuestId);

    return {
      kind: 'room' as const,
      code: room.code,
      gameType: room.gameType,
      status: room.status,
      activeMemberCount: room.activeMemberCount,
      maxPlayers: room.maxPlayers,
      ownerName: ownerMembership?.displayName ?? null,
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

    const memberships = await listRoomMembersForDisplay(ctx, room._id);

    return {
      kind: 'session' as const,
      roomId: room._id,
      code: room.code,
      gameType: room.gameType,
      currentGameId: room.currentGameId ?? null,
      status: room.status,
      activeMemberCount: room.activeMemberCount,
      maxPlayers: room.maxPlayers,
      isOwner: room.ownerGuestId === guest._id,
      ownershipVersion: room.ownershipVersion ?? 0,
      ownershipReason: room.ownershipReason ?? 'created',
      currentMember: {
        memberId: membership._id,
        displayName: membership.displayName,
        isActive: membership.isActive,
        joinedAt: membership.joinedAt,
        leftAt: membership.leftAt,
      },
      members: memberships.map((roomMembership) => ({
        memberId: roomMembership._id,
        displayName: roomMembership.displayName,
        isOwner: roomMembership.guestId === room.ownerGuestId,
        isActive: roomMembership.isActive,
        joinedAt: roomMembership.joinedAt,
        leftAt: roomMembership.leftAt,
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
      ownershipVersion: 0,
      ownershipReason: 'created',
      ownerChangedAt: now,
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
    const roomGame = await createInitialRoomGame(ctx, roomId, gameType, now);
    await ctx.db.patch('rooms', roomId, { currentGameId: roomGame._id });
    switch (gameType) {
      case 'drawing':
        await ctx.db.insert('drawingGameStates', {
          roomId,
          nextStrokeSequence: 1,
          firstStrokeSequence: 1,
          phase: 'active',
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
      case 'typeRacer':
        await ctx.db.insert('typeRacerGameStates', {
          roomId,
          raceNumber: 0,
          phase: 'lobby',
          passageId: null,
          passageText: null,
          passageTitle: null,
          passageAuthor: null,
          passageKind: null,
          phaseStartedAt: null,
          startsAt: null,
          phaseEndsAt: null,
          participantCount: 0,
          finishedCount: 0,
          winnerMemberId: null,
          winnerFinishedAt: null,
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
      memberKind: 'player',
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
      if (room.ownerGuestId === null && existingMembership.memberKind !== 'playtestBot') {
        await ctx.db.patch('rooms', room._id, {
          ownerGuestId: guest._id,
          ownershipVersion: (room.ownershipVersion ?? 0) + 1,
          ownershipReason: 'claimed',
          ownerChangedAt: now,
        });
      }
      await syncGameMembership(ctx, room, { ...existingMembership, displayName }, now);
      return { code: room.code };
    }
    if (room.activeMemberCount >= room.maxPlayers) {
      fail('ROOM_FULL', 'This room already has 50 active members.');
    }

    let membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>;
    if (existingMembership !== null) {
      await ctx.db.patch('roomMembers', existingMembership._id, {
        displayName,
        isActive: true,
        leftAt: null,
      });
      membership = { _id: existingMembership._id, displayName };
    } else {
      const memberId = await ctx.db.insert('roomMembers', {
        roomId: room._id,
        guestId: guest._id,
        displayName,
        memberKind: 'player',
        isActive: true,
        joinedAt: now,
        leftAt: null,
      });
      membership = { _id: memberId, displayName };
    }
    await ctx.db.patch(
      'rooms',
      room._id,
      room.ownerGuestId === null
        ? {
            activeMemberCount: room.activeMemberCount + 1,
            ownerGuestId: guest._id,
            ownershipVersion: (room.ownershipVersion ?? 0) + 1,
            ownershipReason: 'claimed',
            ownerChangedAt: now,
          }
        : { activeMemberCount: room.activeMemberCount + 1 }
    );
    await syncGameMembership(ctx, room, membership, now);

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
    const successor = ownerIsLeaving
      ? ((await listActiveHumanRoomMembers(ctx, room._id)).find((candidate) => candidate._id !== membership._id) ??
        null)
      : null;
    await ctx.db.patch('rooms', room._id, {
      activeMemberCount: Math.max(0, room.activeMemberCount - 1),
      ...(ownerIsLeaving
        ? {
            ownerGuestId: successor?.guestId ?? null,
            ownershipVersion: (room.ownershipVersion ?? 0) + 1,
            ownershipReason: 'transferred' as const,
            ownerChangedAt: now,
          }
        : {}),
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
