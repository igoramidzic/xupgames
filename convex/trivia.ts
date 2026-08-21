import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, type QueryCtx, query } from './_generated/server';
import { fail, MAX_PLAYERS } from './domain';
import { requireRoomMember } from './roomAccess';
import { activateCurrentRoomGame, completeCurrentRoomGame } from './roomGames';
import { listActiveRoomMembers, listRoomMembersForDisplay } from './roomMembers';
import {
  findTriviaGameState,
  findTriviaRound,
  recordTriviaAnswer,
  revealTriviaQuestion,
  TRIVIA_REVEAL_DURATION_MS,
} from './triviaEngine';
import {
  isTriviaCategory,
  isTriviaRoundCount,
  selectTriviaQuestions,
  TRIVIA_CATEGORIES,
  TRIVIA_DEFAULT_ROUND_COUNT,
  TRIVIA_QUESTIONS,
  TRIVIA_ROUND_OPTIONS,
  type TriviaCategory,
} from './triviaQuestions';
import { TRIVIA_ANSWER_DURATION_MS } from './triviaScoring';

export const TRIVIA_COUNTDOWN_MS = 3_000;

const triviaPhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('countdown'),
  v.literal('question'),
  v.literal('reveal'),
  v.literal('complete')
);

const leaderboardEntryValidator = v.object({
  rank: v.number(),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  totalPoints: v.number(),
  correctAnswers: v.number(),
  answersSubmitted: v.number(),
  bestStreak: v.number(),
  pointsGained: v.union(v.number(), v.null()),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});

const roundViewValidator = v.object({
  roundId: v.id('triviaRounds'),
  questionNumber: v.number(),
  category: v.string(),
  difficulty: v.literal('hard'),
  prompt: v.string(),
  options: v.array(v.string()),
  answer: v.union(v.string(), v.null()),
  correctOptionIndex: v.union(v.number(), v.null()),
  answeredCount: v.number(),
  optionAnswerCounts: v.union(v.array(v.number()), v.null()),
});

const playerAnswerValidator = v.object({
  selectedOptionIndex: v.number(),
  pointsAwarded: v.number(),
  responseTimeMs: v.number(),
  isCorrect: v.union(v.boolean(), v.null()),
});

const gameViewValidator = v.object({
  gameNumber: v.number(),
  phase: triviaPhaseValidator,
  currentQuestionNumber: v.number(),
  totalQuestions: v.number(),
  phaseStartedAt: v.union(v.number(), v.null()),
  phaseEndsAt: v.union(v.number(), v.null()),
  round: v.union(roundViewValidator, v.null()),
  playerAnswer: v.union(playerAnswerValidator, v.null()),
  leaderboard: v.array(leaderboardEntryValidator),
  configuration: v.object({
    categories: v.array(v.string()),
    roundCount: v.number(),
    availableCategories: v.array(v.string()),
    categoryQuestionCounts: v.array(v.object({ category: v.string(), count: v.number() })),
    roundOptions: v.array(v.object({ roundCount: v.number(), estimatedMinutes: v.number() })),
    estimatedMinutes: v.number(),
  }),
});

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

async function requireTriviaMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  rawSessionToken: string,
  requireActive: boolean
): Promise<{ room: Doc<'rooms'>; membership: Doc<'roomMembers'> }> {
  return await requireRoomMember(ctx, roomId, rawSessionToken, {
    gameType: 'trivia',
    requireActive,
  });
}

function triviaConfiguration(state: Doc<'triviaGameStates'>) {
  const configuredCategories = state.configuredCategories?.filter(isTriviaCategory) ?? [];
  const categories =
    configuredCategories.length > 0 ? [...new Set(configuredCategories)] : ([...TRIVIA_CATEGORIES] as TriviaCategory[]);
  const availableQuestionCount = TRIVIA_QUESTIONS.filter((question) =>
    categories.includes(question.category as TriviaCategory)
  ).length;
  const configuredRoundCount = state.configuredRoundCount ?? TRIVIA_DEFAULT_ROUND_COUNT;
  const roundCount =
    isTriviaRoundCount(configuredRoundCount) && configuredRoundCount <= availableQuestionCount
      ? configuredRoundCount
      : TRIVIA_DEFAULT_ROUND_COUNT;
  const estimatedMinutes = (rounds: number) =>
    Math.max(
      1,
      Math.ceil((TRIVIA_COUNTDOWN_MS + rounds * (TRIVIA_ANSWER_DURATION_MS + TRIVIA_REVEAL_DURATION_MS)) / 60_000)
    );
  return {
    categories,
    roundCount,
    availableCategories: [...TRIVIA_CATEGORIES],
    categoryQuestionCounts: TRIVIA_CATEGORIES.map((category) => ({
      category,
      count: TRIVIA_QUESTIONS.filter((question) => question.category === category).length,
    })),
    roundOptions: TRIVIA_ROUND_OPTIONS.map((option) => ({
      roundCount: option,
      estimatedMinutes: estimatedMinutes(option),
    })),
    estimatedMinutes: estimatedMinutes(roundCount),
  };
}

