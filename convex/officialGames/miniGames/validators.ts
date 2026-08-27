import { v } from 'convex/values';

export const miniGameIdValidator = v.union(
  v.literal('straightLine'),
  v.literal('orangeEmojis'),
  v.literal('guessPercentage'),
  v.literal('circleCenter'),
  v.literal('batteryPercentage'),
  v.literal('flashbackTiles'),
  v.literal('copycatSequence'),
  v.literal('crowdCount'),
  v.literal('dropZone'),
  v.literal('shadowMatch'),
  v.literal('flagFrenzy'),
  v.literal('brakeCheck'),
  v.literal('signalSnap')
);

export const miniGamesPhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('selecting'),
  v.literal('playing'),
  v.literal('roundResults'),
  v.literal('complete')
);

export const resultStatusValidator = v.union(v.literal('waiting'), v.literal('finished'), v.literal('timedOut'));
export const emojiColorValidator = v.union(
  v.literal('orange'),
  v.literal('blue'),
  v.literal('green'),
  v.literal('pink'),
  v.literal('purple')
);
export const emojiItemValidator = v.object({
  id: v.string(),
  emoji: v.string(),
  color: emojiColorValidator,
  x: v.number(),
  y: v.number(),
  rotation: v.number(),
});
export const percentageColorValidator = v.union(
  v.literal('coral'),
  v.literal('gold'),
  v.literal('mint'),
  v.literal('blue')
);
export const percentageSegmentValidator = v.object({ color: percentageColorValidator, percentage: v.number() });
export const mapPlaceValidator = v.object({ name: v.string(), x: v.number(), y: v.number() });
export const pointValidator = v.object({ x: v.number(), y: v.number() });

export const challengePayloadValidator = v.union(
  v.object({
    kind: v.literal('flashbackTiles'),
    gridSize: v.number(),
    targetTileIds: v.array(v.number()),
    revealDurationMs: v.number(),
  }),
  v.object({
    kind: v.literal('copycatSequence'),
    sequence: v.array(v.number()),
    playbackStepMs: v.number(),
  }),
  v.object({
    kind: v.literal('crowdCount'),
    characters: v.array(
      v.object({
        id: v.string(),
        lane: v.number(),
        delayMs: v.number(),
        durationMs: v.number(),
        direction: v.number(),
        symbol: v.string(),
      })
    ),
    answerOptions: v.array(v.number()),
  }),
  v.object({
    kind: v.literal('dropZone'),
    targetCenter: v.number(),
    targetWidth: v.number(),
    cycleDurationsMs: v.array(v.number()),
  }),
  v.object({
    kind: v.literal('shadowMatch'),
    cards: v.array(v.object({ targetShape: v.string(), options: v.array(v.string()) })),
  }),
  v.object({
    kind: v.literal('flagFrenzy'),
    signals: v.array(v.number()),
    signalDurationMs: v.number(),
  }),
  v.object({
    kind: v.literal('brakeCheck'),
    targets: v.array(v.number()),
    fillDurationMs: v.number(),
  }),
  v.object({
    kind: v.literal('signalSnap'),
    cueOffsetsMs: v.array(v.number()),
  })
);

export const challengeSubmissionValidator = v.union(
  v.object({ kind: v.literal('flashbackTiles'), selectedTileIds: v.array(v.number()) }),
  v.object({ kind: v.literal('copycatSequence'), padIds: v.array(v.number()) }),
  v.object({ kind: v.literal('crowdCount'), guess: v.number() }),
  v.object({ kind: v.literal('dropZone'), releasePositions: v.array(v.number()) }),
  v.object({ kind: v.literal('shadowMatch'), selectedOptionIndices: v.array(v.number()) }),
  v.object({ kind: v.literal('flagFrenzy'), pressedPads: v.array(v.number()) }),
  v.object({ kind: v.literal('brakeCheck'), releaseValues: v.array(v.number()) }),
  v.object({ kind: v.literal('signalSnap'), responseOffsetsMs: v.array(v.number()) })
);

