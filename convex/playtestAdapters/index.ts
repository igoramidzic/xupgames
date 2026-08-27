import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { GameType } from '../games';
import { PROMPT_ARCADE_MAX_PLAYERS } from '../officialGames/promptArcade/engine';
import { findPromptArcadeState } from '../officialGames/promptArcade/state';
import { initializeDoodleDashBot, runDoodleDashBotTick, stopDoodleDashBot } from './doodleDash';
import { initializePromptArcadeBot, runPromptArcadeBotTick, stopPromptArcadeBot } from './promptArcade';
import { initializeTrendlineBot, runTrendlineBotTick, stopTrendlineBot } from './trendline';
import { initializeTriviaBot, runTriviaBotTick, stopTriviaBot } from './trivia';
import { initializeTypeRacerBot, runTypeRacerBotTick, stopTypeRacerBot } from './typeRacer';

export async function initializeGameBot(ctx: MutationCtx, room: Doc<'rooms'>, bot: Doc<'playtestBots'>): Promise<void> {
  if (room.gameType === undefined) {
    throw new Error('A playtest cannot start before the room selects a game.');
  }
  switch (room.gameType) {
    case 'doodleDash':
      await initializeDoodleDashBot(ctx, bot);
      return;
    case 'miniGames':
      throw new Error('Mini Game Mix does not have a playtest bot adapter yet.');
    case 'promptArcade':
      await initializePromptArcadeBot(ctx, bot);
      return;
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
  if (room.gameType === undefined) {
    throw new Error('A playtest cannot run before the room selects a game.');
  }
  switch (room.gameType) {
    case 'doodleDash':
      return await runDoodleDashBotTick(ctx, room, bot);
    case 'miniGames':
      throw new Error('Mini Game Mix does not have a playtest bot adapter yet.');
    case 'promptArcade':
      return await runPromptArcadeBotTick(ctx, room, bot);
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
  gameType: GameType | undefined,
  bot: Doc<'playtestBots'>
): Promise<void> {
  switch (gameType) {
    case 'doodleDash':
      await stopDoodleDashBot(ctx, bot);
      return;
    case 'miniGames':
      return;
    case 'promptArcade':
      await stopPromptArcadeBot(ctx, bot);
      return;
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

export function getGamePlaytestBotTargetLimit(gameType: GameType, roomMaxPlayers: number): number | null {
  switch (gameType) {
    case 'doodleDash':
    case 'trivia':
    case 'typeRacer':
    case 'trendline':
      return roomMaxPlayers;
    case 'miniGames':
      return null;
    case 'promptArcade':
      return Math.min(roomMaxPlayers, PROMPT_ARCADE_MAX_PLAYERS);
    default: {
      const unsupportedGameType: never = gameType;
      throw new Error(`No playtest capacity exists for game type: ${unsupportedGameType}`);
    }
  }
}

export async function getGamePlaytestStartBlocker(ctx: MutationCtx, room: Doc<'rooms'>): Promise<string | null> {
  if (room.gameType !== 'promptArcade') return null;
  const state = await findPromptArcadeState(ctx, room._id);
  if (
    state !== null &&
    (state.phase === 'lobby' ||
      (!state.playlistStarted && (state.phase === 'prompting' || state.phase === 'generating')))
  ) {
    return null;
  }
  return 'Add Prompt Arcade bots before its generated-game playlist begins.';
}