export const getGame = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: gameViewValidator,
  handler: async (ctx, args) => {
    const { membership } = await requireTriviaMember(ctx, args.roomId, args.sessionToken, false);
    const state = await findTriviaGameState(ctx, args.roomId);
    if (state === null) {
      throw new Error('Trivia game state is missing.');
    }
    const configuration = triviaConfiguration(state);

    const activeMembers = await listActiveRoomMembers(ctx, args.roomId);
    const scores = await ctx.db
      .query('triviaScores')
      .withIndex('by_roomId_and_gameNumber', (index) =>
        index.eq('roomId', args.roomId).eq('gameNumber', state.gameNumber)
      )
      .take(MAX_PLAYERS + 1);
    if (scores.length > MAX_PLAYERS) {
      throw new Error('Trivia score capacity invariant violated.');
    }
    const memberById = new Map(activeMembers.map((activeMember) => [activeMember._id, activeMember]));
    for (const score of scores) {
      if (!memberById.has(score.memberId)) {
        const scoreMember = await ctx.db.get('roomMembers', score.memberId);
        if (scoreMember !== null) {
          memberById.set(scoreMember._id, scoreMember);
        }
      }
    }
    if (state.gameNumber === 0) {
      for (const roomMember of await listRoomMembersForDisplay(ctx, args.roomId)) {
        memberById.set(roomMember._id, roomMember);
      }
    }

    const scoreByMemberId = new Map(scores.map((score) => [score.memberId, score]));
    const sortedLeaderboard = [...memberById.values()]
      .map((member) => {
        const score = scoreByMemberId.get(member._id);
        return {
          memberId: member._id,
          displayName: member.displayName,
          totalPoints: score?.totalPoints ?? 0,
          correctAnswers: score?.correctAnswers ?? 0,
          answersSubmitted: score?.answersSubmitted ?? 0,
          bestStreak: score?.bestStreak ?? 0,
          joinedAt: member.joinedAt,
          isActive: member.isActive,
        };
      })
      .sort(
        (first, second) =>
          second.totalPoints - first.totalPoints ||
          second.correctAnswers - first.correctAnswers ||
          second.bestStreak - first.bestStreak ||
          first.joinedAt - second.joinedAt
      );
    const leaderboard = sortedLeaderboard.map((entry, index) => ({
      rank: index + 1,
      memberId: entry.memberId,
      displayName: entry.displayName,
      totalPoints: entry.totalPoints,
      correctAnswers: entry.correctAnswers,
      answersSubmitted: entry.answersSubmitted,
      bestStreak: entry.bestStreak,
      pointsGained: null,
      isCurrentPlayer: entry.memberId === membership._id,
      isActive: entry.isActive,
    }));

    if (state.currentQuestionNumber < 1) {
      return {
        gameNumber: state.gameNumber,
        phase: state.phase,
        currentQuestionNumber: state.currentQuestionNumber,
        totalQuestions: state.totalQuestions,
        phaseStartedAt: state.phaseStartedAt,
        phaseEndsAt: state.phaseEndsAt,
        round: null,
        playerAnswer: null,
        leaderboard,
        configuration,
      };
    }

    const round = await findTriviaRound(ctx, args.roomId, state.gameNumber, state.currentQuestionNumber);
    if (round === null) {
      throw new Error('Current trivia round is missing.');
    }
    const answers = await ctx.db
      .query('triviaAnswers')
      .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id))
      .take(MAX_PLAYERS + 1);
    if (answers.length > MAX_PLAYERS) {
      throw new Error('Trivia answer capacity invariant violated.');
    }
    const playerAnswer = answers.find((answer) => answer.memberId === membership._id) ?? null;
    const isAnswerRevealed = state.phase === 'reveal' || state.phase === 'complete';
    const pointsGainedByMemberId =
      state.phase === 'reveal'
        ? new Map(answers.filter((answer) => answer.isCorrect).map((answer) => [answer.memberId, answer.pointsAwarded]))
        : null;
    const optionAnswerCounts = isAnswerRevealed
      ? round.options.map((_, optionIndex) =>
          answers.reduce((count, answer) => count + (answer.selectedOptionIndex === optionIndex ? 1 : 0), 0)
        )
      : null;

    return {
      gameNumber: state.gameNumber,
      phase: state.phase,
      currentQuestionNumber: state.currentQuestionNumber,
      totalQuestions: state.totalQuestions,
      phaseStartedAt: state.phaseStartedAt,
      phaseEndsAt: state.phaseEndsAt,
      round: {
        roundId: round._id,
        questionNumber: round.questionNumber,
        category: round.category,
        difficulty: round.difficulty,
        prompt: round.prompt,
        options: round.options,
        answer: isAnswerRevealed ? round.answer : null,
        correctOptionIndex: isAnswerRevealed ? round.correctOptionIndex : null,
        answeredCount: answers.length,
        optionAnswerCounts,
      },
      playerAnswer:
        playerAnswer === null
          ? null
          : {
              selectedOptionIndex: playerAnswer.selectedOptionIndex,
              pointsAwarded: playerAnswer.pointsAwarded,
              responseTimeMs: playerAnswer.responseTimeMs,
              isCorrect: isAnswerRevealed ? playerAnswer.isCorrect : null,
            },
      leaderboard: leaderboard.map((entry) => ({
        ...entry,
        pointsGained: pointsGainedByMemberId?.get(entry.memberId) ?? null,
      })),
      configuration,
    };
  },
});

