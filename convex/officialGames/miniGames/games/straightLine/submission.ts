import type { Id } from '../../../../_generated/dataModel';
import type { MutationCtx } from '../../../../_generated/server';
import { fail } from '../../../../domain';
import { assertSubmissionOpen, recordResult } from '../../results';
import { MINI_GAMES_ROUND_MS } from '../../shared';
import { findMiniGamesState, requireMiniGamesMember } from '../../state';
import { scoreStraightLine } from '.';

export async function submitStraightLineHandler(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; sessionToken: string; points: Array<{ x: number; y: number }> }
) {
  const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
  const state = await findMiniGamesState(ctx, room._id);
  if (state === null || state.currentRoundId === null) {
    fail('MINI_GAMES_NOT_RUNNING', 'No mini-game round is active.');
  }
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (round === null || round.miniGameId !== 'straightLine') {
    fail('INVALID_MINI_GAME_SUBMISSION', 'This round is not the straight-line challenge.');
  }
  const now = Date.now();
  assertSubmissionOpen(state, round, now);
  if (
    args.points.length < 2 ||
    args.points.length > 300 ||
    args.points.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1
    ) ||
    round.lineStartX === null ||
    round.lineStartY === null ||
    round.lineEndX === null ||
    round.lineEndY === null
  ) {
    fail('INVALID_MINI_GAME_SUBMISSION', 'Draw one complete line from start to finish.');
  }
  const result = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
  if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your line is already locked in.');
  const timeMs = Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt));
  const scored = scoreStraightLine(
    args.points,
    { x: round.lineStartX, y: round.lineStartY },
    { x: round.lineEndX, y: round.lineEndY },
    timeMs
  );
  const recorded = await recordResult(
    ctx,
    state,
    round,
    result,
    { score: scored.score, straightness: scored.straightness, correctClicks: 0, wrongClicks: 0 },
    now
  );
  return { ...recorded, straightness: scored.straightness };
}
