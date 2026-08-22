import { internal } from '../_generated/api';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import {
  beginDoodleDashDrawing,
  commitDoodleDashStroke,
  recordDoodleDashCorrectGuess,
  recordDoodleDashLiveStrokeChunk,
} from '../doodleDash';
import { DOODLE_DASH_COLORS, findDoodleDashGameState } from '../doodleDashEngine';

const WORD_CHOICE_DELAY_MS = 450;
const WORD_CHOICE_VARIANCE_MS = 950;
const GUESS_DELAY_MS = 2_000;
const GUESS_VARIANCE_MS = 7_000;
const DRAW_START_DELAY_MS = 350;
const DRAW_POINT_INTERVAL_MS = 85;
const MAX_POINTS_PER_TICK = 8;
const BETWEEN_STROKE_DELAY_MS = 300;
const BOT_PEN_WIDTHS = [5, 10, 18] as const;
const PATH_MIN_POINT_COUNT = 16;
const PATH_POINT_VARIANCE = 13;

type DoodleDashPoint = { x: number; y: number };

export type DoodleDashBotRoundPlan = {
  wordChoiceAt: number;
  wordOptionIndex: number;
  drawingSeed: number;
};

function integerHash(...values: number[]): number {
  let hash = 2166136261;
  for (const value of values) {
    hash ^= Math.trunc(value);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function clampCoordinate(value: number): number {
  return Math.round(Math.max(0.04, Math.min(0.96, value)) * 10_000) / 10_000;
}

export function buildDoodleDashBotRoundPlan(
  round: Pick<Doc<'doodleDashRounds'>, 'choiceStartedAt' | 'gameNumber' | 'turnNumber'>,
  botNumber: number
): DoodleDashBotRoundPlan {
  const timingSeed = integerHash(botNumber, round.gameNumber, round.turnNumber);
  return {
    wordChoiceAt: round.choiceStartedAt + WORD_CHOICE_DELAY_MS + (timingSeed % WORD_CHOICE_VARIANCE_MS),
    wordOptionIndex: integerHash(timingSeed, 17) % 3,
    drawingSeed: integerHash(timingSeed, 31),
  };
}

export function doodleDashBotGuessAt(drawStartedAt: number, botNumber: number, turnNumber: number): number {
  return drawStartedAt + GUESS_DELAY_MS + (integerHash(botNumber, turnNumber, 53) % GUESS_VARIANCE_MS);
}

export function buildDoodleDashBotPath(seed: number, strokeIndex: number): DoodleDashPoint[] {
  const random = seededRandom(integerHash(seed, strokeIndex, 97));
  const pointCount = PATH_MIN_POINT_COUNT + Math.floor(random() * PATH_POINT_VARIANCE);
  const centerX = 0.25 + random() * 0.5;
  const centerY = 0.24 + random() * 0.52;
  const radiusX = 0.1 + random() * 0.18;
  const radiusY = 0.08 + random() * 0.17;
  const shape = integerHash(seed, strokeIndex) % 5;
  const points: DoodleDashPoint[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const progress = pointCount <= 1 ? 0 : index / (pointCount - 1);
    let x: number;
    let y: number;
    switch (shape) {
      case 0: {
        const angle = progress * Math.PI * 2;
        x = centerX + Math.cos(angle) * radiusX;
        y = centerY + Math.sin(angle) * radiusY;
        break;
      }
      case 1:
        x = centerX - radiusX + progress * radiusX * 2;
        y = centerY + Math.sin(progress * Math.PI * (3 + (strokeIndex % 3))) * radiusY;
        break;
      case 2:
        x = centerX - radiusX + progress * radiusX * 2;
        y = centerY + (index % 2 === 0 ? -radiusY : radiusY) * (0.55 + random() * 0.45);
        break;
      case 3: {
        const angle = progress * Math.PI * 5;
        x = centerX + Math.cos(angle) * radiusX * progress;
        y = centerY + Math.sin(angle) * radiusY * progress;
        break;
      }
      default: {
        const angle = progress * Math.PI * 6 + random() * 0.8;
        x = centerX + Math.cos(angle) * radiusX * (0.35 + random() * 0.65);
        y = centerY + Math.sin(angle) * radiusY * (0.35 + random() * 0.65);
        break;
      }
    }
    points.push({
      x: clampCoordinate(x + (random() - 0.5) * 0.016),
      y: clampCoordinate(y + (random() - 0.5) * 0.016),
    });
  }
  return points;
}

function botActionId(botNumber: number, turnNumber: number, strokeIndex: number): string {
  return `ddbot-${botNumber}-${turnNumber}-${strokeIndex}`;
}

function idleCursor(botNumber: number): DoodleDashPoint {
  return {
    x: 0.12 + ((botNumber * 37) % 72) / 100,
    y: 0.84 + ((botNumber * 11) % 10) / 100,
  };
}

function strokeAppearance(seed: number, strokeIndex: number) {
  const colorCount = DOODLE_DASH_COLORS.length - 1;
  return {
    color: DOODLE_DASH_COLORS[integerHash(seed, strokeIndex, 71) % colorCount] ?? DOODLE_DASH_COLORS[0],
    width: BOT_PEN_WIDTHS[integerHash(seed, strokeIndex, 73) % BOT_PEN_WIDTHS.length] ?? BOT_PEN_WIDTHS[0],
  };
}

export async function initializeDoodleDashBot(
  ctx: MutationCtx,
  bot: Doc<'playtestBots'>
): Promise<Doc<'doodleDashPlaytestBotStates'>> {
  const existing = await ctx.db
    .query('doodleDashPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (existing !== null) return existing;

  const stateId = await ctx.db.insert('doodleDashPlaytestBotStates', {
    botId: bot._id,
    roomId: bot.roomId,
    plannedRoundId: null,
    wordChoiceAt: 0,
    wordOptionIndex: 0,
    guessAt: 0,
    guessSubmitted: false,
    drawingSeed: integerHash(bot.botNumber, 101),
    strokeIndex: 0,
    pointIndex: 0,
    chunkIndex: 0,
    nextDrawAt: 0,
  });
  const state = await ctx.db.get('doodleDashPlaytestBotStates', stateId);
  if (state === null) throw new Error('Doodle Dash bot state could not be loaded.');
  return state;
}

async function runDoodleDashDrawerTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  round: Doc<'doodleDashRounds'>,
  bot: Doc<'playtestBots'>,
  botState: Doc<'doodleDashPlaytestBotStates'>,
  now: number
): Promise<DoodleDashPoint> {
  if (round.drawStartedAt === null || round.drawEndsAt === null || now > round.drawEndsAt) {
    return idleCursor(bot.botNumber);
  }
  if (botState.nextDrawAt < round.drawStartedAt) {
    await ctx.db.patch('doodleDashPlaytestBotStates', botState._id, {
      nextDrawAt: round.drawStartedAt + DRAW_START_DELAY_MS + ((bot.botNumber * 43) % 300),
    });
    return idleCursor(bot.botNumber);
  }
  if (now < botState.nextDrawAt) {
    return idleCursor(bot.botNumber);
  }

  const path = buildDoodleDashBotPath(botState.drawingSeed, botState.strokeIndex);
  const actionId = botActionId(bot.botNumber, round.turnNumber, botState.strokeIndex);
  const startIndex = botState.pointIndex === 0 ? 0 : Math.max(0, botState.pointIndex - 1);
  const endIndex = Math.min(path.length, botState.pointIndex + MAX_POINTS_PER_TICK);
  const points = path.slice(startIndex, endIndex);
  const appearance = strokeAppearance(botState.drawingSeed, botState.strokeIndex);
  await recordDoodleDashLiveStrokeChunk(
    ctx,
    room,
    round,
    {
      actionId,
      actionStartedAt: Math.max(1, round.drawStartedAt + botState.strokeIndex),
      chunkIndex: botState.chunkIndex,
      tool: 'pen',
      ...appearance,
      points,
    },
    now
  );

  const cursor = path[endIndex - 1] ?? idleCursor(bot.botNumber);
  if (endIndex >= path.length) {
    await commitDoodleDashStroke(ctx, room, round, { actionId, tool: 'pen', ...appearance, points: path }, now);
    await ctx.db.patch('doodleDashPlaytestBotStates', botState._id, {
      strokeIndex: botState.strokeIndex + 1,
      pointIndex: 0,
      chunkIndex: 0,
      nextDrawAt: now + BETWEEN_STROKE_DELAY_MS + ((botState.strokeIndex * 79) % 350),
    });
    return cursor;
  }

  await ctx.db.patch('doodleDashPlaytestBotStates', botState._id, {
    pointIndex: endIndex,
    chunkIndex: botState.chunkIndex + 1,
    nextDrawAt: now + DRAW_POINT_INTERVAL_MS * Math.min(MAX_POINTS_PER_TICK, path.length - botState.pointIndex),
  });
  return cursor;
}

export async function runDoodleDashBotTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>
): Promise<{ cursor: DoodleDashPoint }> {
  const cursor = idleCursor(bot.botNumber);
  const botState = await initializeDoodleDashBot(ctx, bot);
  const gameState = await findDoodleDashGameState(ctx, room._id);
  if (gameState === null || gameState.currentRoundId === null) return { cursor };
  const round = await ctx.db.get('doodleDashRounds', gameState.currentRoundId);
  if (round === null || round.roomId !== room._id || round.gameNumber !== gameState.gameNumber) return { cursor };

  if (botState.plannedRoundId !== round._id) {
    const plan = buildDoodleDashBotRoundPlan(round, bot.botNumber);
    await ctx.db.patch('doodleDashPlaytestBotStates', botState._id, {
      plannedRoundId: round._id,
      ...plan,
      guessAt: 0,
      guessSubmitted: false,
      strokeIndex: 0,
      pointIndex: 0,
      chunkIndex: 0,
      nextDrawAt: 0,
    });
    return { cursor };
  }

  const now = Date.now();
  if (gameState.phase === 'choosing' && round.status === 'choosing') {
    if (round.drawerMemberId === bot.memberId && now >= botState.wordChoiceAt) {
      await beginDoodleDashDrawing(ctx, gameState, round, botState.wordOptionIndex, now);
    }
    return { cursor };
  }
  if (gameState.phase !== 'drawing' || round.status !== 'drawing' || !gameState.turnOrder.includes(bot.memberId)) {
    return { cursor };
  }

  const membership = await ctx.db.get('roomMembers', bot.memberId);
  if (membership === null || !membership.isActive) return { cursor };
  if (round.drawerMemberId === bot.memberId) {
    return { cursor: await runDoodleDashDrawerTick(ctx, room, round, bot, botState, now) };
  }
  if (botState.guessSubmitted || round.drawStartedAt === null) return { cursor };

  const guessAt = doodleDashBotGuessAt(round.drawStartedAt, bot.botNumber, round.turnNumber);
  if (botState.guessAt !== guessAt) {
    await ctx.db.patch('doodleDashPlaytestBotStates', botState._id, { guessAt });
  }
  if (now < guessAt) return { cursor };
  const result = await recordDoodleDashCorrectGuess(ctx, room, gameState, round, membership, now);
  if (result.kind === 'accepted' || result.kind === 'existing') {
    await ctx.db.patch('doodleDashPlaytestBotStates', botState._id, { guessSubmitted: true });
  }
  return { cursor };
}

export async function stopDoodleDashBot(ctx: MutationCtx, bot: Doc<'playtestBots'>): Promise<void> {
  const state = await ctx.db
    .query('doodleDashPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (state === null) return;

  if (state.plannedRoundId !== null) {
    const round = await ctx.db.get('doodleDashRounds', state.plannedRoundId);
    if (round !== null) {
      const cleanupId = await ctx.scheduler.runAfter(0, internal.doodleDash.cleanupLiveStrokeChunks, {
        roundId: round._id,
        actionId: botActionId(bot.botNumber, round.turnNumber, state.strokeIndex),
      });
      void cleanupId;
    }
  }
  await ctx.db.patch('doodleDashPlaytestBotStates', state._id, {
    guessSubmitted: true,
    nextDrawAt: Number.MAX_SAFE_INTEGER,
  });
}
