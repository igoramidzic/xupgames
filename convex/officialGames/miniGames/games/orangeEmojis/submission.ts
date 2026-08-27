import type { Id } from '../../../../_generated/dataModel';
import type { MutationCtx } from '../../../../_generated/server';
import { fail } from '../../../../domain';
import { assertSubmissionOpen, recordResult } from '../../results';
import { MINI_GAMES_ROUND_MS } from '../../shared';
import { findMiniGamesState, requireMiniGamesMember } from '../../state';
import { scoreFindEmoji } from '.';

export async function submitOrangeEmojisHandler(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; sessionToken: string; clickedIds: string[] }
) {
  const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
  const state = await findMiniGamesState(ctx, room._id);
  if (state === null || state.currentRoundId === null) {
    fail('MINI_GAMES_NOT_RUNNING', 'No mini-game round is active.');
  }
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (round === null || round.miniGameId !== 'orangeEmojis') {
    fail('INVALID_MINI_GAME_SUBMISSION', 'This round is not the matching-emoji challenge.');
  }
  const now = Date.now();
  assertSubmissionOpen(state, round, now);
  const result = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
  if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your emoji picks are already locked in.');
  const clickedIds = new Set(args.clickedIds);
  const itemIds = new Set(round.emojiItems.map((item) => item.id));
  const targetEmoji = round.targetEmoji ?? round.emojiItems.find((item) => item.color === 'orange')?.emoji ?? '🍊';
  const targetIds = round.emojiItems.filter((item) => item.emoji === targetEmoji).map((item) => item.id);
  if (
    clickedIds.size !== args.clickedIds.length ||
    args.clickedIds.length > round.emojiItems.length ||
    args.clickedIds.some((id) => !itemIds.has(id)) ||
    targetIds.some((id) => !clickedIds.has(id))
  ) {
    fail('INVALID_MINI_GAME_SUBMISSION', 'Click every copy of the target emoji before locking in your picks.');
  }
  const wrongClicks = args.clickedIds.filter((id) => !targetIds.includes(id)).length;
  const timeMs = Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt));
  const scored = scoreFindEmoji(targetIds.length, wrongClicks, timeMs);
  const recorded = await recordResult(
    ctx,
    state,
    round,
    result,
    {
      score: scored.score,
      straightness: null,
      correctClicks: targetIds.length,
      wrongClicks,
      submission: { kind: 'orangeEmojis', clickedIds: args.clickedIds },
    },
    now
  );
  return { ...recorded, accuracy: scored.accuracy };
}
