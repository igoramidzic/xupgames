import type { Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { TRIVIA_CATEGORIES, TRIVIA_DEFAULT_ROUND_COUNT } from '../../triviaQuestions';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export async function initializeTriviaGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  await ctx.db.insert('triviaGameStates', {
    roomId,
    gameNumber: 0,
    phase: 'lobby',
    currentQuestionNumber: 0,
    totalQuestions: TRIVIA_DEFAULT_ROUND_COUNT,
    configuredCategories: [...TRIVIA_CATEGORIES],
    configuredRoundCount: TRIVIA_DEFAULT_ROUND_COUNT,
    phaseStartedAt: null,
    phaseEndsAt: null,
  });
}

export async function prepareTriviaGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const state = await ctx.db
    .query('triviaGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  if (state === null) {
    await initializeTriviaGame(ctx, roomId);
    return;
  }
  await ctx.db.patch('triviaGameStates', state._id, {
    phase: 'lobby',
    currentQuestionNumber: 0,
    totalQuestions: state.configuredRoundCount ?? TRIVIA_DEFAULT_ROUND_COUNT,
    phaseStartedAt: null,
    phaseEndsAt: null,
  });
}

export async function triviaGameIsComplete(ctx: DatabaseReaderContext, roomId: Id<'rooms'>): Promise<boolean> {
  const state = await ctx.db
    .query('triviaGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  return state?.phase === 'complete';
}