export const resultSubmissionValidator = v.union(
  v.object({ kind: v.literal('straightLine'), points: v.array(pointValidator) }),
  v.object({ kind: v.literal('orangeEmojis'), clickedIds: v.array(v.string()) }),
  v.object({ kind: v.literal('numericEstimate'), guess: v.number() }),
  v.object({ kind: v.literal('circleCenter'), point: pointValidator }),
  v.object({ kind: v.literal('mapPoint'), point: pointValidator }),
  challengeSubmissionValidator
);

export const challengeResultValidator = v.union(
  v.object({ kind: v.literal('flashbackTiles'), correct: v.number(), wrong: v.number(), missed: v.number() }),
  v.object({ kind: v.literal('copycatSequence'), correctPrefix: v.number(), sequenceLength: v.number() }),
  v.object({ kind: v.literal('crowdCount'), guess: v.number(), error: v.number() }),
  v.object({ kind: v.literal('dropZone'), averageError: v.number(), perfectDrops: v.number() }),
  v.object({ kind: v.literal('shadowMatch'), correct: v.number(), wrong: v.number() }),
  v.object({ kind: v.literal('flagFrenzy'), correct: v.number(), wrong: v.number(), bestStreak: v.number() }),
  v.object({ kind: v.literal('brakeCheck'), bestError: v.number(), overshoots: v.number() }),
  v.object({ kind: v.literal('signalSnap'), medianMs: v.union(v.number(), v.null()), falseStarts: v.number() })
);

export const resultViewValidator = v.object({
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  status: resultStatusValidator,
  score: v.number(),
  timeMs: v.union(v.number(), v.null()),
  straightness: v.union(v.number(), v.null()),
  correctClicks: v.number(),
  wrongClicks: v.number(),
  metric: v.union(v.number(), v.null()),
  numericGuess: v.union(v.number(), v.null()),
  challengeResult: v.union(challengeResultValidator, v.null()),
  submission: v.union(resultSubmissionValidator, v.null()),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});

export const standingValidator = v.object({
  rank: v.number(),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  totalScore: v.number(),
  roundsFinished: v.number(),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});

export const miniGameDefinitionValidator = v.object({
  id: miniGameIdValidator,
  title: v.string(),
  eyebrow: v.string(),
  instructions: v.string(),
});

export const gameViewValidator = v.object({
  gameNumber: v.number(),
  phase: miniGamesPhaseValidator,
  phaseStartedAt: v.union(v.number(), v.null()),
  phaseEndsAt: v.union(v.number(), v.null()),
  currentRoundNumber: v.number(),
  totalRounds: v.number(),
  participantCount: v.number(),
  finishedCount: v.number(),
  estimatedDurationMs: v.number(),
  configuration: v.object({
    roundCount: v.number(),
    roundOptions: v.array(v.object({ roundCount: v.number(), estimatedDurationMs: v.number() })),
  }),
  miniGames: v.array(miniGameDefinitionValidator),
  round: v.union(
    v.null(),
    v.object({
      roundId: v.id('miniGamesRounds'),
      roundNumber: v.number(),
      miniGame: miniGameDefinitionValidator,
      selectionStartedAt: v.number(),
      playStartsAt: v.number(),
      playEndsAt: v.number(),
      lineTarget: v.union(
        v.null(),
        v.object({
          start: pointValidator,
          end: pointValidator,
        })
      ),
      emojiItems: v.array(emojiItemValidator),
      targetEmoji: v.union(v.string(), v.null()),
      targetCount: v.number(),
      percentageTargetColor: v.union(percentageColorValidator, v.null()),
      percentageSegments: v.array(percentageSegmentValidator),
      batteryPercentage: v.union(v.number(), v.null()),
      circleTarget: v.union(
        v.null(),
        v.object({ center: pointValidator, radius: v.number(), gapRotation: v.number() })
      ),
      distancePlaces: v.union(
        v.null(),
        v.object({
          first: mapPlaceValidator,
          second: mapPlaceValidator,
          unit: v.union(v.literal('kilometers'), v.literal('miles')),
        })
      ),
      mapTargetName: v.union(v.string(), v.null()),
      mapAnswerPoint: v.union(pointValidator, v.null()),
      numericAnswer: v.union(v.number(), v.null()),
      challengePayload: v.union(challengePayloadValidator, v.null()),
    })
  ),
  currentResult: v.union(v.null(), resultViewValidator),
  roundResults: v.array(resultViewValidator),
  standings: v.array(standingValidator),
});
