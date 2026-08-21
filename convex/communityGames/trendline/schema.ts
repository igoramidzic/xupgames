import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const phase = v.union(
  v.literal('lobby'),
  v.literal('preparing'),
  v.literal('countdown'),
  v.literal('drawing'),
  v.literal('reveal'),
  v.literal('complete')
);

export default defineSchema({
  gameStates: defineTable({
    roomId: v.string(),
    gameNumber: v.number(),
    phase,
    currentRoundNumber: v.number(),
    totalRounds: v.number(),
    phaseStartedAt: v.union(v.number(), v.null()),
    phaseEndsAt: v.union(v.number(), v.null()),
    preparationId: v.union(v.string(), v.null()),
  }).index('by_roomId', ['roomId']),

  rounds: defineTable({
    roomId: v.string(),
    gameNumber: v.number(),
    roundNumber: v.number(),
    sourceKey: v.string(),
    countryCode: v.string(),
    countryName: v.string(),
    indicatorCode: v.string(),
    indicatorName: v.string(),
    category: v.string(),
    unitLabel: v.string(),
    valueDecimals: v.number(),
    axisMin: v.number(),
    axisMax: v.number(),
    startYear: v.number(),
    endYear: v.number(),
    values: v.array(v.number()),
    sourceName: v.string(),
    sourceOrganization: v.string(),
    sourceUrl: v.string(),
    licenseName: v.string(),
    retrievedAt: v.number(),
    crowdMedianValues: v.union(v.array(v.number()), v.null()),
    scoresFinalizedAt: v.union(v.number(), v.null()),
  }).index('by_room_game_round', ['roomId', 'gameNumber', 'roundNumber']),

  predictions: defineTable({
    roomId: v.string(),
    gameNumber: v.number(),
    roundId: v.id('rounds'),
    memberId: v.string(),
    values: v.array(v.number()),
    usedHint: v.boolean(),
    meanAbsoluteError: v.union(v.number(), v.null()),
    shapeAccuracy: v.union(v.number(), v.null()),
    pointsAwarded: v.union(v.number(), v.null()),
    submittedAt: v.number(),
  })
    .index('by_round_member', ['roundId', 'memberId'])
    .index('by_room_game_member', ['roomId', 'gameNumber', 'memberId']),

  hints: defineTable({
    roundId: v.id('rounds'),
    memberId: v.string(),
    revealedAt: v.number(),
  }).index('by_round_member', ['roundId', 'memberId']),

  scores: defineTable({
    roomId: v.string(),
    gameNumber: v.number(),
    memberId: v.string(),
    displayName: v.string(),
    totalPoints: v.number(),
    roundsSubmitted: v.number(),
    bestRoundPoints: v.number(),
    updatedAt: v.number(),
  })
    .index('by_room_game', ['roomId', 'gameNumber'])
    .index('by_room_game_member', ['roomId', 'gameNumber', 'memberId']),

  roundCache: defineTable({
    sourceKey: v.string(),
    countryCode: v.string(),
    countryName: v.string(),
    indicatorCode: v.string(),
    indicatorName: v.string(),
    category: v.string(),
    unitLabel: v.string(),
    valueDecimals: v.number(),
    axisMin: v.number(),
    axisMax: v.number(),
    startYear: v.number(),
    endYear: v.number(),
    values: v.array(v.number()),
    sourceName: v.string(),
    sourceOrganization: v.string(),
    sourceUrl: v.string(),
    licenseName: v.string(),
    retrievedAt: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_retrievedAt', ['retrievedAt']),

  playtestBotStates: defineTable({
    botId: v.string(),
    roomId: v.string(),
    plannedRoundId: v.union(v.id('rounds'), v.null()),
    submitAt: v.number(),
    submitted: v.boolean(),
  }).index('by_botId', ['botId']),
});
