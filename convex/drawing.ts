import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, mutation, type QueryCtx, query } from './_generated/server';
import {
  fail,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_RETURNED,
  normalizeColor,
  normalizePoint,
  normalizePointBatch,
  normalizeStrokeWidth,
  pointsMatchAt,
  validateExpectedPointCount,
  validateSessionToken,
} from './domain';

const pointValidator = v.object({ x: v.number(), y: v.number() });
const strokeStatusValidator = v.union(v.literal('drawing'), v.literal('finished'));
const strokeValidator = v.object({
  strokeId: v.id('drawingStrokes'),
  sequence: v.number(),
  author: v.object({
    memberId: v.id('roomMembers'),
    displayName: v.string(),
  }),
  color: v.string(),
  width: v.number(),
  status: strokeStatusValidator,
  points: v.array(pointValidator),
  pointCount: v.number(),
});

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

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

async function requireMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  sessionToken: string,
  requireActive: boolean
): Promise<{ room: Doc<'rooms'>; membership: Doc<'roomMembers'> }> {
  const room = await ctx.db.get('rooms', roomId);
  if (room === null) {
    fail('ROOM_NOT_FOUND', 'Room not found.');
  }
  if (room.gameType !== 'drawing') {
    fail('WRONG_GAME_TYPE', 'This room does not support drawing.');
  }
  const guest = await findGuestByToken(ctx, sessionToken);
  if (guest === null) {
    fail('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  const membership = await findMembership(ctx, room._id, guest._id);
  if (membership === null) {
    fail('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  if (requireActive && !membership.isActive) {
    fail('MEMBER_INACTIVE', 'Rejoin the room before drawing.');
  }
  return { room, membership };
}

function requireOpenRoom(room: Doc<'rooms'>): void {
  if (room.status === 'closed') {
    fail('ROOM_CLOSED', 'This room is closed.');
  }
}

async function findDrawingGameState(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>
): Promise<Doc<'drawingGameStates'> | null> {
  return await ctx.db
    .query('drawingGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

async function getOrCreateDrawingGameState(ctx: MutationCtx, room: Doc<'rooms'>): Promise<Doc<'drawingGameStates'>> {
  const existing = await findDrawingGameState(ctx, room._id);
  if (existing !== null) {
    return existing;
  }

  const newestStroke = await ctx.db
    .query('drawingStrokes')
    .withIndex('by_roomId_and_sequence', (index) => index.eq('roomId', room._id))
    .order('desc')
    .first();
  const nextStrokeSequence = (newestStroke?.sequence ?? 0) + 1;
  const stateId = await ctx.db.insert('drawingGameStates', {
    roomId: room._id,
    nextStrokeSequence,
  });
  const state = await ctx.db.get('drawingGameStates', stateId);
  if (state === null) {
    throw new Error('Drawing game state could not be loaded.');
  }
  return state;
}

export const list = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.array(strokeValidator),
  handler: async (ctx, args) => {
    const sessionToken = validateSessionToken(args.sessionToken);
    await requireMember(ctx, args.roomId, sessionToken, false);
    const newestFirst = await ctx.db
      .query('drawingStrokes')
      .withIndex('by_roomId_and_sequence', (index) => index.eq('roomId', args.roomId))
      .order('desc')
      .take(MAX_STROKES_RETURNED);

    return newestFirst.reverse().map((stroke) => ({
      strokeId: stroke._id,
      sequence: stroke.sequence,
      author: {
        memberId: stroke.authorMemberId,
        displayName: stroke.authorName,
      },
      color: stroke.color,
      width: stroke.width,
      status: stroke.status,
      points: stroke.points,
      pointCount: stroke.pointCount,
    }));
  },
});

export const listPage = query({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(strokeValidator),
  handler: async (ctx, args) => {
    const sessionToken = validateSessionToken(args.sessionToken);
    await requireMember(ctx, args.roomId, sessionToken, false);
    const result = await ctx.db
      .query('drawingStrokes')
      .withIndex('by_roomId_and_sequence', (index) => index.eq('roomId', args.roomId))
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((stroke) => ({
        strokeId: stroke._id,
        sequence: stroke.sequence,
        author: {
          memberId: stroke.authorMemberId,
          displayName: stroke.authorName,
        },
        color: stroke.color,
        width: stroke.width,
        status: stroke.status,
        points: stroke.points,
        pointCount: stroke.pointCount,
      })),
    };
  },
});

export const start = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    color: v.string(),
    width: v.number(),
    point: pointValidator,
  },
  returns: v.object({ strokeId: v.id('drawingStrokes'), sequence: v.number() }),
  handler: async (ctx, args) => {
    const sessionToken = validateSessionToken(args.sessionToken);
    const color = normalizeColor(args.color);
    const width = normalizeStrokeWidth(args.width);
    const point = normalizePoint(args.point);
    const { room, membership } = await requireMember(ctx, args.roomId, sessionToken, true);
    requireOpenRoom(room);

    const now = Date.now();
    const drawingState = await getOrCreateDrawingGameState(ctx, room);
    const sequence = drawingState.nextStrokeSequence;
    await ctx.db.patch('drawingGameStates', drawingState._id, { nextStrokeSequence: sequence + 1 });
    const strokeId = await ctx.db.insert('drawingStrokes', {
      roomId: room._id,
      authorMemberId: membership._id,
      authorName: membership.displayName,
      sequence,
      color,
      width,
      status: 'drawing',
      points: [point],
      pointCount: 1,
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    });
    return { strokeId, sequence };
  },
});

