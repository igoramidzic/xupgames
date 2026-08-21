import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { gameTypeValidator } from './games';

const roomStatus = v.union(v.literal('open'), v.literal('closed'));
const strokeStatus = v.union(v.literal('drawing'), v.literal('finished'));
const triviaPhase = v.union(
  v.literal('lobby'),
  v.literal('countdown'),
  v.literal('question'),
  v.literal('reveal'),
  v.literal('complete')
);
const playtestStatus = v.union(
  v.literal('provisioning'),
  v.literal('running'),
  v.literal('stopping'),
  v.literal('stopped')
);
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

  triviaGameStates: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    phase: triviaPhase,
    currentQuestionNumber: v.number(),
    totalQuestions: v.number(),
    phaseStartedAt: v.union(v.number(), v.null()),
    phaseEndsAt: v.union(v.number(), v.null()),
  }).index('by_roomId', ['roomId']),

  triviaRounds: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    questionNumber: v.number(),
    sourceType: v.union(v.literal('bank'), v.literal('user'), v.literal('generated')),
    sourceId: v.string(),
    category: v.string(),
    difficulty: v.union(v.literal('hard')),
    prompt: v.string(),
    options: v.array(v.string()),
    answer: v.string(),
    correctOptionIndex: v.number(),
    scoreCommitMode: v.optional(v.union(v.literal('on_submit'), v.literal('on_reveal'))),
    scoresFinalizedAt: v.optional(v.number()),
  }).index('by_roomId_and_gameNumber_and_questionNumber', ['roomId', 'gameNumber', 'questionNumber']),

  triviaAnswers: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    roundId: v.id('triviaRounds'),
    memberId: v.id('roomMembers'),
    selectedOptionIndex: v.number(),
    isCorrect: v.boolean(),
    responseTimeMs: v.number(),
    pointsAwarded: v.number(),
    submittedAt: v.number(),
  })
    .index('by_roundId_and_memberId', ['roundId', 'memberId'])
    .index('by_roomId_and_gameNumber_and_memberId', ['roomId', 'gameNumber', 'memberId']),

  triviaScores: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    memberId: v.id('roomMembers'),
    displayName: v.string(),
    totalPoints: v.number(),
    correctAnswers: v.number(),
    answersSubmitted: v.number(),
    currentStreak: v.number(),
    bestStreak: v.number(),
    updatedAt: v.number(),
  })
    .index('by_roomId_and_gameNumber', ['roomId', 'gameNumber'])
    .index('by_roomId_and_gameNumber_and_memberId', ['roomId', 'gameNumber', 'memberId']),

  drawingPlaytestBotStates: defineTable({
    botId: v.id('playtestBots'),
    roomId: v.id('rooms'),
    cursor: point,
    cursorTarget: point,
    nextCursorTargetAt: v.number(),
    activeStrokeId: v.union(v.id('drawingStrokes'), v.null()),
    plannedPoints: v.array(point),
    nextPointIndex: v.number(),
    nextActionAt: v.number(),
    lastTickAt: v.number(),
  }).index('by_botId', ['botId']),

  triviaPlaytestBotStates: defineTable({
    botId: v.id('playtestBots'),
    roomId: v.id('rooms'),
    plannedRoundId: v.union(v.id('triviaRounds'), v.null()),
    answerAt: v.number(),
    selectedOptionIndex: v.number(),
    submitted: v.boolean(),
  }).index('by_botId', ['botId']),

  playtestRuns: defineTable({
    roomId: v.id('rooms'),
    gameType: gameTypeValidator,
    status: playtestStatus,
    isActive: v.boolean(),
    requestedBotCount: v.number(),
    provisionedBotCount: v.number(),
    activeBotCount: v.number(),
    durationMs: v.union(v.number(), v.null()),
    startedAt: v.number(),
    endsAt: v.union(v.number(), v.null()),
    lastTickAt: v.union(v.number(), v.null()),
    stoppedAt: v.union(v.number(), v.null()),
    stopReason: v.union(v.string(), v.null()),
    nextBotNumber: v.number(),
    tickCursor: v.number(),
  })
    .index('by_roomId', ['roomId'])
    .index('by_roomId_and_isActive', ['roomId', 'isActive']),

  playtestBots: defineTable({
    runId: v.id('playtestRuns'),
    roomId: v.id('rooms'),
    guestId: v.id('guestSessions'),
    memberId: v.id('roomMembers'),
    botNumber: v.number(),
    displayName: v.string(),
    isActive: v.boolean(),
    lastPresenceHeartbeatAt: v.optional(v.number()),
    joinedAt: v.number(),
    leftAt: v.union(v.number(), v.null()),
  })
    .index('by_runId_and_botNumber', ['runId', 'botNumber'])
    .index('by_runId_and_isActive', ['runId', 'isActive']),
});
