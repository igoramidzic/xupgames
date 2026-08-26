import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { enrollMiniGamesMember } from '../../miniGames';
import { MINI_GAMES_DEFAULT_ROUND_COUNT, normalizeMiniGamesRoundCount } from '../../miniGamesEngine';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

const initialOperationalState = {
  phase: 'lobby' as const,
  currentRoundId: null,
  currentRoundNumber: 0,
  phaseStartedAt: null,
  phaseEndsAt: null,
  participantCount: 0,
  finishedCount: 0,
};

export async function initializeMiniGamesGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const existing = await ctx.db
    .query('miniGamesGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  if (existing !== null) return;
  await ctx.db.insert('miniGamesGameStates', {
    roomId,
    gameNumber: 0,
    totalRounds: MINI_GAMES_DEFAULT_ROUND_COUNT,
    configuredRoundCount: MINI_GAMES_DEFAULT_ROUND_COUNT,
    ...initialOperationalState,
  });
}

export async function prepareMiniGamesGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const state = await ctx.db
    .query('miniGamesGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  if (state === null) {
    await initializeMiniGamesGame(ctx, roomId);
    return;
  }
  await ctx.db.patch('miniGamesGameStates', state._id, {
    ...initialOperationalState,
    totalRounds: normalizeMiniGamesRoundCount(state.configuredRoundCount),
  });
}

export async function syncMiniGamesMembership(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<void> {
  await enrollMiniGamesMember(ctx, roomId, membership, now);
}

export async function miniGamesGameIsComplete(ctx: DatabaseReaderContext, roomId: Id<'rooms'>): Promise<boolean> {
  const state = await ctx.db
    .query('miniGamesGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  return state?.phase === 'complete';
}
