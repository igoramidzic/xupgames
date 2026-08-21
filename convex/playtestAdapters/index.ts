import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { initializeTrendlineBot, runTrendlineBotTick, stopTrendlineBot } from './trendline';
import { initializeTriviaBot, runTriviaBotTick, stopTriviaBot } from './trivia';
import { initializeTypeRacerBot, runTypeRacerBotTick, stopTypeRacerBot } from './typeRacer';

export async function initializeGameBot(ctx: MutationCtx, room: Doc<'rooms'>, bot: Doc<'playtestBots'>): Promise<void> {
  switch (room.gameType) {
    case 'trivia':
      await initializeTriviaBot(ctx, bot);
      return;
    case 'typeRacer':
      await initializeTypeRacerBot(ctx, bot);
      return;
    case 'trendline':
      await initializeTrendlineBot(ctx, bot);
      return;
    default: {
      const unsupportedGameType: never = room.gameType;
      throw new Error(`No playtest adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}

export async function runGameBotTick(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  bot: Doc<'playtestBots'>
): Promise<{ cursor: { x: number; y: number } }> {
  switch (room.gameType) {
    case 'trivia':
      return await runTriviaBotTick(ctx, room, bot);
    case 'typeRacer':
      return await runTypeRacerBotTick(ctx, room, bot);
    case 'trendline':
      return await runTrendlineBotTick(ctx, room, bot);
    default: {
      const unsupportedGameType: never = room.gameType;
      throw new Error(`No playtest adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}

export async function stopGameBot(
  ctx: MutationCtx,
  room: Doc<'rooms'> | null,
  bot: Doc<'playtestBots'>
): Promise<void> {
  const gameType = room?.gameType;
  switch (gameType) {
    case 'trivia':
      await stopTriviaBot(ctx, bot);
      return;
    case 'typeRacer':
      await stopTypeRacerBot(ctx, bot);
      return;
    case 'trendline':
      await stopTrendlineBot(ctx, bot);
      return;
    case undefined:
      return;
    default: {
      const unsupportedGameType: never = gameType;
      throw new Error(`No playtest adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}