export const configureGame = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    categories: v.array(v.string()),
    roundCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, membership } = await requireTriviaMember(ctx, args.roomId, args.sessionToken, true);
    if (membership.guestId !== room.ownerGuestId) {
      fail('NOT_ROOM_OWNER', 'Only the room owner can configure trivia.');
    }
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const state = await findTriviaGameState(ctx, room._id);
    if (state === null) {
      throw new Error('Trivia game state is missing.');
    }
    if (state.phase !== 'lobby') {
      fail('TRIVIA_GAME_IN_PROGRESS', 'Trivia settings can only be changed before the game starts.');
    }
    const uniqueCategories = [...new Set(args.categories)];
    if (
      uniqueCategories.length === 0 ||
      uniqueCategories.length !== args.categories.length ||
      !uniqueCategories.every(isTriviaCategory)
    ) {
      fail('INVALID_TRIVIA_CONFIGURATION', 'Choose at least one available trivia category.');
    }
    const availableQuestionCount = TRIVIA_QUESTIONS.filter((question) =>
      uniqueCategories.includes(question.category as TriviaCategory)
    ).length;
    if (!isTriviaRoundCount(args.roundCount) || args.roundCount > availableQuestionCount) {
      fail('INVALID_TRIVIA_CONFIGURATION', 'Choose an available number of rounds for those categories.');
    }
    await ctx.db.patch('triviaGameStates', state._id, {
      configuredCategories: uniqueCategories,
      configuredRoundCount: args.roundCount,
      totalQuestions: args.roundCount,
    });
    return null;
  },
});

export const startGame = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.object({ gameNumber: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireTriviaMember(ctx, args.roomId, args.sessionToken, true);
    if (membership.guestId !== room.ownerGuestId) {
      fail('NOT_ROOM_OWNER', 'Only the room owner can start trivia.');
    }
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const state = await findTriviaGameState(ctx, room._id);
    if (state === null) {
      throw new Error('Trivia game state is missing.');
    }
    if (state.phase === 'countdown' || state.phase === 'question' || state.phase === 'reveal') {
      fail('TRIVIA_GAME_IN_PROGRESS', 'A trivia game is already in progress.');
    }
    if (state.phase === 'complete') {
      fail('STALE_ROOM_GAME', 'Finish the next-game vote before playing trivia again.');
    }

    const gameNumber = state.gameNumber + 1;
    const now = Date.now();
    await activateCurrentRoomGame(ctx, room, 'trivia', now);
    const participants = await listActiveRoomMembers(ctx, room._id);
    for (const participant of participants) {
      await ctx.db.insert('triviaScores', {
        roomId: room._id,
        gameNumber,
        memberId: participant._id,
        displayName: participant.displayName,
        totalPoints: 0,
        correctAnswers: 0,
        answersSubmitted: 0,
        currentStreak: 0,
        bestStreak: 0,
        updatedAt: now,
      });
    }
    const configuration = triviaConfiguration(state);
    const selectedQuestions = selectTriviaQuestions(configuration.categories, configuration.roundCount);
    for (const [index, selectedQuestion] of selectedQuestions.entries()) {
      await ctx.db.insert('triviaRounds', {
        roomId: room._id,
        gameNumber,
        questionNumber: index + 1,
        sourceType: 'bank',
        sourceId: selectedQuestion.id,
        category: selectedQuestion.category,
        difficulty: 'hard',
        prompt: selectedQuestion.prompt,
        options: [...selectedQuestion.options],
        answer: selectedQuestion.answer,
        correctOptionIndex: selectedQuestion.correctOptionIndex,
        scoreCommitMode: 'on_reveal',
      });
    }

    await ctx.db.patch('triviaGameStates', state._id, {
      gameNumber,
      phase: 'countdown',
      currentQuestionNumber: 0,
      totalQuestions: configuration.roundCount,
      phaseStartedAt: now,
      phaseEndsAt: now + TRIVIA_COUNTDOWN_MS,
    });
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
      TRIVIA_COUNTDOWN_MS,
      internal.trivia.beginQuestion,
      { stateId: state._id, gameNumber, questionNumber: 1 }
    );
    void scheduledId;
    return { gameNumber };
  },
});

