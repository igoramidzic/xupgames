import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
  initializeTrendlineGame,
  prepareTrendlineGame,
  syncTrendlineMembership,
  trendlineGameIsComplete,
} from './communityGameAdapters/trendline';
import type { GameType } from './games';
import { initializeTriviaGame, prepareTriviaGame, triviaGameIsComplete } from './officialGames/trivia/lifecycle';
import {
  initializeTypeRacerGame,
  prepareTypeRacerGame,
  syncTypeRacerMembership,
  typeRacerGameIsComplete,
} from './officialGames/typeRacer/lifecycle';

type DatabaseReaderContext = Pick<QueryCtx, 'db' | 'runQuery'>;

/**
 * The only shared-platform switch over game implementations.
 *
 * Official adapters live under `officialGames/`. Community adapters should be
 * tiny app-side bridges into their mounted local component under
 * `communityGames/`; authentication and room access stay in the app wrapper.
 */
export async function initializeGameState(ctx: MutationCtx, roomId: Id<'rooms'>, gameType: GameType): Promise<void> {
  switch (gameType) {
    case 'trivia':
      await initializeTriviaGame(ctx, roomId);
      return;
    case 'typeRacer':
      await initializeTypeRacerGame(ctx, roomId);
      return;
    case 'trendline':
      await initializeTrendlineGame(ctx, roomId);
      return;
    default: {
      const unsupportedGameType: never = gameType;
      throw new Error(`No initialization adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}

export async function syncGameMembership(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<void> {
  if (room.gameType === undefined) {
    return;
  }
  switch (room.gameType) {
    case 'trivia':
      return;
    case 'typeRacer':
      await syncTypeRacerMembership(ctx, room._id, membership, now);
      return;
    case 'trendline':
      await syncTrendlineMembership(ctx, room._id, membership, now);
      return;
    default: {
      const unsupportedGameType: never = room.gameType;
      throw new Error(`No membership adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}

export async function prepareGameState(ctx: MutationCtx, room: Doc<'rooms'>, gameType: GameType): Promise<void> {
  switch (gameType) {
    case 'trivia':
      await prepareTriviaGame(ctx, room._id);
      return;
    case 'typeRacer':
      await prepareTypeRacerGame(ctx, room._id);
      return;
    case 'trendline':
      await prepareTrendlineGame(ctx, room._id);
      return;
    default: {
      const unsupportedGameType: never = gameType;
      throw new Error(`No preparation adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}

export async function gameStateIsComplete(ctx: DatabaseReaderContext, room: Doc<'rooms'>): Promise<boolean> {
  if (room.gameType === undefined) {
    return false;
  }
  switch (room.gameType) {
    case 'trivia':
      return await triviaGameIsComplete(ctx, room._id);
    case 'typeRacer':
      return await typeRacerGameIsComplete(ctx, room._id);
    case 'trendline':
      return await trendlineGameIsComplete(ctx, room._id);
    default: {
      const unsupportedGameType: never = room.gameType;
      throw new Error(`No completion adapter exists for game type: ${unsupportedGameType}`);
    }
  }
}
