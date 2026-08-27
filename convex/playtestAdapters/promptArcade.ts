import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { queuePromptArcadeBotPrompt } from '../officialGames/promptArcade/game';
import { enrollPromptArcadePlaytestBot } from '../officialGames/promptArcade/lifecycle';
import { recordPromptArcadeRating } from '../officialGames/promptArcade/ratings';
import { recordPromptArcadeResult, startReadyPromptArcadePlaylist } from '../officialGames/promptArcade/rounds';
import { findPromptArcadeEntry, findPromptArcadeState } from '../officialGames/promptArcade/state';

const THEMES = [
  'a moonlit rooftop garden',
  'a tiny robot repair shop',
  'a neon deep-sea research lab',
  'a runaway dessert cart',
  'a cloud city mailroom',
  'an enchanted train station',
  'a cozy haunted library',
  'a miniature spaceport',
] as const;

const MECHANICS = [
  'tap drifting targets in the correct order',
  'steer a character through moving gates',
  'sort fast-moving objects into matching zones',
  'memorize and repeat a growing visual pattern',
  'balance a wobbling object while collecting tokens',
  'drag scattered pieces into a matching silhouette',
  'defend a center point by clicking incoming hazards',
  'trace a changing path without touching its edges',
] as const;

const TWISTS = [
  'The controls briefly reverse after every third success.',
  'A harmless decoy appears whenever the player builds a streak.',
  'The playfield slowly rotates, but all instructions stay upright.',
  'Targets shrink after correct actions and recover after a miss.',
  'The safest route changes color every few seconds.',
  'A combo meter rewards several accurate actions in a row.',
  'One moving obstacle freezes whenever the player pauses.',
  'The final objective moves faster than the earlier ones.',
] as const;

const WINNING_CRITERIA = [
  'Reach 12 points before time expires; a wrong action removes 1 point.',
  'Complete 8 correct actions with at least 75% accuracy.',
  'Survive for 18 seconds with at least one of three lives remaining.',
  'Build a streak of 6 correct actions; a mistake resets only the streak.',
  'Collect 10 goal items before making 4 mistakes.',
  'Finish all 5 stages, with each stage requiring one more correct action than the last.',
  'Fill a progress meter to 100%; accurate actions add progress and misses subtract a smaller amount.',
  'Complete the objective in under 20 seconds, with faster clean runs receiving higher quality.',
] as const;
const MAX_BOT_GENERATION_ATTEMPTS = 3;

function seededRandom(...values: number[]) {
  let seed = values.reduce((current, value) => Math.imul(current ^ value, 0x45d9f3b), 0x9e3779b9) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(values: readonly T[], random: () => number): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error('Prompt Arcade bot prompt catalog is empty.');
  return value;
}

export function buildPromptArcadeBotPrompt(botNumber: number, gameNumber: number, attempt: number): string {
  const random = seededRandom(botNumber, gameNumber, attempt);
  return [
    `Create a quick game set in ${pick(THEMES, random)} where the player must ${pick(MECHANICS, random)}.`,
    pick(TWISTS, random),
    `Winning criteria: ${pick(WINNING_CRITERIA, random)}`,
    'Make the goal measurable from player actions, explain it in one short instruction block, and finish immediately when the goal is met or failed.',
  ].join(' ');
}

export type PromptArcadeBotResultPlan = {
  finishAt: number;
  quality: number;
};

export function buildPromptArcadeBotResultPlan(
  round: Pick<Doc<'promptArcadeRounds'>, 'roundNumber' | 'playStartsAt' | 'playEndsAt'>,
  botNumber: number
): PromptArcadeBotResultPlan {
  const random = seededRandom(botNumber, round.roundNumber, round.playStartsAt);
  const durationMs = Math.max(1, round.playEndsAt - round.playStartsAt);
  const skillBand = (((botNumber - 1) % 6) + 6) % 6;
  const completionRatio = Math.min(0.82, 0.3 + random() * 0.28 + (5 - skillBand) * 0.025);
  const quality = Math.min(0.98, 0.48 + skillBand * 0.065 + random() * 0.16);
  return {
    finishAt: Math.min(round.playEndsAt - 100, round.playStartsAt + Math.round(durationMs * completionRatio)),
    quality: Math.round(quality * 1_000) / 1_000,
  };
}

export function buildPromptArcadeBotRating(roundNumber: number, botNumber: number): number {
  const random = seededRandom(roundNumber, botNumber, 0x5a17);
  return 3 + Math.floor(random() * 3);
}