export const submitAnswer = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), selectedOptionIndex: v.number() },
  returns: v.object({ pointsAwarded: v.number(), responseTimeMs: v.number() }),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.selectedOptionIndex) || args.selectedOptionIndex < 0 || args.selectedOptionIndex > 3) {
      fail('INVALID_TRIVIA_OPTION', 'Choose one of the four answer options.');
    }
    const { room, membership } = await requireTriviaMember(ctx, args.roomId, args.sessionToken, true);
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const now = Date.now();
    const result = await recordTriviaAnswer(ctx, room, membership, args.selectedOptionIndex, now);
    if (result.kind === 'not_running') {
      fail('TRIVIA_GAME_NOT_RUNNING', 'There is no open trivia question.');
    }
    if (result.kind === 'closed') {
      fail('TRIVIA_ANSWER_CLOSED', 'Time is up for this question.');
    }
    return { pointsAwarded: result.pointsAwarded, responseTimeMs: result.responseTimeMs };
  },
});

export const beginQuestion = internalMutation({
  args: { stateId: v.id('triviaGameStates'), gameNumber: v.number(), questionNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('triviaGameStates', args.stateId);
    if (state === null || state.gameNumber !== args.gameNumber) {
      return null;
    }
    const expectedPhase = args.questionNumber === 1 ? 'countdown' : 'reveal';
    if (state.phase !== expectedPhase || state.currentQuestionNumber !== args.questionNumber - 1) {
      return null;
    }
    const room = await ctx.db.get('rooms', state.roomId);
    if (room === null || room.status === 'closed') {
      await ctx.db.patch('triviaGameStates', state._id, {
        phase: 'complete',
        phaseStartedAt: Date.now(),
        phaseEndsAt: null,
      });
      return null;
    }
    const round = await findTriviaRound(ctx, state.roomId, args.gameNumber, args.questionNumber);
    if (round === null) {
      throw new Error('Scheduled trivia round is missing.');
    }

    const now = Date.now();
    await ctx.db.patch('triviaGameStates', state._id, {
      phase: 'question',
      currentQuestionNumber: args.questionNumber,
      phaseStartedAt: now,
      phaseEndsAt: now + TRIVIA_ANSWER_DURATION_MS,
    });
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
      TRIVIA_ANSWER_DURATION_MS,
      internal.trivia.closeQuestion,
      { stateId: state._id, gameNumber: args.gameNumber, questionNumber: args.questionNumber }
    );
    void scheduledId;
    return null;
  },
});

export const closeQuestion = internalMutation({
  args: { stateId: v.id('triviaGameStates'), gameNumber: v.number(), questionNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('triviaGameStates', args.stateId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.phase !== 'question' ||
      state.currentQuestionNumber !== args.questionNumber
    ) {
      return null;
    }

    await revealTriviaQuestion(ctx, state, args.gameNumber, args.questionNumber);
    return null;
  },
});

export const finishGame = internalMutation({
  args: { stateId: v.id('triviaGameStates'), gameNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('triviaGameStates', args.stateId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.phase !== 'reveal' ||
      state.currentQuestionNumber !== state.totalQuestions
    ) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch('triviaGameStates', state._id, {
      phase: 'complete',
      phaseStartedAt: now,
      phaseEndsAt: null,
    });
    const room = await ctx.db.get('rooms', state.roomId);
    if (room !== null && room.status !== 'closed') {
      await completeCurrentRoomGame(ctx, room, 'trivia', now);
    }
    return null;
  },
});
