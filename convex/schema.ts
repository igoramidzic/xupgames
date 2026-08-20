import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { gameTypeValidator } from './games';

const roomStatus = v.union(v.literal('open'), v.literal('closed'));
const strokeStatus = v.union(v.literal('drawing'), v.literal('finished'));
const point = v.object({
  x: v.number(),
  y: v.number(),
});

export default defineSchema({
  guestSessions: defineTable({
    sessionToken: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_sessionToken', ['sessionToken']),

  rooms: defineTable({
    code: v.string(),
    gameType: gameTypeValidator,
    status: roomStatus,
    maxPlayers: v.number(),
    activeMemberCount: v.number(),
    ownerGuestId: v.id('guestSessions'),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    passwordIterations: v.optional(v.number()),
    createdAt: v.number(),
    closedAt: v.union(v.number(), v.null()),
  }).index('by_code', ['code']),

  roomMembers: defineTable({
    roomId: v.id('rooms'),
    guestId: v.id('guestSessions'),
    displayName: v.string(),
    isActive: v.boolean(),
    joinedAt: v.number(),
    leftAt: v.union(v.number(), v.null()),
  })
    .index('by_roomId_and_guestId', ['roomId', 'guestId'])
    .index('by_roomId_and_isActive', ['roomId', 'isActive']),

  drawingGameStates: defineTable({
    roomId: v.id('rooms'),
    nextStrokeSequence: v.number(),
  }).index('by_roomId', ['roomId']),

  drawingStrokes: defineTable({
    roomId: v.id('rooms'),
    authorMemberId: v.id('roomMembers'),
    authorName: v.string(),
    sequence: v.number(),
    color: v.string(),
    width: v.number(),
    status: strokeStatus,
    points: v.array(point),
    pointCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
  }).index('by_roomId_and_sequence', ['roomId', 'sequence']),
});
