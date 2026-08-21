import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { findTriviaGameState, findTriviaRound, recordTriviaAnswer } from '../triviaEngine';

const OPTION_COUNT = 4;
const MIN_REACTION_MS = 1_100;
const REACTION_WINDOW_MS = 7_000;
const MAX_REACTION_MS = 12_000;

export type TriviaBotPlan = {
  answerAt: number;
  selectedOptionIndex: number;
};

export function buildTriviaBotPlan(
  round: Pick<Doc<'triviaRounds'>, 'correctOptionIndex'>,
  now: number,
  botNumber: number,
  random: () => number = Math.random
): TriviaBotPlan {
  const skillBand = (((botNumber - 1) % 5) + 5) % 5;
  const accuracyChance = Math.min(0.82, 0.5 + skillBand * 0.08);
  const isCorrect = random() < accuracyChance;
  const selectedOptionIndex = isCorrect
    ? round.correctOptionIndex
    : (round.correctOptionIndex + 1 + Math.floor(random() * (OPTION_COUNT - 1))) % OPTION_COUNT;
  const reactionMs = Math.min(
    MAX_REACTION_MS,
    MIN_REACTION_MS + Math.floor(random() * REACTION_WINDOW_MS) + ((botNumber * 173) % 650)
  );
  return { answerAt: now + reactionMs, selectedOptionIndex };
}

export async function initializeTriviaBot(
  ctx: MutationCtx,
  bot: Doc<'playtestBots'>
): Promise<Doc<'triviaPlaytestBotStates'>> {
  const existing = await ctx.db
    .query('triviaPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (existing !== null) {
    return existing;
  }

  const stateId = await ctx.db.insert('triviaPlaytestBotStates', {
    botId: bot._id,
    roomId: bot.roomId,
    plannedRoundId: null,
    answerAt: 0,
    selectedOptionIndex: 0,
    submitted: false,
  });
  const state = await ctx.db.get('triviaPlaytestBotStates', stateId);
  if (state === null) {
    throw new Error('Trivia bot state could not be loaded.');
  }
  return state;
}

export async function runTriviaBotTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>
): Promise<{ cursor: { x: number; y: number } }> {
  const cursor = { x: 0.5, y: 0.5 };
  const botState = await initializeTriviaBot(ctx, bot);
  const gameState = await findTriviaGameState(ctx, room._id);
  if (gameState === null || gameState.phase !== 'question' || gameState.currentQuestionNumber < 1) {
    return { cursor };
  }

  const round = await findTriviaRound(ctx, room._id, gameState.gameNumber, gameState.currentQuestionNumber);
  if (round === null) {
    throw new Error('Current trivia round is missing for playtest bot.');
  }
  const now = Date.now();
  if (botState.plannedRoundId !== round._id) {
    const plan = buildTriviaBotPlan(round, now, bot.botNumber);
    await ctx.db.patch('triviaPlaytestBotStates', botState._id, {
      plannedRoundId: round._id,
      answerAt: plan.answerAt,
      selectedOptionIndex: plan.selectedOptionIndex,
      submitted: false,
    });
    return { cursor };
  }
  if (botState.submitted || now < botState.answerAt) {
    return { cursor };
  }

  const membership = await ctx.db.get('roomMembers', bot.memberId);
  if (membership === null || !membership.isActive) {
    return { cursor };
  }
  const result = await recordTriviaAnswer(ctx, room, membership, botState.selectedOptionIndex, now);
  if (result.kind === 'accepted' || result.kind === 'existing') {
    await ctx.db.patch('triviaPlaytestBotStates', botState._id, { submitted: true });
  }
  return { cursor };
}

export async function stopTriviaBot(ctx: MutationCtx, bot: Doc<'playtestBots'>): Promise<void> {
  const state = await ctx.db
    .query('triviaPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (state !== null) {
    await ctx.db.patch('triviaPlaytestBotStates', state._id, { submitted: true });
  }
}
