import { internal } from '../../_generated/api';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { completeCurrentRoomGame } from '../../roomGames';
import { listActiveRoomMembers } from '../../roomMembers';
import { createBatteryChallenge } from './games/batteryPercentage';
import { createCircleChallenge } from './games/circleCenter';
import { createPercentageChallenge } from './games/guessPercentage';
import { createEmojiChallenge } from './games/orangeEmojis';
import { createStraightLineTarget } from './games/straightLine';
import { chooseMiniGame } from './registry';
import { showRoundResults } from './results';
import { MINI_GAMES_ROUND_MS, MINI_GAMES_SELECTION_MS } from './shared';
import { insertRoundParticipant } from './state';

export async function createRound(
  ctx: MutationCtx,
  state: Doc<'miniGamesGameStates'>,
  roundNumber: number,
  previousMiniGameId: string | null,
  now: number
) {
  const miniGameId = chooseMiniGame(previousMiniGameId);
  const lineTarget = miniGameId === 'straightLine' ? createStraightLineTarget() : null;
  const emojiChallenge = miniGameId === 'orangeEmojis' ? createEmojiChallenge() : null;
  const percentageChallenge = miniGameId === 'guessPercentage' ? createPercentageChallenge() : null;
  const circleChallenge = miniGameId === 'circleCenter' ? createCircleChallenge() : null;
  const batteryPercentage = miniGameId === 'batteryPercentage' ? createBatteryChallenge() : null;
  const percentageAnswer =
    percentageChallenge?.segments.find((segment) => segment.color === percentageChallenge.targetColor)?.percentage ??
    null;
  const numericAnswer = percentageAnswer ?? batteryPercentage;
  const playStartsAt = now + MINI_GAMES_SELECTION_MS;
  const playEndsAt = playStartsAt + MINI_GAMES_ROUND_MS;
  const roundId = await ctx.db.insert('miniGamesRounds', {
    roomId: state.roomId,
    gameNumber: state.gameNumber,
    roundNumber,
    miniGameId,
    status: 'selecting',
    selectionStartedAt: now,
    playStartsAt,
    playEndsAt,
    resultsStartedAt: null,
    lineStartX: lineTarget?.start.x ?? null,
    lineStartY: lineTarget?.start.y ?? null,
    lineEndX: lineTarget?.end.x ?? null,
    lineEndY: lineTarget?.end.y ?? null,
    ...(emojiChallenge === null ? {} : { targetEmoji: emojiChallenge.targetEmoji }),
    emojiItems: emojiChallenge?.items ?? [],
    ...(percentageChallenge === null
      ? {}
      : {
          percentageTargetColor: percentageChallenge.targetColor,
          percentageSegments: percentageChallenge.segments,
        }),
    ...(batteryPercentage === null ? {} : { batteryPercentage }),
    ...(circleChallenge === null
      ? {}
      : {
          circleCenterX: circleChallenge.center.x,
          circleCenterY: circleChallenge.center.y,
          circleRadius: circleChallenge.radius,
          circleGapRotation: circleChallenge.gapRotation,
        }),
    ...(numericAnswer === null ? {} : { numericAnswer }),
  });
  const round = await ctx.db.get('miniGamesRounds', roundId);
  if (round === null) throw new Error('The mini-game round could not be created.');
  const participants = await listActiveRoomMembers(ctx, state.roomId);
  for (const participant of participants) {
    await insertRoundParticipant(ctx, state.roomId, state.gameNumber, round, participant, playStartsAt);
  }
  await ctx.scheduler.runAfter(MINI_GAMES_SELECTION_MS, internal.miniGames.beginRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber,
  });
  await ctx.scheduler.runAfter(MINI_GAMES_SELECTION_MS + MINI_GAMES_ROUND_MS, internal.miniGames.finalizeRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber,
  });
  return { round, miniGameId, participantCount: participants.length };
}

type RoundScheduleArgs = {
  stateId: Id<'miniGamesGameStates'>;
  gameNumber: number;
  roundNumber: number;
};

export async function beginRoundHandler(ctx: MutationCtx, args: RoundScheduleArgs) {
  const state = await ctx.db.get('miniGamesGameStates', args.stateId);
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.currentRoundNumber !== args.roundNumber ||
    state.currentRoundId === null ||
    state.phase !== 'selecting'
  ) {
    return null;
  }
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (round === null || round.roundNumber !== args.roundNumber) return null;
  const now = Date.now();
  await ctx.db.patch('miniGamesRounds', round._id, { status: 'playing' });
  await ctx.db.patch('miniGamesGameStates', state._id, {
    phase: 'playing',
    phaseStartedAt: now,
    phaseEndsAt: round.playEndsAt,
  });
  return null;
}

export async function finalizeRoundHandler(ctx: MutationCtx, args: RoundScheduleArgs) {
  const state = await ctx.db.get('miniGamesGameStates', args.stateId);
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.currentRoundNumber !== args.roundNumber ||
    state.currentRoundId === null ||
    (state.phase !== 'selecting' && state.phase !== 'playing')
  ) {
    return null;
  }
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (round === null || round.roundNumber !== args.roundNumber) return null;
  await showRoundResults(ctx, state, round, Date.now());
  return null;
}

export async function advanceRoundHandler(ctx: MutationCtx, args: RoundScheduleArgs) {
  const state = await ctx.db.get('miniGamesGameStates', args.stateId);
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.currentRoundNumber !== args.roundNumber ||
    state.currentRoundId === null ||
    state.phase !== 'roundResults'
  ) {
    return null;
  }
  const currentRound = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (currentRound === null) return null;
  const now = Date.now();
  if (state.currentRoundNumber >= state.totalRounds) {
    await ctx.db.patch('miniGamesGameStates', state._id, {
      phase: 'complete',
      phaseStartedAt: now,
      phaseEndsAt: null,
    });
    const room = await ctx.db.get('rooms', state.roomId);
    if (room !== null) await completeCurrentRoomGame(ctx, room, 'miniGames', now);
    return null;
  }
  const nextRoundNumber = state.currentRoundNumber + 1;
  const { round, participantCount } = await createRound(ctx, state, nextRoundNumber, currentRound.miniGameId, now);
  await ctx.db.patch('miniGamesGameStates', state._id, {
    phase: 'selecting',
    currentRoundId: round._id,
    currentRoundNumber: nextRoundNumber,
    phaseStartedAt: now,
    phaseEndsAt: round.playStartsAt,
    participantCount,
    finishedCount: 0,
  });
  return null;
}
