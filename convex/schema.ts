import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { gameSourceValidator, gameTypeValidator } from './gameRegistry';

const roomStatus = v.union(v.literal('open'), v.literal('closed'));
const roomGameStatus = v.union(v.literal('lobby'), v.literal('active'), v.literal('complete'));
const ownershipReason = v.union(v.literal('created'), v.literal('transferred'), v.literal('claimed'));
const pollStatus = v.union(v.literal('round1'), v.literal('round2'), v.literal('awaitingOwner'), v.literal('closed'));
const pollRoundStatus = v.union(v.literal('open'), v.literal('closed'));
const triviaPhase = v.union(
  v.literal('lobby'),
  v.literal('countdown'),
  v.literal('question'),
  v.literal('reveal'),
  v.literal('complete')
);
const typeRacerPhase = v.union(v.literal('lobby'), v.literal('countdown'), v.literal('racing'), v.literal('complete'));
const typeRacerProgressStatus = v.union(v.literal('waiting'), v.literal('racing'), v.literal('finished'));
const typeRacerPassageKind = v.union(v.literal('phrase'), v.literal('sentence'), v.literal('paragraph'));
const playtestStatus = v.union(
  v.literal('provisioning'),
  v.literal('running'),
  v.literal('stopping'),
  v.literal('stopped')
);

export default defineSchema({
  gameDefinitions: defineTable({
    gameType: gameTypeValidator,
    name: v.string(),
    description: v.string(),
    authorName: v.string(),
    authorUrl: v.optional(v.string()),
    source: gameSourceValidator,
    isEnabled: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_gameType', ['gameType'])
    .index('by_isEnabled_and_sortOrder', ['isEnabled', 'sortOrder']),

  guestSessions: defineTable({
    sessionToken: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_sessionToken', ['sessionToken']),

  rooms: defineTable({
    code: v.string(),
    gameType: gameTypeValidator,
    currentGameId: v.optional(v.id('roomGames')),
    status: roomStatus,
    maxPlayers: v.number(),
    activeMemberCount: v.number(),
    ownerGuestId: v.union(v.id('guestSessions'), v.null()),
    ownershipVersion: v.optional(v.number()),
    ownershipReason: v.optional(ownershipReason),
    ownerChangedAt: v.optional(v.number()),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    passwordIterations: v.optional(v.number()),
    createdAt: v.number(),
    closedAt: v.union(v.number(), v.null()),
  }).index('by_code', ['code']),

  roomGames: defineTable({
    roomId: v.id('rooms'),
    gameType: gameTypeValidator,
    sequence: v.number(),
    status: roomGameStatus,
    createdAt: v.number(),
    startedAt: v.union(v.number(), v.null()),
    completedAt: v.union(v.number(), v.null()),
  })
    .index('by_roomId_and_sequence', ['roomId', 'sequence'])
    .index('by_roomId_and_status', ['roomId', 'status']),

  roomMembers: defineTable({
    roomId: v.id('rooms'),
    guestId: v.id('guestSessions'),
    displayName: v.string(),
    memberKind: v.optional(v.union(v.literal('player'), v.literal('playtestBot'))),
    isActive: v.boolean(),
    joinedAt: v.number(),
    leftAt: v.union(v.number(), v.null()),
  })
    .index('by_roomId_and_guestId', ['roomId', 'guestId'])
    .index('by_roomId_and_isActive', ['roomId', 'isActive']),

  nextGamePolls: defineTable({
    roomId: v.id('rooms'),
    roomGameId: v.id('roomGames'),
    status: pollStatus,
    currentRoundId: v.union(v.id('nextGamePollRounds'), v.null()),
    recommendedGameType: v.union(gameTypeValidator, v.null()),
    chosenGameType: v.union(gameTypeValidator, v.null()),
    createdAt: v.number(),
    resolvedAt: v.union(v.number(), v.null()),
    closedAt: v.union(v.number(), v.null()),
  })
    .index('by_roomGameId', ['roomGameId'])
    .index('by_roomId_and_status', ['roomId', 'status']),

  nextGamePollRounds: defineTable({
    pollId: v.id('nextGamePolls'),
    roundNumber: v.number(),
    status: pollRoundStatus,
    options: v.array(gameTypeValidator),
    eligibleMemberIds: v.array(v.id('roomMembers')),
    openedAt: v.number(),
    closedAt: v.union(v.number(), v.null()),
  }).index('by_pollId_and_roundNumber', ['pollId', 'roundNumber']),

  nextGameVotes: defineTable({
    pollRoundId: v.id('nextGamePollRounds'),
    memberId: v.id('roomMembers'),
    gameType: gameTypeValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_pollRoundId', ['pollRoundId'])
    .index('by_pollRoundId_and_memberId', ['pollRoundId', 'memberId']),

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

  typeRacerGameStates: defineTable({
    roomId: v.id('rooms'),
    raceNumber: v.number(),
    phase: typeRacerPhase,
    passageId: v.union(v.string(), v.null()),
    passageText: v.union(v.string(), v.null()),
    passageTitle: v.union(v.string(), v.null()),
    passageAuthor: v.union(v.string(), v.null()),
    passageKind: v.union(typeRacerPassageKind, v.null()),
    phaseStartedAt: v.union(v.number(), v.null()),
    startsAt: v.union(v.number(), v.null()),
    phaseEndsAt: v.union(v.number(), v.null()),
    participantCount: v.number(),
    finishedCount: v.number(),
    winnerMemberId: v.union(v.id('roomMembers'), v.null()),
    winnerFinishedAt: v.union(v.number(), v.null()),
  }).index('by_roomId', ['roomId']),

  typeRacerProgress: defineTable({
    roomId: v.id('rooms'),
    memberId: v.id('roomMembers'),
    raceNumber: v.number(),
    displayName: v.string(),
    status: typeRacerProgressStatus,
    correctChars: v.number(),
    typedChars: v.number(),
    totalKeystrokes: v.number(),
    errorKeystrokes: v.number(),
    revision: v.number(),
    wpm: v.number(),
    accuracy: v.number(),
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
  })
    .index('by_roomId_and_raceNumber', ['roomId', 'raceNumber'])
    .index('by_roomId_and_memberId', ['roomId', 'memberId']),

  triviaPlaytestBotStates: defineTable({
    botId: v.id('playtestBots'),
    roomId: v.id('rooms'),
    plannedRoundId: v.union(v.id('triviaRounds'), v.null()),
    answerAt: v.number(),
    selectedOptionIndex: v.number(),
    submitted: v.boolean(),
  }).index('by_botId', ['botId']),

  typeRacerPlaytestBotStates: defineTable({
    botId: v.id('playtestBots'),
    roomId: v.id('rooms'),
    raceNumber: v.number(),
    targetWpm: v.number(),
    targetAccuracy: v.number(),
    nextReportAt: v.number(),
  }).index('by_botId', ['botId']),

  playtestRuns: defineTable({
    roomId: v.id('rooms'),
    gameType: gameTypeValidator,
    status: playtestStatus,
    isActive: v.boolean(),
    requestedBotCount: v.number(),
    provisionedBotCount: v.number(),
    activeBotCount: v.number(),
    startedAt: v.number(),
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
    .index('by_runId_and_isActive', ['runId', 'isActive'])
    .index('by_memberId', ['memberId']),
});
