import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { initializeDrawingBot, runDrawingBotTick, stopDrawingBot } from './drawing';
import { initializeTriviaBot, runTriviaBotTick, stopTriviaBot } from './trivia';
import { initializeTypeRacerBot, runTypeRacerBotTick, stopTypeRacerBot } from './typeRacer';

export async function initializeGameBot(ctx: MutationCtx, room: Doc<'rooms'>, bot: Doc<'playtestBots'>): Promise<void> {
  switch (room.gameType) {
    case 'drawing':
      await initializeDrawingBot(ctx, bot);
      return;
    case 'trivia':
      await initializeTriviaBot(ctx, bot);
      return;
    case 'typeRacer':
      await initializeTypeRacerBot(ctx, bot);
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
    case 'drawing':
      return await runDrawingBotTick(ctx, room, bot);
    case 'trivia':
      return await runTriviaBotTick(ctx, room, bot);
    case 'typeRacer':
      return await runTypeRacerBotTick(ctx, room, bot);
    default: {
      const unsupportedGameType: never = room.gameType;
      throw new Error(`No playtest adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}

export function gameBotRunCompletionReason(
  room: Pick<Doc<'rooms'>, 'gameType'>,
  run: Pick<Doc<'playtestRuns'>, 'endsAt'>,
  now: number
): string | null {
  switch (room.gameType) {
    case 'drawing':
      return run.endsAt !== null && now >= run.endsAt ? 'Completed the selected duration.' : null;
    case 'trivia':
    case 'typeRacer':
      return null;
    default: {
      const unsupportedGameType: never = room.gameType;
      throw new Error(`No playtest completion adapter exists for game type: ${unsupportedGameType}`);
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
    case 'drawing':
      await stopDrawingBot(ctx, bot);
      return;
    case 'trivia':
      await stopTriviaBot(ctx, bot);
      return;
    case 'typeRacer':
      await stopTypeRacerBot(ctx, bot);
      return;
    case undefined:
      return;
    default: {
      const unsupportedGameType: never = gameType;
      throw new Error(`No playtest adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}
