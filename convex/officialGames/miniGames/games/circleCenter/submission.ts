import type { Id } from '../../../../_generated/dataModel';
import type { MutationCtx } from '../../../../_generated/server';
import { fail } from '../../../../domain';
import { assertSubmissionOpen, recordResult } from '../../results';
import { MINI_GAMES_ROUND_MS, type NormalizedPoint } from '../../shared';
import { findMiniGamesState, requireMiniGamesMember } from '../../state';
import { scoreCircleCenter } from '.';

export async function submitCircleCenterHandler(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; sessionToken: string; point: NormalizedPoint }
) {
  const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
  const state = await findMiniGamesState(ctx, room._id);
  if (state === null || state.currentRoundId === null) {
    fail('MINI_GAMES_NOT_RUNNING', 'No mini-game round is active.');
  }
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (
    round === null ||
    round.miniGameId !== 'circleCenter' ||
    round.circleCenterX === undefined ||
    round.circleCenterY === undefined ||
    round.circleRadius === undefined
  ) {
    fail('INVALID_MINI_GAME_SUBMISSION', 'This round is not the circle-center challenge.');
  }
  const now = Date.now();
  assertSubmissionOpen(state, round, now);
  if (
    !Number.isFinite(args.point.x) ||
    !Number.isFinite(args.point.y) ||
    args.point.x < 0 ||
    args.point.x > 1 ||
    args.point.y < 0 ||
    args.point.y > 1
  ) {
    fail('INVALID_MINI_GAME_SUBMISSION', 'Place your marker inside the board.');
  }
  const result = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
  if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your center point is already locked in.');
  const timeMs = Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt));
  const scored = scoreCircleCenter(
    { x: round.circleCenterX, y: round.circleCenterY },
    round.circleRadius,
    args.point,
    timeMs
  );
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
      submission: { kind: 'circleCenter', point: args.point },
    },
    now
  );
  return { ...recorded, error: scored.error };
}
