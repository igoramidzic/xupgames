import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { fail } from '../../domain';
import { scoreBatteryEstimate } from './games/batteryPercentage';
// Legacy scoring path for distance rounds created before the challenge was retired.
import { scoreDistanceEstimate } from './games/guessDistance';
import { scorePercentageEstimate } from './games/guessPercentage';
import { assertSubmissionOpen, recordResult } from './results';
import { MINI_GAMES_ROUND_MS } from './shared';
import { findMiniGamesState, requireMiniGamesMember } from './state';

export async function submitEstimateHandler(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; sessionToken: string; guess: number }
) {
  const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
  const state = await findMiniGamesState(ctx, room._id);
  if (state === null || state.currentRoundId === null) {
    fail('MINI_GAMES_NOT_RUNNING', 'No mini-game round is active.');
  }
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (
    round === null ||
    (round.miniGameId !== 'guessPercentage' &&
      round.miniGameId !== 'guessDistance' &&
      round.miniGameId !== 'batteryPercentage')
  ) {
    fail('INVALID_MINI_GAME_SUBMISSION', 'This round does not accept a numeric estimate.');
  }
  const now = Date.now();
  assertSubmissionOpen(state, round, now);
  const maximum = round.miniGameId === 'guessDistance' ? 25_000 : 100;
  if (!Number.isFinite(args.guess) || args.guess < 0 || args.guess > maximum || round.numericAnswer === undefined) {
    fail('INVALID_MINI_GAME_SUBMISSION', `Enter an estimate from 0 to ${maximum.toLocaleString()}.`);
  }
  const result = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
  if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your estimate is already locked in.');
  const timeMs = Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt));
  const scored =
    round.miniGameId === 'guessDistance'
      ? scoreDistanceEstimate(round.numericAnswer, args.guess, timeMs)
      : round.miniGameId === 'batteryPercentage'
        ? scoreBatteryEstimate(round.numericAnswer, args.guess, timeMs)
        : scorePercentageEstimate(round.numericAnswer, args.guess, timeMs);
  const recorded = await recordResult(
    ctx,
    state,
    round,
    result,
    {
      score: scored.score,
      straightness: null,
      correctClicks: 0,
      wrongClicks: 0,
      metric: scored.error,
      numericGuess: args.guess,
    },
    now
  );
  return { ...recorded, error: scored.error };
}