export const append = mutation({
  args: {
    strokeId: v.id('drawingStrokes'),
    sessionToken: v.string(),
    expectedPointCount: v.number(),
    points: v.array(pointValidator),
  },
  returns: v.object({ pointCount: v.number() }),
  handler: async (ctx, args) => {
    const sessionToken = validateSessionToken(args.sessionToken);
    const expectedPointCount = validateExpectedPointCount(args.expectedPointCount);
    const points = normalizePointBatch(args.points);
    const stroke = await ctx.db.get('drawingStrokes', args.strokeId);
    if (stroke === null) {
      fail('STROKE_NOT_FOUND', 'Stroke not found.');
    }
    const { room, membership } = await requireMember(ctx, stroke.roomId, sessionToken, true);
    requireOpenRoom(room);
    if (membership._id !== stroke.authorMemberId) {
      fail('NOT_STROKE_AUTHOR', 'Only the stroke author can append points.');
    }

    if (stroke.pointCount > expectedPointCount) {
      if (pointsMatchAt(stroke.points, expectedPointCount, points)) {
        return { pointCount: stroke.pointCount };
      }
      fail('STROKE_OUT_OF_SYNC', 'The stroke changed before this append was applied.');
    }
    if (stroke.pointCount < expectedPointCount) {
      fail('STROKE_OUT_OF_SYNC', 'The append skipped one or more points.');
    }
    if (stroke.status === 'finished') {
      fail('STROKE_FINISHED', 'This stroke is already finished.');
    }
    if (stroke.pointCount + points.length > MAX_POINTS_PER_STROKE) {
      fail('STROKE_POINT_LIMIT', `A stroke can contain at most ${MAX_POINTS_PER_STROKE} points.`);
    }

    const nextPoints = [...stroke.points, ...points];
    await ctx.db.patch('drawingStrokes', stroke._id, {
      points: nextPoints,
      pointCount: nextPoints.length,
      updatedAt: Date.now(),
    });
    return { pointCount: nextPoints.length };
  },
});

export const finish = mutation({
  args: { strokeId: v.id('drawingStrokes'), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sessionToken = validateSessionToken(args.sessionToken);
    const stroke = await ctx.db.get('drawingStrokes', args.strokeId);
    if (stroke === null) {
      fail('STROKE_NOT_FOUND', 'Stroke not found.');
    }
    const { room, membership } = await requireMember(ctx, stroke.roomId, sessionToken, true);
    requireOpenRoom(room);
    if (membership._id !== stroke.authorMemberId) {
      fail('NOT_STROKE_AUTHOR', 'Only the stroke author can finish this stroke.');
    }
    if (stroke.status === 'finished') {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch('drawingStrokes', stroke._id, {
      status: 'finished',
      updatedAt: now,
      finishedAt: now,
    });
    return null;
  },
});
