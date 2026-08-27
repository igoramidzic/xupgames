import { v } from 'convex/values';

export const miniGameIdValidator = v.union(
  v.literal('straightLine'),
  v.literal('orangeEmojis'),
  v.literal('guessPercentage'),
  v.literal('circleCenter'),
  v.literal('guessDistance'),
  v.literal('pointOnMap'),
  v.literal('batteryPercentage')
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
    })
  ),
  currentResult: v.union(v.null(), resultViewValidator),
  roundResults: v.array(resultViewValidator),
  standings: v.array(standingValidator),
});
