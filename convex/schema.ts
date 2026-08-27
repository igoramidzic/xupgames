import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { gameSourceValidator, gameTypeValidator } from './gameRegistry';

const roomStatus = v.union(v.literal('open'), v.literal('closed'));
const roomGameStatus = v.union(v.literal('lobby'), v.literal('active'), v.literal('complete'));
const ownershipReason = v.union(v.literal('created'), v.literal('transferred'), v.literal('claimed'));
const pollStatus = v.union(v.literal('round1'), v.literal('round2'), v.literal('awaitingOwner'), v.literal('closed'));
const pollTrigger = v.union(v.literal('initial'), v.literal('gameComplete'), v.literal('owner'));
const pollRoundStatus = v.union(v.literal('open'), v.literal('closed'));
const triviaPhase = v.union(
  v.literal('lobby'),
  v.literal('countdown'),
  v.literal('question'),
  v.literal('reveal'),
  v.literal('complete')
);
const doodleDashPhase = v.union(
  v.literal('lobby'),
  v.literal('choosing'),
  v.literal('drawing'),
  v.literal('reveal'),
  v.literal('complete')
);
const doodleDashRoundStatus = v.union(v.literal('choosing'), v.literal('drawing'), v.literal('reveal'));
const typeRacerPhase = v.union(v.literal('lobby'), v.literal('countdown'), v.literal('racing'), v.literal('complete'));
const typeRacerProgressStatus = v.union(v.literal('waiting'), v.literal('racing'), v.literal('finished'));
const typeRacerPassageKind = v.union(v.literal('phrase'), v.literal('sentence'), v.literal('paragraph'));
const miniGamesPhase = v.union(
  v.literal('lobby'),
  v.literal('selecting'),
  v.literal('playing'),
  v.literal('roundResults'),
  v.literal('complete')
);
const miniGameId = v.union(
  v.literal('straightLine'),
  v.literal('orangeEmojis'),
  v.literal('guessPercentage'),
  v.literal('circleCenter'),
  // Retained only so rounds and results created before the map games were retired remain valid.
  v.literal('guessDistance'),
  v.literal('pointOnMap'),
  v.literal('batteryPercentage')
);
const miniGameRoundStatus = v.union(v.literal('selecting'), v.literal('playing'), v.literal('results'));
const miniGameResultStatus = v.union(v.literal('waiting'), v.literal('finished'), v.literal('timedOut'));
const promptArcadePhase = v.union(
  v.literal('lobby'),
  v.literal('prompting'),
  v.literal('generating'),
  v.literal('countdown'),
  v.literal('playing'),
  v.literal('roundResults'),
  v.literal('complete')
);
const promptArcadeEntryStatus = v.union(
  v.literal('writing'),
  v.literal('queued'),
  v.literal('generating'),
  v.literal('validating'),
  v.literal('repairing'),
  v.literal('ready'),
  v.literal('needsRevision'),
  v.literal('withdrawn'),
  v.literal('played')
);
const promptArcadeScoringMode = v.union(v.literal('speed'), v.literal('quality'), v.literal('qualityAndSpeed'));
const promptArcadeRoundStatus = v.union(v.literal('countdown'), v.literal('playing'), v.literal('results'));
const promptArcadeResultStatus = v.union(v.literal('waiting'), v.literal('finished'), v.literal('timedOut'));
const miniGameEmojiColor = v.union(
  v.literal('orange'),
  v.literal('blue'),
  v.literal('green'),
  v.literal('pink'),
  v.literal('purple')
);
const miniGamePercentageColor = v.union(v.literal('coral'), v.literal('gold'), v.literal('mint'), v.literal('blue'));
const miniGameDistanceUnit = v.union(v.literal('kilometers'), v.literal('miles'));
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
    gameType: v.optional(gameTypeValidator),
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
    roomGameId: v.optional(v.id('roomGames')),
    trigger: v.optional(pollTrigger),
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

  doodleDashGameStates: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    phase: doodleDashPhase,
    currentRoundId: v.union(v.id('doodleDashRounds'), v.null()),
    currentTurnNumber: v.number(),
    totalTurns: v.number(),
    turnOrder: v.array(v.id('roomMembers')),
    configuredRoundCount: v.optional(v.number()),
    configuredDrawDurationMs: v.optional(v.number()),
    configuredCategories: v.optional(v.array(v.string())),
    phaseStartedAt: v.union(v.number(), v.null()),
    phaseEndsAt: v.union(v.number(), v.null()),
  }).index('by_roomId', ['roomId']),

  doodleDashRounds: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    turnNumber: v.number(),
    cycleNumber: v.number(),
    drawerMemberId: v.id('roomMembers'),
    drawerDisplayName: v.string(),
    wordOptions: v.array(v.object({ word: v.string(), category: v.string() })),
    selectedWord: v.union(v.string(), v.null()),
    selectedCategory: v.union(v.string(), v.null()),
    hintOrder: v.array(v.number()),
    revealedLetterCount: v.number(),
    status: doodleDashRoundStatus,
    choiceStartedAt: v.number(),
    drawStartedAt: v.union(v.number(), v.null()),
    drawEndsAt: v.union(v.number(), v.null()),
    revealedAt: v.union(v.number(), v.null()),
    eligibleGuesserCount: v.number(),
    correctGuessCount: v.number(),
    firstCorrectAt: v.union(v.number(), v.null()),
    nextStrokeSequence: v.number(),
  })
    .index('by_roomId_and_gameNumber_and_turnNumber', ['roomId', 'gameNumber', 'turnNumber'])
    .index('by_drawerMemberId', ['drawerMemberId']),

  doodleDashScores: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    memberId: v.id('roomMembers'),
    displayName: v.string(),
    totalPoints: v.number(),
    guessPoints: v.number(),
    drawPoints: v.number(),
    wordsGuessed: v.number(),
    drawingTurns: v.number(),
    correctGuessers: v.number(),
    updatedAt: v.number(),
  })
    .index('by_roomId_and_gameNumber', ['roomId', 'gameNumber'])
    .index('by_roomId_and_gameNumber_and_memberId', ['roomId', 'gameNumber', 'memberId']),

  doodleDashCorrectGuesses: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    roundId: v.id('doodleDashRounds'),
    memberId: v.id('roomMembers'),
    responseTimeMs: v.number(),
    guessPoints: v.number(),
    drawerPoints: v.number(),
    submittedAt: v.number(),
  })
    .index('by_roundId_and_memberId', ['roundId', 'memberId'])
    .index('by_roomId_and_gameNumber_and_memberId', ['roomId', 'gameNumber', 'memberId']),

  doodleDashMessages: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    roundId: v.id('doodleDashRounds'),
    memberId: v.id('roomMembers'),
    displayName: v.string(),
    kind: v.union(v.literal('guess'), v.literal('correct')),
    text: v.optional(v.string()),
    isClose: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_memberId', ['roundId', 'memberId']),

  doodleDashStrokes: defineTable({
    roomId: v.id('rooms'),
    roundId: v.id('doodleDashRounds'),
    sequence: v.number(),
    actionId: v.optional(v.string()),
    tool: v.union(v.literal('pen'), v.literal('eraser'), v.literal('fill')),
    color: v.string(),
    width: v.number(),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
    isUndone: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index('by_roundId_and_sequence', ['roundId', 'sequence'])
    .index('by_roundId_and_actionId', ['roundId', 'actionId'])
    .index('by_roundId_and_isUndone_and_sequence', ['roundId', 'isUndone', 'sequence']),

  doodleDashLiveStrokeChunks: defineTable({
    roomId: v.id('rooms'),
    roundId: v.id('doodleDashRounds'),
    actionId: v.string(),
    actionStartedAt: v.number(),
    chunkIndex: v.number(),
    tool: v.union(v.literal('pen'), v.literal('eraser')),
    color: v.string(),
    width: v.number(),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
    createdAt: v.number(),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_actionId_and_chunkIndex', ['roundId', 'actionId', 'chunkIndex']),

  triviaGameStates: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    phase: triviaPhase,
    currentQuestionNumber: v.number(),
    totalQuestions: v.number(),
    configuredCategories: v.optional(v.array(v.string())),
    configuredRoundCount: v.optional(v.number()),
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

  miniGamesGameStates: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    phase: miniGamesPhase,
    currentRoundId: v.union(v.id('miniGamesRounds'), v.null()),
    currentRoundNumber: v.number(),
    totalRounds: v.number(),
    configuredRoundCount: v.optional(v.number()),
    phaseStartedAt: v.union(v.number(), v.null()),
    phaseEndsAt: v.union(v.number(), v.null()),
    participantCount: v.number(),
    finishedCount: v.number(),
  }).index('by_roomId', ['roomId']),

  miniGamesRounds: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    roundNumber: v.number(),
    miniGameId,
    status: miniGameRoundStatus,
    selectionStartedAt: v.number(),
    playStartsAt: v.number(),
    playEndsAt: v.number(),
    resultsStartedAt: v.union(v.number(), v.null()),
    lineStartX: v.union(v.number(), v.null()),
    lineStartY: v.union(v.number(), v.null()),
    lineEndX: v.union(v.number(), v.null()),
    lineEndY: v.union(v.number(), v.null()),
    targetEmoji: v.optional(v.string()),
    emojiItems: v.array(
      v.object({
        id: v.string(),
        emoji: v.string(),
        color: miniGameEmojiColor,
        x: v.number(),
        y: v.number(),
        rotation: v.number(),
      })
    ),
    percentageTargetColor: v.optional(miniGamePercentageColor),
    percentageSegments: v.optional(v.array(v.object({ color: miniGamePercentageColor, percentage: v.number() }))),
    batteryPercentage: v.optional(v.number()),
    circleCenterX: v.optional(v.number()),
    circleCenterY: v.optional(v.number()),
    circleRadius: v.optional(v.number()),
    circleGapRotation: v.optional(v.number()),
    mapFirstName: v.optional(v.string()),
    mapFirstX: v.optional(v.number()),
    mapFirstY: v.optional(v.number()),
    mapSecondName: v.optional(v.string()),
    mapSecondX: v.optional(v.number()),
    mapSecondY: v.optional(v.number()),
    mapTargetName: v.optional(v.string()),
    mapTargetLatitude: v.optional(v.number()),
    mapTargetLongitude: v.optional(v.number()),
    mapTargetX: v.optional(v.number()),
    mapTargetY: v.optional(v.number()),
    distanceUnit: v.optional(miniGameDistanceUnit),
    numericAnswer: v.optional(v.number()),
  })
    .index('by_roomId_and_gameNumber_and_roundNumber', ['roomId', 'gameNumber', 'roundNumber'])
    .index('by_roomId_and_gameNumber', ['roomId', 'gameNumber']),

  miniGamesResults: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    roundNumber: v.number(),
    roundId: v.id('miniGamesRounds'),
    memberId: v.id('roomMembers'),
    displayName: v.string(),
    miniGameId,
    status: miniGameResultStatus,
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    timeMs: v.union(v.number(), v.null()),
    score: v.number(),
    straightness: v.union(v.number(), v.null()),
    correctClicks: v.number(),
    wrongClicks: v.number(),
    metric: v.optional(v.number()),
    numericGuess: v.optional(v.number()),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_memberId', ['roundId', 'memberId'])
    .index('by_roomId_and_gameNumber', ['roomId', 'gameNumber'])
    .index('by_roomId_and_gameNumber_and_memberId', ['roomId', 'gameNumber', 'memberId']),

  promptArcadeGameStates: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    phase: promptArcadePhase,
    currentRoundId: v.union(v.id('promptArcadeRounds'), v.null()),
    currentRoundNumber: v.number(),
    playlistStarted: v.boolean(),
    participantCount: v.number(),
    phaseStartedAt: v.union(v.number(), v.null()),
    phaseEndsAt: v.union(v.number(), v.null()),
  }).index('by_roomId', ['roomId']),

  promptArcadeEntries: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    memberId: v.id('roomMembers'),
    displayName: v.string(),
    prompt: v.union(v.string(), v.null()),
    status: promptArcadeEntryStatus,
    order: v.number(),
    attempt: v.number(),
    artifactId: v.union(v.id('promptArcadeArtifacts'), v.null()),
    errorMessage: v.union(v.string(), v.null()),
    submittedAt: v.union(v.number(), v.null()),
    readyAt: v.union(v.number(), v.null()),
    statusUpdatedAt: v.number(),
  })
    .index('by_roomId_and_gameNumber', ['roomId', 'gameNumber'])
    .index('by_roomId_and_gameNumber_and_memberId', ['roomId', 'gameNumber', 'memberId']),

  promptArcadeArtifacts: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    entryId: v.id('promptArcadeEntries'),
    memberId: v.id('roomMembers'),
    title: v.string(),
    interpretation: v.string(),
    instructions: v.string(),
    durationMs: v.number(),
    scoringMode: promptArcadeScoringMode,
    codeStorageId: v.id('_storage'),
    codeSha256: v.string(),
    model: v.string(),
    createdAt: v.number(),
  })
    .index('by_entryId', ['entryId'])
    .index('by_roomId_and_gameNumber', ['roomId', 'gameNumber']),

  promptArcadeRounds: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    roundNumber: v.number(),
    entryId: v.id('promptArcadeEntries'),
    artifactId: v.id('promptArcadeArtifacts'),
    status: promptArcadeRoundStatus,
    countdownStartedAt: v.number(),
    playStartsAt: v.number(),
    playEndsAt: v.number(),
    resultsStartedAt: v.union(v.number(), v.null()),
  })
    .index('by_roomId_and_gameNumber_and_roundNumber', ['roomId', 'gameNumber', 'roundNumber'])
    .index('by_artifactId', ['artifactId']),

  promptArcadeResults: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    roundNumber: v.number(),
    roundId: v.id('promptArcadeRounds'),
    memberId: v.id('roomMembers'),
    displayName: v.string(),
    status: promptArcadeResultStatus,
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    elapsedMs: v.union(v.number(), v.null()),
    quality: v.union(v.number(), v.null()),
    score: v.number(),
    metricLabel: v.union(v.string(), v.null()),
    metricValue: v.union(v.number(), v.null()),
  })
    .index('by_roundId', ['roundId'])
    .index('by_roundId_and_memberId', ['roundId', 'memberId'])
    .index('by_roomId_and_gameNumber', ['roomId', 'gameNumber'])
    .index('by_roomId_and_gameNumber_and_memberId', ['roomId', 'gameNumber', 'memberId']),

  promptArcadeScores: defineTable({
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    memberId: v.id('roomMembers'),
    displayName: v.string(),
    totalScore: v.number(),
    roundsFinished: v.number(),
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

  doodleDashPlaytestBotStates: defineTable({
    botId: v.id('playtestBots'),
    roomId: v.id('rooms'),
    plannedRoundId: v.union(v.id('doodleDashRounds'), v.null()),
    wordChoiceAt: v.number(),
    wordOptionIndex: v.number(),
    guessAt: v.number(),
    guessSubmitted: v.boolean(),
    drawingSeed: v.number(),
    strokeIndex: v.number(),
    pointIndex: v.number(),
    chunkIndex: v.number(),
    nextDrawAt: v.number(),
  }).index('by_botId', ['botId']),

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

  promptArcadePlaytestBotStates: defineTable({
    botId: v.id('playtestBots'),
    roomId: v.id('rooms'),
    gameNumber: v.number(),
    plannedRoundId: v.union(v.id('promptArcadeRounds'), v.null()),
    finishAt: v.number(),
    quality: v.number(),
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
