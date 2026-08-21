import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { MAX_PLAYERS } from './domain';
import { calculateTriviaPoints, TRIVIA_ANSWER_DURATION_MS } from './triviaScoring';

export const TRIVIA_REVEAL_DURATION_MS = 7_000;

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export async function findTriviaGameState(ctx: DatabaseReaderContext, roomId: Id<'rooms'>) {
  return await ctx.db
    .query('triviaGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

export async function findTriviaRound(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  gameNumber: number,
  questionNumber: number
) {
  return await ctx.db
    .query('triviaRounds')
    .withIndex('by_roomId_and_gameNumber_and_questionNumber', (index) =>
      index.eq('roomId', roomId).eq('gameNumber', gameNumber).eq('questionNumber', questionNumber)
    )
    .unique();
}

export function shouldRevealTriviaQuestion(answeredCount: number, activeMemberCount: number): boolean {
  return activeMemberCount > 0 && answeredCount >= activeMemberCount;
}

export function shouldCommitTriviaScoreOnSubmit(scoreCommitMode: Doc<'triviaRounds'>['scoreCommitMode']): boolean {
  return scoreCommitMode !== 'on_reveal';
}

type TriviaScoreContribution = Pick<Doc<'triviaAnswers'>, 'memberId' | 'isCorrect' | 'pointsAwarded'>;

async function commitTriviaScore(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  gameNumber: number,
  membership: Doc<'roomMembers'>,
  answer: TriviaScoreContribution,
  now: number
): Promise<void> {
  const score = await ctx.db
    .query('triviaScores')
    .withIndex('by_roomId_and_gameNumber_and_memberId', (index) =>
      index.eq('roomId', roomId).eq('gameNumber', gameNumber).eq('memberId', answer.memberId)
    )
    .unique();
  if (score === null) {
    await ctx.db.insert('triviaScores', {
      roomId,
      gameNumber,
      memberId: answer.memberId,
      displayName: membership.displayName,
      totalPoints: answer.pointsAwarded,
      correctAnswers: answer.isCorrect ? 1 : 0,
      answersSubmitted: 1,
      currentStreak: answer.isCorrect ? 1 : 0,
      bestStreak: answer.isCorrect ? 1 : 0,
      updatedAt: now,
    });
    return;
  }

  const currentStreak = answer.isCorrect ? score.currentStreak + 1 : 0;
  await ctx.db.patch('triviaScores', score._id, {
    displayName: membership.displayName,
    totalPoints: score.totalPoints + answer.pointsAwarded,
    correctAnswers: score.correctAnswers + (answer.isCorrect ? 1 : 0),
    answersSubmitted: score.answersSubmitted + 1,
    currentStreak,
    bestStreak: Math.max(score.bestStreak, currentStreak),
    updatedAt: now,
  });
}

async function finalizeTriviaRoundScores(ctx: MutationCtx, round: Doc<'triviaRounds'>, now: number): Promise<void> {
  if (round.scoreCommitMode !== 'on_reveal' || round.scoresFinalizedAt !== undefined) {
    return;
  }
  const answers = await ctx.db
    .query('triviaAnswers')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id))
    .take(MAX_PLAYERS + 1);
  if (answers.length > MAX_PLAYERS) {
    throw new Error('Trivia answer capacity invariant violated.');
  }
  for (const answer of answers) {
    const membership = await ctx.db.get('roomMembers', answer.memberId);
    if (membership === null) {
      throw new Error('Trivia answer membership is missing.');
    }
    await commitTriviaScore(ctx, round.roomId, round.gameNumber, membership, answer, now);
  }
  await ctx.db.patch('triviaRounds', round._id, { scoresFinalizedAt: now });
}

export async function revealTriviaQuestion(
  ctx: MutationCtx,
  state: Doc<'triviaGameStates'>,
  gameNumber: number,
  questionNumber: number
): Promise<void> {
  const now = Date.now();
  const round = await findTriviaRound(ctx, state.roomId, gameNumber, questionNumber);
  if (round === null) {
    throw new Error('Trivia round is missing during reveal.');
  }
  await finalizeTriviaRoundScores(ctx, round, now);
  await ctx.db.patch('triviaGameStates', state._id, {
    phase: 'reveal',
    phaseStartedAt: now,
    phaseEndsAt: now + TRIVIA_REVEAL_DURATION_MS,
  });

  const scheduledId: Id<'_scheduled_functions'> =
    questionNumber >= state.totalQuestions
      ? await ctx.scheduler.runAfter(TRIVIA_REVEAL_DURATION_MS, internal.trivia.finishGame, {
          stateId: state._id,
          gameNumber,
        })
      : await ctx.scheduler.runAfter(TRIVIA_REVEAL_DURATION_MS, internal.trivia.beginQuestion, {
          stateId: state._id,
          gameNumber,
          questionNumber: questionNumber + 1,
        });
  void scheduledId;
}

export type RecordTriviaAnswerResult =
  | { kind: 'not_running' }
  | { kind: 'closed' }
  | { kind: 'existing'; pointsAwarded: number; responseTimeMs: number }
  | { kind: 'accepted'; pointsAwarded: number; responseTimeMs: number };

export async function recordTriviaAnswer(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  membership: Doc<'roomMembers'>,
  selectedOptionIndex: number,
  now: number = Date.now()
): Promise<RecordTriviaAnswerResult> {
  const state = await findTriviaGameState(ctx, room._id);
  if (state === null || state.phase !== 'question' || state.currentQuestionNumber < 1) {
    return { kind: 'not_running' };
  }
  if (state.phaseStartedAt === null || state.phaseEndsAt === null || now > state.phaseEndsAt) {
    return { kind: 'closed' };
  }

  const round = await findTriviaRound(ctx, room._id, state.gameNumber, state.currentQuestionNumber);
  if (round === null) {
    throw new Error('Current trivia round is missing.');
  }
  const existingAnswer = await ctx.db
    .query('triviaAnswers')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (existingAnswer !== null) {
    return {
      kind: 'existing',
      pointsAwarded: existingAnswer.pointsAwarded,
      responseTimeMs: existingAnswer.responseTimeMs,
    };
  }

  const responseTimeMs = Math.min(TRIVIA_ANSWER_DURATION_MS, Math.max(0, now - state.phaseStartedAt));
  const isCorrect = selectedOptionIndex === round.correctOptionIndex;
  const pointsAwarded = isCorrect ? calculateTriviaPoints(responseTimeMs) : 0;
  await ctx.db.insert('triviaAnswers', {
    roomId: room._id,
    gameNumber: state.gameNumber,
    roundId: round._id,
    memberId: membership._id,
    selectedOptionIndex,
    isCorrect,
    responseTimeMs,
    pointsAwarded,
    submittedAt: now,
  });

  if (shouldCommitTriviaScoreOnSubmit(round.scoreCommitMode)) {
    await commitTriviaScore(
      ctx,
      room._id,
      state.gameNumber,
      membership,
      { memberId: membership._id, isCorrect, pointsAwarded },
      now
    );
  }

  const answers = await ctx.db
    .query('triviaAnswers')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id))
    .take(MAX_PLAYERS + 1);
  if (answers.length > MAX_PLAYERS) {
    throw new Error('Trivia answer capacity invariant violated.');
  }
  if (shouldRevealTriviaQuestion(answers.length, room.activeMemberCount)) {
    await revealTriviaQuestion(ctx, state, state.gameNumber, state.currentQuestionNumber);
  }

  return { kind: 'accepted', pointsAwarded, responseTimeMs };
}