export async function initializePromptArcadeBot(
  ctx: MutationCtx,
  bot: Doc<'playtestBots'>
): Promise<Doc<'promptArcadePlaytestBotStates'>> {
  await enrollPromptArcadePlaytestBot(ctx, bot, Date.now());
  const existing = await ctx.db
    .query('promptArcadePlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (existing !== null) return existing;
  const stateId = await ctx.db.insert('promptArcadePlaytestBotStates', {
    botId: bot._id,
    roomId: bot.roomId,
    gameNumber: 0,
    plannedRoundId: null,
    finishAt: 0,
    quality: 0,
  });
  const state = await ctx.db.get('promptArcadePlaytestBotStates', stateId);
  if (state === null) throw new Error('Prompt Arcade bot state could not be loaded.');
  return state;
}

export async function runPromptArcadeBotTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>
): Promise<{ cursor: { x: number; y: number } }> {
  const now = Date.now();
  const botState = await initializePromptArcadeBot(ctx, bot);
  const gameState = await findPromptArcadeState(ctx, room._id);
  const cursorY = 0.08 + (((bot.botNumber - 1) % 18) / 18) * 0.84;
  if (
    gameState === null ||
    gameState.gameNumber === 0 ||
    gameState.phase === 'lobby' ||
    gameState.phase === 'complete'
  ) {
    return { cursor: { x: 0.08, y: cursorY } };
  }

  if (botState.gameNumber !== gameState.gameNumber) {
    await ctx.db.patch('promptArcadePlaytestBotStates', botState._id, {
      gameNumber: gameState.gameNumber,
      plannedRoundId: null,
      finishAt: 0,
      quality: 0,
    });
  }

  if (!gameState.playlistStarted && (gameState.phase === 'prompting' || gameState.phase === 'generating')) {
    await enrollPromptArcadePlaytestBot(ctx, bot, now);
    const entry = await findPromptArcadeEntry(ctx, room._id, gameState.gameNumber, bot.memberId);
    if (entry?.status === 'needsRevision' && entry.attempt >= MAX_BOT_GENERATION_ATTEMPTS) {
      await ctx.db.patch('promptArcadeEntries', entry._id, {
        status: 'withdrawn',
        errorMessage: `This bot stopped after ${MAX_BOT_GENERATION_ATTEMPTS} unsuccessful generation attempts.`,
        readyAt: null,
        statusUpdatedAt: now,
      });
      await startReadyPromptArcadePlaylist(ctx, gameState, now, true);
      return { cursor: { x: 0.28, y: cursorY } };
    }
    if (entry !== null && (entry.status === 'writing' || entry.status === 'needsRevision')) {
      await queuePromptArcadeBotPrompt(
        ctx,
        bot,
        buildPromptArcadeBotPrompt(bot.botNumber, gameState.gameNumber, entry.attempt + 1),
        now
      );
    }
    return { cursor: { x: 0.28, y: cursorY } };
  }

  if (gameState.phase === 'roundResults' && gameState.currentRoundId !== null) {
    const round = await ctx.db.get('promptArcadeRounds', gameState.currentRoundId);
    if (round === null || round.status !== 'results' || now > (gameState.phaseEndsAt ?? 0)) {
      return { cursor: { x: 0.72, y: cursorY } };
    }
    const entry = await ctx.db.get('promptArcadeEntries', round.entryId);
    if (entry !== null && entry.memberId !== bot.memberId) {
      await recordPromptArcadeRating(
        ctx,
        gameState,
        round,
        bot.memberId,
        buildPromptArcadeBotRating(round.roundNumber, bot.botNumber),
        now
      );
    }
    return { cursor: { x: 0.72, y: cursorY } };
  }

  if (gameState.phase !== 'playing' || gameState.currentRoundId === null) {
    return { cursor: { x: 0.5, y: cursorY } };
  }
  const round = await ctx.db.get('promptArcadeRounds', gameState.currentRoundId);
  if (round === null || round.status !== 'playing') return { cursor: { x: 0.5, y: cursorY } };
  const result = await ctx.db
    .query('promptArcadeResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', bot.memberId))
    .unique();
  if (result === null || result.status !== 'waiting') return { cursor: { x: 0.9, y: cursorY } };

  let finishAt = botState.finishAt;
  let quality = botState.quality;
  if (botState.gameNumber !== gameState.gameNumber || botState.plannedRoundId !== round._id) {
    const plan = buildPromptArcadeBotResultPlan(round, bot.botNumber);
    finishAt = plan.finishAt;
    quality = plan.quality;
    await ctx.db.patch('promptArcadePlaytestBotStates', botState._id, {
      gameNumber: gameState.gameNumber,
      plannedRoundId: round._id,
      finishAt,
      quality,
    });
  }
  const progress = Math.max(0, Math.min(1, (now - round.playStartsAt) / Math.max(1, finishAt - round.playStartsAt)));
  if (now < finishAt) return { cursor: { x: progress, y: cursorY } };

  const membership = await ctx.db.get('roomMembers', bot.memberId);
  if (membership === null || !membership.isActive) return { cursor: { x: progress, y: cursorY } };
  await recordPromptArcadeResult(ctx, gameState, round, result, quality, undefined, undefined, now);
  return { cursor: { x: 1, y: cursorY } };
}

export async function stopPromptArcadeBot(ctx: MutationCtx, bot: Doc<'playtestBots'>): Promise<void> {
  const state = await ctx.db
    .query('promptArcadePlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (state !== null) {
    await ctx.db.patch('promptArcadePlaytestBotStates', state._id, {
      plannedRoundId: null,
      finishAt: Number.MAX_SAFE_INTEGER,
    });
  }
  const gameState = await findPromptArcadeState(ctx, bot.roomId);
  if (gameState === null || gameState.gameNumber === 0) return;
  const entry = await findPromptArcadeEntry(ctx, bot.roomId, gameState.gameNumber, bot.memberId);
  if (entry !== null && entry.status !== 'played' && entry.status !== 'withdrawn') {
    await ctx.db.patch('promptArcadeEntries', entry._id, {
      status: 'withdrawn',
      errorMessage: 'This playtest bot was removed by the room owner.',
      readyAt: null,
      statusUpdatedAt: Date.now(),
    });
    if (!gameState.playlistStarted) {
      await startReadyPromptArcadePlaylist(ctx, gameState, Date.now(), true);
    }
  }
}
