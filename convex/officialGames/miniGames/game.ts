import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { fail } from '../../domain';
import { activateCurrentRoomGame } from '../../roomGames';
import { isMiniGamesRoundCount, normalizeMiniGamesRoundCount } from './registry';
import { createRound } from './rounds';
import { findMiniGamesState, requireMiniGamesMember } from './state';

type GameRequest = { roomId: Id<'rooms'>; sessionToken: string };

export async function configureGameHandler(ctx: MutationCtx, args: GameRequest & { roundCount: number }) {
  const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
  if (membership.guestId !== room.ownerGuestId) fail('NOT_ROOM_OWNER', 'Only the room owner can configure the game.');
  if (!isMiniGamesRoundCount(args.roundCount)) {
    fail('INVALID_MINI_GAMES_CONFIGURATION', 'Choose one of the available mini-game counts.');
  }
  const state = await findMiniGamesState(ctx, room._id);
  if (state === null) throw new Error('Mini Game Mix state is missing.');
  if (state.phase !== 'lobby') fail('MINI_GAMES_IN_PROGRESS', 'Mini-game settings are locked after the game starts.');
  await ctx.db.patch('miniGamesGameStates', state._id, {
    configuredRoundCount: args.roundCount,
    totalRounds: args.roundCount,
  });
  return null;
}

export async function startGameHandler(ctx: MutationCtx, args: GameRequest) {
  const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
  if (membership.guestId !== room.ownerGuestId) {
    fail('NOT_ROOM_OWNER', 'Only the room owner can start Mini Game Mix.');
  }
  if (room.status === 'closed') fail('ROOM_CLOSED', 'This room is closed.');
  const existingState = await findMiniGamesState(ctx, room._id);
  if (existingState === null) throw new Error('Mini Game Mix state is missing.');
  if (existingState.phase !== 'lobby') fail('MINI_GAMES_IN_PROGRESS', 'Mini Game Mix has already started.');
  const now = Date.now();
  await activateCurrentRoomGame(ctx, room, 'miniGames', now);
  const gameNumber = existingState.gameNumber + 1;
  const totalRounds = normalizeMiniGamesRoundCount(existingState.configuredRoundCount);
  const state = { ...existingState, gameNumber, totalRounds };
  const { round, participantCount } = await createRound(ctx, state, 1, null, now);
  await ctx.db.patch('miniGamesGameStates', existingState._id, {
    gameNumber,
    phase: 'selecting',
    currentRoundId: round._id,
    currentRoundNumber: 1,
    totalRounds,
    phaseStartedAt: now,
    phaseEndsAt: round.playStartsAt,
    participantCount,
    finishedCount: 0,
  });
  return { gameNumber, roundNumber: 1, miniGameId: round.miniGameId };
}
