import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

const BOT_COLORS = ['#3155d9', '#ff685b', '#f3cb42', '#35b87f', '#8d5cf6', '#17203a'];
const BOT_WIDTHS = [3, 6, 10, 16];
const DRAW_POINT_INTERVAL_MS = 85;
const MAX_POINTS_PER_TICK = 8;

export type DrawingBotPlan = {
  style: 'loop' | 'spiral' | 'wave' | 'zigzag';
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
};

function clampUnit(value: number): number {
  return Math.min(0.98, Math.max(0.02, Math.round(value * 100_000) / 100_000));
}

function randomPoint(random: () => number) {
  return {
    x: clampUnit(0.1 + random() * 0.8),
    y: clampUnit(0.1 + random() * 0.8),
  };
}

function rotate(x: number, y: number, angle: number) {
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
}

export function drawingPointsForElapsed(elapsedMs: number): number {
  return Math.max(1, Math.min(MAX_POINTS_PER_TICK, Math.floor(Math.max(0, elapsedMs) / DRAW_POINT_INTERVAL_MS)));
}

/** Builds one of several paths beginning at the bot's current cursor. */
export function buildDrawingBotPlan(
  origin: { x: number; y: number },
  random: () => number = Math.random
): DrawingBotPlan {
  const styles = ['loop', 'spiral', 'wave', 'zigzag'] as const;
  const style = styles[Math.floor(random() * styles.length) % styles.length];
  const pointCount = 16 + Math.floor(random() * 13);
  const size = 0.055 + random() * 0.1;
  const angle = random() * Math.PI * 2;
  const turns = 0.8 + random() * 1.35;

  const points = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / Math.max(1, pointCount - 1);
    let localX = 0;
    let localY = 0;

    switch (style) {
      case 'loop': {
        const loopAngle = progress * Math.PI * 2 * turns;
        localX = (Math.cos(loopAngle) - 1) * size * 0.72;
        localY = Math.sin(loopAngle) * size;
        break;
      }
      case 'spiral': {
        const spiralAngle = progress * Math.PI * 2 * (turns + 0.7);
        localX = Math.cos(spiralAngle) * size * progress;
        localY = Math.sin(spiralAngle) * size * progress;
        break;
      }
      case 'wave': {
        localX = progress * size * 2.4;
        localY = Math.sin(progress * Math.PI * 2 * (turns + 0.5)) * size * 0.55;
        break;
      }
      case 'zigzag': {
        localX = progress * size * 2.2;
        const segment = progress * 7;
        localY = (Math.abs((segment % 2) - 1) * 2 - 1) * size * 0.6;
        if (index === 0) {
          localY = 0;
        }
        break;
      }
      default: {
        const unsupportedStyle: never = style;
        throw new Error(`Unsupported drawing bot style: ${unsupportedStyle}`);
      }
    }

    const rotated = rotate(localX, localY, angle);
    return {
      x: clampUnit(origin.x + rotated.x),
      y: clampUnit(origin.y + rotated.y),
    };
  });

  return {
    style,
    color: BOT_COLORS[Math.floor(random() * BOT_COLORS.length) % BOT_COLORS.length],
    width: BOT_WIDTHS[Math.floor(random() * BOT_WIDTHS.length) % BOT_WIDTHS.length],
    points,
  };
}

export async function initializeDrawingBot(
  ctx: MutationCtx,
  bot: Doc<'playtestBots'>
): Promise<Doc<'drawingPlaytestBotStates'>> {
  const existing = await ctx.db
    .query('drawingPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (existing !== null) {
    return existing;
  }

  const now = Date.now();
  const cursor = randomPoint(Math.random);
  const stateId = await ctx.db.insert('drawingPlaytestBotStates', {
    botId: bot._id,
    roomId: bot.roomId,
    cursor,
    cursorTarget: randomPoint(Math.random),
    nextCursorTargetAt: now + 600 + Math.floor(Math.random() * 1_400),
    activeStrokeId: null,
    plannedPoints: [],
    nextPointIndex: 0,
    nextActionAt: now + 250 + ((bot.botNumber * 197) % 1_200) + Math.floor(Math.random() * 600),
    lastTickAt: now,
  });
  const state = await ctx.db.get('drawingPlaytestBotStates', stateId);
  if (state === null) {
    throw new Error('Drawing bot state could not be loaded.');
  }
  return state;
}

async function getOrCreateDrawingGameState(ctx: MutationCtx, room: Doc<'rooms'>) {
  const existing = await ctx.db
    .query('drawingGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', room._id))
    .unique();
  if (existing !== null) {
    return existing;
  }

  const newestStroke = await ctx.db
    .query('drawingStrokes')
    .withIndex('by_roomId_and_sequence', (index) => index.eq('roomId', room._id))
    .order('desc')
    .first();
  const drawingStateId = await ctx.db.insert('drawingGameStates', {
    roomId: room._id,
    nextStrokeSequence: (newestStroke?.sequence ?? 0) + 1,
    firstStrokeSequence: (newestStroke?.sequence ?? 0) + 1,
    phase: 'active',
  });
  const drawingState = await ctx.db.get('drawingGameStates', drawingStateId);
  if (drawingState === null) {
    throw new Error('Drawing playtest state could not be loaded.');
  }
  return drawingState;
}

