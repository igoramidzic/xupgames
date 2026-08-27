import type { Id } from '../../../../_generated/dataModel';
import type { MutationCtx } from '../../../../_generated/server';
import { fail } from '../../../../domain';
import { assertSubmissionOpen, recordResult } from '../../results';
import type { NormalizedPoint } from '../../shared';
import { findMiniGamesState, requireMiniGamesMember } from '../../state';
import { scoreMapPoint } from '.';

export async function submitMapPointHandler(
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
    round.miniGameId !== 'pointOnMap' ||
    round.mapTargetName === undefined ||
    round.mapTargetLatitude === undefined ||
    round.mapTargetLongitude === undefined ||
    round.mapTargetX === undefined ||
    round.mapTargetY === undefined
  ) {
    fail('INVALID_MINI_GAME_SUBMISSION', 'This round is not the map-point challenge.');
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
    fail('INVALID_MINI_GAME_SUBMISSION', 'Place your pin inside the map.');
  }
  const result = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
  if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your map pin is already locked in.');
  const scored = scoreMapPoint(
    {
      name: round.mapTargetName,
      latitude: round.mapTargetLatitude,
      longitude: round.mapTargetLongitude,
      x: round.mapTargetX,
      y: round.mapTargetY,
    },
    args.point
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
      submission: { kind: 'mapPoint', point: args.point },
    },
    now
  );
  return { ...recorded, errorKm: scored.error };
}
