import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import {
  DOODLE_DASH_CATEGORIES,
  DOODLE_DASH_DEFAULT_DRAW_DURATION_MS,
  DOODLE_DASH_DEFAULT_ROUND_COUNT,
} from '../../doodleDashWords';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

const initialDoodleDashState = {
  gameNumber: 0,
  phase: 'lobby' as const,
  currentRoundId: null,
  currentTurnNumber: 0,
  totalTurns: 0,
  turnOrder: [],
  configuredRoundCount: DOODLE_DASH_DEFAULT_ROUND_COUNT,
  configuredDrawDurationMs: DOODLE_DASH_DEFAULT_DRAW_DURATION_MS,
  configuredCategories: [...DOODLE_DASH_CATEGORIES],
  phaseStartedAt: null,
  phaseEndsAt: null,
};

export async function initializeDoodleDashGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const existing = await ctx.db
    .query('doodleDashGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  if (existing === null) {
    await ctx.db.insert('doodleDashGameStates', { roomId, ...initialDoodleDashState });
  }
}

export async function prepareDoodleDashGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const state = await ctx.db
    .query('doodleDashGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  if (state === null) {
    await initializeDoodleDashGame(ctx, roomId);
    return;
  }
  await ctx.db.patch('doodleDashGameStates', state._id, {
    phase: 'lobby',
    currentRoundId: null,
    currentTurnNumber: 0,
    totalTurns: 0,
    turnOrder: [],
    phaseStartedAt: null,
    phaseEndsAt: null,
  });
}

export async function doodleDashGameIsComplete(ctx: DatabaseReaderContext, roomId: Id<'rooms'>): Promise<boolean> {
  const state = await ctx.db
    .query('doodleDashGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  return state?.phase === 'complete';
}
