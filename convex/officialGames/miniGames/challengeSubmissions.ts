import type { Infer } from 'convex/values';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { fail } from '../../domain';
import {
  scoreBrakeCheck,
  scoreCopycatSequence,
  scoreCrowdCount,
  scoreDropZone,
  scoreFlagFrenzy,
  scoreFlashbackTiles,
  scoreShadowMatch,
  scoreSignalSnap,
} from './games/newChallenges';
import { assertSubmissionOpen, recordResult } from './results';
import { findMiniGamesState, requireMiniGamesMember } from './state';
import type { challengeSubmissionValidator } from './validators';

type ChallengeSubmission = Infer<typeof challengeSubmissionValidator>;

function allNumbersInRange(values: number[], minimum: number, maximum: number) {
  return values.every((value) => Number.isFinite(value) && value >= minimum && value <= maximum);
}

function invalid(message = 'That answer is not valid for this challenge.'): never {
  fail('INVALID_MINI_GAME_SUBMISSION', message);
}

export async function submitChallengeHandler(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; sessionToken: string; submission: ChallengeSubmission }
) {
  const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
  const state = await findMiniGamesState(ctx, room._id);
  if (state === null || state.currentRoundId === null) fail('MINI_GAMES_NOT_RUNNING', 'No mini-game round is active.');
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (round === null || round.challengePayload === undefined || round.challengePayload.kind !== args.submission.kind) {
    invalid('This round does not accept that kind of answer.');
  }
  const now = Date.now();
  assertSubmissionOpen(state, round, now);
  const result = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
  if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your answer is already locked in.');
  const timeMs = Math.max(0, Math.min(10_000, now - result.startedAt));
  const challenge = round.challengePayload;
  const submission = args.submission;

  let scored: { score: number; correct?: number; wrong?: number };
  let challengeResult: NonNullable<Doc<'miniGamesResults'>['challengeResult']>;

  switch (submission.kind) {
    case 'flashbackTiles': {
      if (
        challenge.kind !== submission.kind ||
        submission.selectedTileIds.length > challenge.gridSize ** 2 ||
        new Set(submission.selectedTileIds).size !== submission.selectedTileIds.length ||
        !allNumbersInRange(submission.selectedTileIds, 0, challenge.gridSize ** 2 - 1)
      ) {
        invalid();
      }
      scored = scoreFlashbackTiles(challenge.targetTileIds, submission.selectedTileIds, timeMs);
      challengeResult = {
        kind: 'flashbackTiles',
        correct: scored.correct ?? 0,
        wrong: scored.wrong ?? 0,
        missed: challenge.targetTileIds.length - (scored.correct ?? 0),
      };
      break;
    }
    case 'copycatSequence': {
      if (
        challenge.kind !== submission.kind ||
        submission.padIds.length < 1 ||
        submission.padIds.length > challenge.sequence.length ||
        !allNumbersInRange(submission.padIds, 0, 3)
      ) {
        invalid();
      }
      const copycatScore = scoreCopycatSequence(challenge.sequence, submission.padIds, timeMs);
      scored = copycatScore;
      challengeResult = {
        kind: 'copycatSequence',
        correctPrefix: copycatScore.correctPrefix,
        sequenceLength: copycatScore.sequenceLength,
      };
      break;
    }
    case 'crowdCount': {
      if (
        challenge.kind !== submission.kind ||
        !Number.isInteger(submission.guess) ||
        !challenge.answerOptions.includes(submission.guess)
      ) {
        invalid();
      }
      const crowdScore = scoreCrowdCount(challenge.characters.length, submission.guess);
      scored = crowdScore;
      challengeResult = { kind: 'crowdCount', guess: submission.guess, error: crowdScore.error };
      break;
    }
    case 'dropZone': {
      if (
        challenge.kind !== submission.kind ||
        submission.releasePositions.length !== challenge.cycleDurationsMs.length ||
        !allNumbersInRange(submission.releasePositions, 0, 1)
      ) {
        invalid();
      }
      const dropScore = scoreDropZone(challenge.targetCenter, challenge.targetWidth, submission.releasePositions);
      scored = dropScore;
      challengeResult = {
        kind: 'dropZone',
        averageError: dropScore.averageError,
        perfectDrops: dropScore.perfectDrops,
      };
      break;
    }
    case 'shadowMatch': {
      if (
        challenge.kind !== submission.kind ||
        submission.selectedOptionIndices.length !== challenge.cards.length ||
        !submission.selectedOptionIndices.every(
          (option, index) =>
            Number.isInteger(option) && option >= 0 && option < (challenge.cards[index]?.options.length ?? 0)
        )
      ) {
        invalid();
      }
      scored = scoreShadowMatch(challenge.cards, submission.selectedOptionIndices, timeMs);
      challengeResult = { kind: 'shadowMatch', correct: scored.correct ?? 0, wrong: scored.wrong ?? 0 };
      break;
    }
    case 'flagFrenzy': {
      if (
        challenge.kind !== submission.kind ||
        submission.pressedPads.length !== challenge.signals.length ||
        !allNumbersInRange(submission.pressedPads, 0, 3)
      ) {
        invalid();
      }
      const flagScore = scoreFlagFrenzy(challenge.signals, submission.pressedPads);
      scored = flagScore;
      challengeResult = {
        kind: 'flagFrenzy',
        correct: flagScore.correct,
        wrong: flagScore.wrong,
        bestStreak: flagScore.bestStreak,
      };
      break;
    }
    case 'brakeCheck': {
      if (
        challenge.kind !== submission.kind ||
        submission.releaseValues.length !== challenge.targets.length ||
        !allNumbersInRange(submission.releaseValues, 0, 1)
      ) {
        invalid();
      }
      const brakeScore = scoreBrakeCheck(challenge.targets, submission.releaseValues);
      scored = brakeScore;
      challengeResult = {
        kind: 'brakeCheck',
        bestError: brakeScore.bestError,
        overshoots: brakeScore.overshoots,
      };
      break;
    }
    case 'signalSnap': {
      if (
        challenge.kind !== submission.kind ||
        submission.responseOffsetsMs.length !== challenge.cueOffsetsMs.length ||
        !submission.responseOffsetsMs.every(
          (offset) => Number.isFinite(offset) && (offset === -1 || (offset >= 0 && offset <= 10_000))
        )
      ) {
        invalid();
      }
      const signalScore = scoreSignalSnap(challenge.cueOffsetsMs, submission.responseOffsetsMs);
      scored = signalScore;
      challengeResult = {
        kind: 'signalSnap',
        medianMs: signalScore.medianMs,
        falseStarts: signalScore.falseStarts,
      };
      break;
    }
  }

  const recorded = await recordResult(
    ctx,
    state,
    round,
    result,
    {
      score: scored.score,
      straightness: null,
      correctClicks: scored.correct ?? 0,
      wrongClicks: scored.wrong ?? 0,
      challengeResult,
      submission,
    },
    now
  );
  return { ...recorded };
}