async function beginStroke(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>,
  state: Doc<'drawingPlaytestBotStates'>,
  now: number
) {
  const plan = buildDrawingBotPlan(state.cursor);
  const firstPoint = plan.points[0] ?? state.cursor;
  const drawingState = await getOrCreateDrawingGameState(ctx, room);
  const sequence = drawingState.nextStrokeSequence;
  await ctx.db.patch('drawingGameStates', drawingState._id, { nextStrokeSequence: sequence + 1 });
  const strokeId = await ctx.db.insert('drawingStrokes', {
    roomId: room._id,
    authorMemberId: bot.memberId,
    authorName: bot.displayName,
    sequence,
    color: plan.color,
    width: plan.width,
    status: 'drawing',
    points: [firstPoint],
    pointCount: 1,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  });
  await ctx.db.patch('drawingPlaytestBotStates', state._id, {
    cursor: firstPoint,
    cursorTarget: firstPoint,
    activeStrokeId: strokeId,
    plannedPoints: plan.points,
    nextPointIndex: 1,
    lastTickAt: now,
  });
  return { cursor: firstPoint };
}

async function advanceStroke(
  ctx: MutationCtx,
  state: Doc<'drawingPlaytestBotStates'>,
  stroke: Doc<'drawingStrokes'>,
  now: number
) {
  const pointsThisTick = drawingPointsForElapsed(now - state.lastTickAt);
  const nextPointIndex = Math.min(state.plannedPoints.length, state.nextPointIndex + pointsThisTick);
  const appendedPoints = state.plannedPoints.slice(state.nextPointIndex, nextPointIndex);
  const points = [...stroke.points, ...appendedPoints];
  const cursor = points[points.length - 1] ?? state.cursor;
  const finished = nextPointIndex >= state.plannedPoints.length;

  await ctx.db.patch('drawingStrokes', stroke._id, {
    points,
    pointCount: points.length,
    status: finished ? 'finished' : 'drawing',
    updatedAt: now,
    finishedAt: finished ? now : null,
  });
  await ctx.db.patch('drawingPlaytestBotStates', state._id, {
    cursor,
    nextPointIndex: finished ? 0 : nextPointIndex,
    activeStrokeId: finished ? null : stroke._id,
    plannedPoints: finished ? [] : state.plannedPoints,
    nextActionAt: finished ? now + 400 + Math.floor(Math.random() * 1_400) : state.nextActionAt,
    cursorTarget: finished ? randomPoint(Math.random) : cursor,
    nextCursorTargetAt: finished ? now + 650 + Math.floor(Math.random() * 1_200) : state.nextCursorTargetAt,
    lastTickAt: now,
  });
  return { cursor };
}

async function roamCursor(ctx: MutationCtx, state: Doc<'drawingPlaytestBotStates'>, now: number) {
  const distance = Math.hypot(state.cursorTarget.x - state.cursor.x, state.cursorTarget.y - state.cursor.y);
  const chooseNewTarget = now >= state.nextCursorTargetAt || distance < 0.025;
  const cursorTarget = chooseNewTarget ? randomPoint(Math.random) : state.cursorTarget;
  const easing = 0.17 + Math.random() * 0.12;
  const cursor = {
    x: clampUnit(state.cursor.x + (cursorTarget.x - state.cursor.x) * easing),
    y: clampUnit(state.cursor.y + (cursorTarget.y - state.cursor.y) * easing),
  };
  await ctx.db.patch('drawingPlaytestBotStates', state._id, {
    cursor,
    cursorTarget,
    nextCursorTargetAt: chooseNewTarget ? now + 600 + Math.floor(Math.random() * 1_400) : state.nextCursorTargetAt,
    lastTickAt: now,
  });
  return { cursor };
}

export async function runDrawingBotTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>
): Promise<{ cursor: { x: number; y: number } }> {
  const state = await initializeDrawingBot(ctx, bot);
  const now = Date.now();
  if (state.activeStrokeId !== null) {
    const stroke = await ctx.db.get('drawingStrokes', state.activeStrokeId);
    if (stroke !== null && stroke.status === 'drawing') {
      return await advanceStroke(ctx, state, stroke, now);
    }
    await ctx.db.patch('drawingPlaytestBotStates', state._id, {
      activeStrokeId: null,
      plannedPoints: [],
      nextPointIndex: 0,
      nextActionAt: now + 350 + Math.floor(Math.random() * 1_000),
      lastTickAt: now,
    });
  }

  if (now >= state.nextActionAt) {
    return await beginStroke(ctx, room, bot, state, now);
  }
  return await roamCursor(ctx, state, now);
}

export async function stopDrawingBot(ctx: MutationCtx, bot: Doc<'playtestBots'>): Promise<void> {
  const state = await ctx.db
    .query('drawingPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (state === null || state.activeStrokeId === null) {
    return;
  }
  const stroke = await ctx.db.get('drawingStrokes', state.activeStrokeId);
  const now = Date.now();
  if (stroke?.status === 'drawing') {
    await ctx.db.patch('drawingStrokes', stroke._id, {
      status: 'finished',
      updatedAt: now,
      finishedAt: now,
    });
  }
  await ctx.db.patch('drawingPlaytestBotStates', state._id, {
    activeStrokeId: null,
    plannedPoints: [],
    nextPointIndex: 0,
  });
}
