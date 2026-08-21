import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { enrollTypeRacerMemberInActiveRace, findTypeRacerGameState, recordTypeRacerProgress } from '../typeRacer';

const MIN_REPORT_INTERVAL_MS = 460;
const REPORT_INTERVAL_VARIANCE_MS = 340;

export function buildTypeRacerBotProfile(botNumber: number, random: () => number = Math.random) {
  const speedBand = (((botNumber - 1) % 8) + 8) % 8;
  return {
    targetWpm: 34 + speedBand * 8 + Math.floor(random() * 9),
    targetAccuracy: Math.min(99.5, 92.5 + (botNumber % 5) * 1.35 + random()),
  };
}

export async function initializeTypeRacerBot(
  ctx: MutationCtx,
  bot: Doc<'playtestBots'>
): Promise<Doc<'typeRacerPlaytestBotStates'>> {
  const existing = await ctx.db
    .query('typeRacerPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (existing !== null) {
    return existing;
  }

  const profile = buildTypeRacerBotProfile(bot.botNumber);
  const stateId = await ctx.db.insert('typeRacerPlaytestBotStates', {
    botId: bot._id,
    roomId: bot.roomId,
    raceNumber: 0,
    targetWpm: profile.targetWpm,
    targetAccuracy: profile.targetAccuracy,
    nextReportAt: 0,
  });
  const state = await ctx.db.get('typeRacerPlaytestBotStates', stateId);
  if (state === null) {
    throw new Error('Type racer bot state could not be loaded.');
  }
  await enrollTypeRacerMemberInActiveRace(
    ctx,
    bot.roomId,
    { _id: bot.memberId, displayName: bot.displayName },
    Date.now()
  );
  return state;
}

export async function runTypeRacerBotTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>
): Promise<{ cursor: { x: number; y: number } }> {
  const botState = await initializeTypeRacerBot(ctx, bot);
  const gameState = await findTypeRacerGameState(ctx, room._id);
  const progress = await ctx.db
    .query('typeRacerProgress')
    .withIndex('by_roomId_and_memberId', (index) => index.eq('roomId', room._id).eq('memberId', bot.memberId))
    .unique();
  const passageLength = gameState?.passageText?.length ?? 0;
  const progressRatio = passageLength < 1 ? 0 : Math.min(1, (progress?.correctChars ?? 0) / passageLength);
  const cursor = { x: progressRatio, y: ((bot.botNumber - 1) % 20) / 20 + 0.025 };

  if (
    gameState === null ||
    gameState.passageText === null ||
    gameState.startsAt === null ||
    progress === null ||
    progress.raceNumber !== gameState.raceNumber ||
    gameState.phase === 'lobby' ||
    gameState.phase === 'complete' ||
    progress.status === 'finished'
  ) {
    return { cursor };
  }

  const now = Date.now();
  if (botState.raceNumber !== gameState.raceNumber) {
    await ctx.db.patch('typeRacerPlaytestBotStates', botState._id, {
      raceNumber: gameState.raceNumber,
      nextReportAt: gameState.startsAt + 180 + ((bot.botNumber * 97) % 720),
    });
    return { cursor: { x: 0, y: cursor.y } };
  }
  if (now < gameState.startsAt || now < botState.nextReportAt) {
    return { cursor };
  }

  const elapsedMs = Math.max(1, now - progress.startedAt);
  const targetChars = Math.floor((botState.targetWpm * 5 * elapsedMs) / 60_000);
  const correctChars = Math.min(
    gameState.passageText.length,
    Math.max(progress.correctChars, targetChars, Math.min(gameState.passageText.length, progress.correctChars + 1))
  );
  const totalKeystrokes = Math.max(progress.totalKeystrokes, Math.ceil(correctChars / (botState.targetAccuracy / 100)));
  const errorKeystrokes = Math.max(progress.errorKeystrokes, totalKeystrokes - correctChars);
  const membership = await ctx.db.get('roomMembers', bot.memberId);
  if (membership === null || !membership.isActive) {
    return { cursor };
  }
  const isFinished = correctChars === gameState.passageText.length;
  await recordTypeRacerProgress(
    ctx,
    room,
    membership,
    {
      correctChars,
      typedChars: correctChars,
      totalKeystrokes,
      errorKeystrokes,
      revision: progress.revision + 1,
      ...(isFinished ? { typedText: gameState.passageText } : {}),
    },
    now
  );
  await ctx.db.patch('typeRacerPlaytestBotStates', botState._id, {
    nextReportAt:
      now + MIN_REPORT_INTERVAL_MS + ((bot.botNumber * 53 + progress.revision * 29) % REPORT_INTERVAL_VARIANCE_MS),
  });
  return {
    cursor: {
      x: gameState.passageText.length < 1 ? 0 : correctChars / gameState.passageText.length,
      y: cursor.y,
    },
  };
}

export async function stopTypeRacerBot(ctx: MutationCtx, bot: Doc<'playtestBots'>): Promise<void> {
  const state = await ctx.db
    .query('typeRacerPlaytestBotStates')
    .withIndex('by_botId', (index) => index.eq('botId', bot._id))
    .unique();
  if (state !== null) {
    await ctx.db.patch('typeRacerPlaytestBotStates', state._id, { nextReportAt: Number.MAX_SAFE_INTEGER });
  }
}
