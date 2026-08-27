import { internal } from '../../_generated/api';
import type { Doc } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { fail, MAX_PLAYERS } from '../../domain';
import { MINI_GAMES_RESULTS_MS, MINI_GAMES_ROUND_MS } from './shared';

export async function showRoundResults(
  ctx: MutationCtx,
  state: Doc<'miniGamesGameStates'>,
  round: Doc<'miniGamesRounds'>,
  now: number
) {
  if (state.phase === 'roundResults' || state.phase === 'complete') return;
  const results = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
    .take(MAX_PLAYERS + 1);
  if (results.length > MAX_PLAYERS) throw new Error('Mini-game participant capacity invariant violated.');
  for (const result of results) {
    if (result.status === 'waiting') {
      await ctx.db.patch('miniGamesResults', result._id, {
        status: 'timedOut',
        finishedAt: now,
        timeMs: Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt)),
      });
    }
  }
  await ctx.db.patch('miniGamesRounds', round._id, { status: 'results', resultsStartedAt: now });
  await ctx.db.patch('miniGamesGameStates', state._id, {
    phase: 'roundResults',
    phaseStartedAt: now,
    phaseEndsAt: now + MINI_GAMES_RESULTS_MS,
    finishedCount: results.length,
  });
  await ctx.scheduler.runAfter(MINI_GAMES_RESULTS_MS, internal.miniGames.advanceRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber: round.roundNumber,
  });
}

export async function recordResult(
  ctx: MutationCtx,
  state: Doc<'miniGamesGameStates'>,
  round: Doc<'miniGamesRounds'>,
  result: Doc<'miniGamesResults'>,
  fields: Pick<Doc<'miniGamesResults'>, 'score' | 'straightness' | 'correctClicks' | 'wrongClicks'> & {
    metric?: number;
    numericGuess?: number;
    challengeResult?: Doc<'miniGamesResults'>['challengeResult'];
    submission?: Doc<'miniGamesResults'>['submission'];
  },
  now: number
) {
  const timeMs = Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt));
  await ctx.db.patch('miniGamesResults', result._id, {
    ...fields,
    status: 'finished',
    finishedAt: now,
    timeMs,
  });
  const finishedCount = state.finishedCount + 1;
  await ctx.db.patch('miniGamesGameStates', state._id, { finishedCount });
  if (finishedCount >= state.participantCount) {
    await showRoundResults(ctx, { ...state, finishedCount }, round, now);
  }
  return { score: fields.score, timeMs };
}

export function assertSubmissionOpen(state: Doc<'miniGamesGameStates'>, round: Doc<'miniGamesRounds'>, now: number) {
  if (state.phase !== 'playing' || round.status !== 'playing' || now > round.playEndsAt) {
    fail('MINI_GAMES_NOT_RUNNING', 'This mini-game round has ended.');
  }
}
