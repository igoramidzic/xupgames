import { v } from 'convex/values';

export const promptArcadePhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('prompting'),
  v.literal('generating'),
  v.literal('countdown'),
  v.literal('playing'),
  v.literal('roundResults'),
  v.literal('complete')
);

export const promptArcadeEntryStatusValidator = v.union(
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

export const promptArcadeScoringModeValidator = v.union(
  v.literal('speed'),
  v.literal('quality'),
  v.literal('qualityAndSpeed')
);

export const promptArcadeRoundStatusValidator = v.union(
  v.literal('countdown'),
  v.literal('playing'),
  v.literal('results')
);

export const promptArcadeResultStatusValidator = v.union(
  v.literal('waiting'),
  v.literal('finished'),
  v.literal('timedOut')
);

export const promptArcadeGeneratedArtifactValidator = v.object({
  title: v.string(),
  interpretation: v.string(),
  instructions: v.string(),
  durationMs: v.number(),
  scoringMode: promptArcadeScoringModeValidator,
  code: v.string(),
});

export const promptArcadeEntryViewValidator = v.object({
  entryId: v.id('promptArcadeEntries'),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  prompt: v.union(v.string(), v.null()),
  status: promptArcadeEntryStatusValidator,
  order: v.number(),
  attempt: v.number(),
  errorMessage: v.union(v.string(), v.null()),
  submittedAt: v.union(v.number(), v.null()),
  readyAt: v.union(v.number(), v.null()),
  statusUpdatedAt: v.number(),
  retryAvailableAt: v.union(v.number(), v.null()),
  artifactTitle: v.union(v.string(), v.null()),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});

export const promptArcadeResultViewValidator = v.object({
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  status: promptArcadeResultStatusValidator,
  quality: v.union(v.number(), v.null()),
  elapsedMs: v.union(v.number(), v.null()),
  score: v.number(),
  metricLabel: v.union(v.string(), v.null()),
  metricValue: v.union(v.number(), v.null()),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});

export const promptArcadeStandingValidator = v.object({
  rank: v.number(),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  totalScore: v.number(),
  creatorBonus: v.number(),
  roundsFinished: v.number(),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});

export const promptArcadeGameRankingValidator = v.object({
  rank: v.number(),
  entryId: v.id('promptArcadeEntries'),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  title: v.string(),
  interpretation: v.string(),
  averageRating: v.union(v.number(), v.null()),
  ratingCount: v.number(),
  isWinner: v.boolean(),
  creatorBonus: v.number(),
  isCurrentPlayer: v.boolean(),
});

const generationSummaryValidator = v.object({
  total: v.number(),
  writing: v.number(),
  queued: v.number(),
  generating: v.number(),
  validating: v.number(),
  repairing: v.number(),
  ready: v.number(),
  needsRevision: v.number(),
  withdrawn: v.number(),
  played: v.number(),
});

export const promptArcadeGameViewValidator = v.object({
  gameNumber: v.number(),
  phase: promptArcadePhaseValidator,
  phaseStartedAt: v.union(v.number(), v.null()),
  phaseEndsAt: v.union(v.number(), v.null()),
  currentRoundNumber: v.number(),
  participantCount: v.number(),
  requiredReadyCount: v.number(),
  playlistStarted: v.boolean(),
  isOwner: v.boolean(),
  canStartPlaylist: v.boolean(),
  summary: generationSummaryValidator,
  entries: v.array(promptArcadeEntryViewValidator),
  round: v.union(
    v.null(),
    v.object({
      roundId: v.id('promptArcadeRounds'),
      roundNumber: v.number(),
      status: promptArcadeRoundStatusValidator,
      countdownStartedAt: v.number(),
      playStartsAt: v.number(),
      playEndsAt: v.number(),
      resultsStartedAt: v.union(v.number(), v.null()),
      entry: v.object({
        entryId: v.id('promptArcadeEntries'),
        memberId: v.id('roomMembers'),
        displayName: v.string(),
        prompt: v.string(),
      }),
      artifact: v.object({
        artifactId: v.id('promptArcadeArtifacts'),
        title: v.string(),
        interpretation: v.string(),
        instructions: v.string(),
        durationMs: v.number(),
        scoringMode: promptArcadeScoringModeValidator,
        codeUrl: v.union(v.string(), v.null()),
      }),
    })
  ),
  currentResult: v.union(v.null(), promptArcadeResultViewValidator),
  roundResults: v.array(promptArcadeResultViewValidator),
  currentGameRating: v.object({
    rating: v.union(v.number(), v.null()),
    canRate: v.boolean(),
    ratingCount: v.number(),
    eligibleRaterCount: v.number(),
  }),
  gameRankings: v.array(promptArcadeGameRankingValidator),
  standings: v.array(promptArcadeStandingValidator),
});
