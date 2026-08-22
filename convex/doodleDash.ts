import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx, mutation, type QueryCtx, query } from './_generated/server';
import { fail, MAX_PLAYERS, normalizePoint } from './domain';
import {
  createDoodleDashHintOrder,
  DOODLE_DASH_CHOICE_DURATION_MS,
  DOODLE_DASH_COLORS,
  DOODLE_DASH_FINAL_COUNTDOWN_MS,
  DOODLE_DASH_MAX_MESSAGES_PER_MEMBER,
  DOODLE_DASH_MAX_STROKE_POINTS,
  DOODLE_DASH_MAX_STROKES,
  DOODLE_DASH_MAX_VISIBLE_MESSAGES,
  DOODLE_DASH_REVEAL_DURATION_MS,
  doodleDashWordLengths,
  estimateDoodleDashMinutes,
  findDoodleDashGameState,
  isCloseDoodleDashGuess,
  latestActiveDoodleDashStroke,
  maskDoodleDashWord,
  nextRedoDoodleDashStroke,
  normalizeDoodleDashGuessForComparison,
  normalizeDoodleDashGuessText,
} from './doodleDashEngine';
import { calculateDoodleDashPoints } from './doodleDashScoring';
import {
  DOODLE_DASH_CATEGORIES,
  DOODLE_DASH_DEFAULT_DRAW_DURATION_MS,
  DOODLE_DASH_DEFAULT_ROUND_COUNT,
  DOODLE_DASH_DRAW_DURATION_OPTIONS_MS,
  DOODLE_DASH_ROUND_OPTIONS,
  DOODLE_DASH_WORDS,
  type DoodleDashCategory,
  isDoodleDashCategory,
  isDoodleDashDrawDuration,
  isDoodleDashRoundCount,
  selectDoodleDashWordOptions,
} from './doodleDashWords';
import { requireRoomMember } from './roomAccess';
import { activateCurrentRoomGame, completeCurrentRoomGame } from './roomGames';
import { listActiveHumanRoomMembers, listRoomMembersForDisplay } from './roomMembers';

const MAX_GAME_TURNS = MAX_PLAYERS * Math.max(...DOODLE_DASH_ROUND_OPTIONS);
const ALLOWED_PEN_WIDTHS = [5, 10, 18] as const;
const ALLOWED_ERASER_WIDTHS = [20, 36] as const;

const doodleDashPhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('choosing'),
  v.literal('drawing'),
  v.literal('reveal'),
  v.literal('complete')
);

const leaderboardEntryValidator = v.object({
  rank: v.number(),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  totalPoints: v.number(),
  guessPoints: v.number(),
  drawPoints: v.number(),
  wordsGuessed: v.number(),
  drawingTurns: v.number(),
  correctGuessers: v.number(),
  pointsGained: v.union(v.number(), v.null()),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
  isDrawer: v.boolean(),
  hasGuessedCurrentWord: v.boolean(),
});

const strokeValidator = v.object({
  strokeId: v.id('doodleDashStrokes'),
  sequence: v.number(),
  actionId: v.string(),
  tool: v.union(v.literal('pen'), v.literal('eraser'), v.literal('fill')),
  color: v.string(),
  width: v.number(),
  points: v.array(v.object({ x: v.number(), y: v.number() })),
});

const messageValidator = v.object({
  messageId: v.id('doodleDashMessages'),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  kind: v.union(v.literal('guess'), v.literal('correct')),
  text: v.union(v.string(), v.null()),
  isClose: v.boolean(),
  isCurrentPlayer: v.boolean(),
  createdAt: v.number(),
});

const roundViewValidator = v.object({
  roundId: v.id('doodleDashRounds'),
  turnNumber: v.number(),
  roundNumber: v.number(),
  totalTurns: v.number(),
  drawerMemberId: v.id('roomMembers'),
  drawerDisplayName: v.string(),
  isDrawer: v.boolean(),
  wordOptions: v.array(v.object({ optionIndex: v.number(), word: v.string(), category: v.string() })),
  word: v.union(v.string(), v.null()),
  category: v.union(v.string(), v.null()),
  hint: v.union(v.string(), v.null()),
  wordLengths: v.array(v.number()),
  correctGuessCount: v.number(),
  eligibleGuesserCount: v.number(),
  canUndo: v.boolean(),
  canRedo: v.boolean(),
  strokes: v.array(strokeValidator),
  messages: v.array(messageValidator),
});

const configurationValidator = v.object({
  categories: v.array(v.string()),
  roundCount: v.number(),
  drawDurationMs: v.number(),
  availableCategories: v.array(v.object({ category: v.string(), wordCount: v.number() })),
  roundOptions: v.array(v.number()),
  drawDurationOptionsMs: v.array(v.number()),
  estimatedMinutes: v.number(),
});

const gameViewValidator = v.object({
  gameNumber: v.number(),
  phase: doodleDashPhaseValidator,
  currentTurnNumber: v.number(),
  totalTurns: v.number(),
  phaseStartedAt: v.union(v.number(), v.null()),
  phaseEndsAt: v.union(v.number(), v.null()),
  isParticipant: v.boolean(),
  canGuess: v.boolean(),
  round: v.union(roundViewValidator, v.null()),
  leaderboard: v.array(leaderboardEntryValidator),
  configuration: configurationValidator,
});

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

async function requireDoodleDashMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  sessionToken: string,
  requireActive: boolean
): Promise<{ room: Doc<'rooms'>; membership: Doc<'roomMembers'> }> {
  return await requireRoomMember(ctx, roomId, sessionToken, {
    gameType: 'doodleDash',
    requireActive,
    allowPlaytestBots: false,
  });
}

function shuffledMemberIds(members: readonly Doc<'roomMembers'>[]): Id<'roomMembers'>[] {
  const ids = members.map((member) => member._id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  return ids;
}

function resolveConfiguration(state: Doc<'doodleDashGameStates'>, participantCount: number) {
  const configuredCategories = state.configuredCategories?.filter(isDoodleDashCategory) ?? [];
  const categories =
    configuredCategories.length > 0
      ? [...new Set(configuredCategories)]
      : ([...DOODLE_DASH_CATEGORIES] as DoodleDashCategory[]);
  const roundCount = isDoodleDashRoundCount(state.configuredRoundCount ?? -1)
    ? (state.configuredRoundCount ?? DOODLE_DASH_DEFAULT_ROUND_COUNT)
    : DOODLE_DASH_DEFAULT_ROUND_COUNT;
  const drawDurationMs = isDoodleDashDrawDuration(state.configuredDrawDurationMs ?? -1)
    ? (state.configuredDrawDurationMs ?? DOODLE_DASH_DEFAULT_DRAW_DURATION_MS)
    : DOODLE_DASH_DEFAULT_DRAW_DURATION_MS;
  return {
    categories,
    roundCount,
    drawDurationMs,
    availableCategories: DOODLE_DASH_CATEGORIES.map((category) => ({
      category,
      wordCount: DOODLE_DASH_WORDS.filter((entry) => entry.category === category).length,
    })),
    roundOptions: [...DOODLE_DASH_ROUND_OPTIONS],
    drawDurationOptionsMs: [...DOODLE_DASH_DRAW_DURATION_OPTIONS_MS],
    estimatedMinutes: estimateDoodleDashMinutes(participantCount, roundCount, drawDurationMs),
  };
}

async function findScore(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  gameNumber: number,
  memberId: Id<'roomMembers'>
) {
  return await ctx.db
    .query('doodleDashScores')
    .withIndex('by_roomId_and_gameNumber_and_memberId', (index) =>
      index.eq('roomId', roomId).eq('gameNumber', gameNumber).eq('memberId', memberId)
    )
    .unique();
}

async function finishDoodleDashGame(
  ctx: MutationCtx,
  state: Doc<'doodleDashGameStates'>,
  room: Doc<'rooms'>,
  now: number
): Promise<void> {
  await ctx.db.patch('doodleDashGameStates', state._id, {
    phase: 'complete',
    phaseStartedAt: now,
    phaseEndsAt: null,
  });
  await completeCurrentRoomGame(ctx, room, 'doodleDash', now);
}

async function startDoodleDashTurn(
  ctx: MutationCtx,
  state: Doc<'doodleDashGameStates'>,
  room: Doc<'rooms'>,
  gameNumber: number,
  requestedTurnNumber: number,
  turnOrder: Id<'roomMembers'>[],
  totalTurns: number,
  categories: DoodleDashCategory[],
  now: number
): Promise<void> {
  let turnNumber = requestedTurnNumber;
  let drawer: Doc<'roomMembers'> | null = null;
  while (turnNumber <= totalTurns) {
    const candidateId = turnOrder[(turnNumber - 1) % turnOrder.length];
    const candidate = candidateId === undefined ? null : await ctx.db.get('roomMembers', candidateId);
    if (candidate?.isActive === true) {
      drawer = candidate;
      break;
    }
    turnNumber += 1;
  }
  if (drawer === null) {
    await finishDoodleDashGame(ctx, state, room, now);
    return;
  }

  const previousRounds = await ctx.db
    .query('doodleDashRounds')
    .withIndex('by_roomId_and_gameNumber_and_turnNumber', (index) =>
      index.eq('roomId', room._id).eq('gameNumber', gameNumber)
    )
    .take(MAX_GAME_TURNS + 1);
  if (previousRounds.length > MAX_GAME_TURNS) {
    throw new Error('Doodle Dash turn capacity invariant violated.');
  }
  const excludedWords = new Set(
    previousRounds.flatMap((previousRound) => (previousRound.selectedWord === null ? [] : [previousRound.selectedWord]))
  );
  const wordOptions = selectDoodleDashWordOptions(categories, excludedWords);
  let eligibleGuesserCount = 0;
  for (const memberId of turnOrder) {
    if (memberId === drawer._id) continue;
    const member = await ctx.db.get('roomMembers', memberId);
    if (member?.isActive === true) eligibleGuesserCount += 1;
  }

  const roundId = await ctx.db.insert('doodleDashRounds', {
    roomId: room._id,
    gameNumber,
    turnNumber,
    cycleNumber: Math.floor((turnNumber - 1) / turnOrder.length) + 1,
    drawerMemberId: drawer._id,
    drawerDisplayName: drawer.displayName,
    wordOptions,
    selectedWord: null,
    selectedCategory: null,
    hintOrder: [],
    revealedLetterCount: 0,
    status: 'choosing',
    choiceStartedAt: now,
    drawStartedAt: null,
    drawEndsAt: null,
    revealedAt: null,
    eligibleGuesserCount,
    correctGuessCount: 0,
    firstCorrectAt: null,
    nextStrokeSequence: 1,
  });
  const drawerScore = await findScore(ctx, room._id, gameNumber, drawer._id);
  if (drawerScore !== null) {
    await ctx.db.patch('doodleDashScores', drawerScore._id, {
      displayName: drawer.displayName,
      drawingTurns: drawerScore.drawingTurns + 1,
      updatedAt: now,
    });
  }
  await ctx.db.patch('doodleDashGameStates', state._id, {
    phase: 'choosing',
    currentRoundId: roundId,
    currentTurnNumber: turnNumber,
    totalTurns,
    turnOrder,
    phaseStartedAt: now,
    phaseEndsAt: now + DOODLE_DASH_CHOICE_DURATION_MS,
  });
  const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
    DOODLE_DASH_CHOICE_DURATION_MS,
    internal.doodleDash.autoSelectWord,
    { stateId: state._id, roundId, gameNumber, turnNumber }
  );
  void scheduledId;
}

async function beginDrawing(
  ctx: MutationCtx,
  state: Doc<'doodleDashGameStates'>,
  round: Doc<'doodleDashRounds'>,
  optionIndex: number,
  now: number
): Promise<void> {
  const selected = round.wordOptions[optionIndex];
  if (selected === undefined) {
    fail('INVALID_DOODLE_DASH_WORD_OPTION', 'Choose one of the three word options.');
  }
  const configuration = resolveConfiguration(state, state.turnOrder.length);
  const drawEndsAt = now + configuration.drawDurationMs;
  await ctx.db.patch('doodleDashRounds', round._id, {
    selectedWord: selected.word,
    selectedCategory: selected.category,
    hintOrder: createDoodleDashHintOrder(selected.word),
    revealedLetterCount: 0,
    status: 'drawing',
    drawStartedAt: now,
    drawEndsAt,
  });
  await ctx.db.patch('doodleDashGameStates', state._id, {
    phase: 'drawing',
    phaseStartedAt: now,
    phaseEndsAt: drawEndsAt,
  });

  const scheduledEndId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
    configuration.drawDurationMs,
    internal.doodleDash.endTurn,
    { stateId: state._id, roundId: round._id, gameNumber: state.gameNumber, turnNumber: round.turnNumber }
  );
  void scheduledEndId;
  for (const revealCount of [1, 2, 3]) {
    const scheduledHintId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
      Math.floor((configuration.drawDurationMs * revealCount) / 4),
      internal.doodleDash.revealHint,
      {
        stateId: state._id,
        roundId: round._id,
        gameNumber: state.gameNumber,
        turnNumber: round.turnNumber,
        revealCount,
      }
    );
    void scheduledHintId;
  }
}

async function revealCurrentWord(
  ctx: MutationCtx,
  state: Doc<'doodleDashGameStates'>,
  round: Doc<'doodleDashRounds'>,
  now: number
): Promise<void> {
  if (state.phase !== 'drawing' || round.status !== 'drawing') return;
  await ctx.db.patch('doodleDashRounds', round._id, { status: 'reveal', revealedAt: now });
  await ctx.db.patch('doodleDashGameStates', state._id, {
    phase: 'reveal',
    phaseStartedAt: now,
    phaseEndsAt: now + DOODLE_DASH_REVEAL_DURATION_MS,
  });
  const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
    DOODLE_DASH_REVEAL_DURATION_MS,
    internal.doodleDash.advanceTurn,
    { stateId: state._id, roundId: round._id, gameNumber: state.gameNumber, turnNumber: round.turnNumber }
  );
  void scheduledId;
}

export const getGame = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: gameViewValidator,
  handler: async (ctx, args) => {
    const { membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, false);
    const state = await findDoodleDashGameState(ctx, args.roomId);
    if (state === null) throw new Error('Doodle Dash game state is missing.');

    const scores = await ctx.db
      .query('doodleDashScores')
      .withIndex('by_roomId_and_gameNumber', (index) =>
        index.eq('roomId', args.roomId).eq('gameNumber', state.gameNumber)
      )
      .take(MAX_PLAYERS + 1);
    if (scores.length > MAX_PLAYERS) throw new Error('Doodle Dash score capacity invariant violated.');
    const displayMembers = await listRoomMembersForDisplay(ctx, args.roomId);
    const memberById = new Map(displayMembers.map((member) => [member._id, member]));
    const participantMemberIds = new Set(scores.map((score) => score.memberId));
    const round = state.currentRoundId === null ? null : await ctx.db.get('doodleDashRounds', state.currentRoundId);
    if (round !== null && (round.roomId !== args.roomId || round.gameNumber !== state.gameNumber)) {
      throw new Error('Doodle Dash current round pointer is invalid.');
    }
    const currentGuesses =
      round === null
        ? []
        : await ctx.db
            .query('doodleDashCorrectGuesses')
            .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id))
            .take(MAX_PLAYERS + 1);
    if (currentGuesses.length > MAX_PLAYERS) throw new Error('Doodle Dash guess capacity invariant violated.');
    const correctByMemberId = new Map(currentGuesses.map((guess) => [guess.memberId, guess]));
    const pointsGainedByMemberId = new Map<Id<'roomMembers'>, number>();
    if (state.phase === 'reveal' && round !== null) {
      for (const correctGuess of currentGuesses) {
        pointsGainedByMemberId.set(correctGuess.memberId, correctGuess.guessPoints);
        pointsGainedByMemberId.set(
          round.drawerMemberId,
          (pointsGainedByMemberId.get(round.drawerMemberId) ?? 0) + correctGuess.drawerPoints
        );
      }
    }

    const leaderboardSource =
      state.gameNumber === 0
        ? displayMembers.map((member) => ({ member, score: null }))
        : scores.map((score) => ({ member: memberById.get(score.memberId) ?? null, score }));
    const sortedLeaderboard = leaderboardSource
      .map(({ member, score }) => ({
        memberId: score?.memberId ?? member?._id,
        displayName: score?.displayName ?? member?.displayName ?? 'Player',
        totalPoints: score?.totalPoints ?? 0,
        guessPoints: score?.guessPoints ?? 0,
        drawPoints: score?.drawPoints ?? 0,
        wordsGuessed: score?.wordsGuessed ?? 0,
        drawingTurns: score?.drawingTurns ?? 0,
        correctGuessers: score?.correctGuessers ?? 0,
        joinedAt: member?.joinedAt ?? Number.MAX_SAFE_INTEGER,
        isActive: member?.isActive ?? false,
      }))
      .filter((entry): entry is typeof entry & { memberId: Id<'roomMembers'> } => entry.memberId !== undefined)
      .sort(
        (left, right) =>
          right.totalPoints - left.totalPoints ||
          right.wordsGuessed - left.wordsGuessed ||
          right.drawPoints - left.drawPoints ||
          left.joinedAt - right.joinedAt
      );
    const leaderboard = sortedLeaderboard.map((entry, index) => ({
      rank: index + 1,
      memberId: entry.memberId,
      displayName: entry.displayName,
      totalPoints: entry.totalPoints,
      guessPoints: entry.guessPoints,
      drawPoints: entry.drawPoints,
      wordsGuessed: entry.wordsGuessed,
      drawingTurns: entry.drawingTurns,
      correctGuessers: entry.correctGuessers,
      pointsGained: pointsGainedByMemberId.get(entry.memberId) ?? null,
      isCurrentPlayer: entry.memberId === membership._id,
      isActive: entry.isActive,
      isDrawer: round?.drawerMemberId === entry.memberId,
      hasGuessedCurrentWord: correctByMemberId.has(entry.memberId),
    }));
    const configurationParticipantCount =
      state.phase === 'lobby'
        ? (await listActiveHumanRoomMembers(ctx, args.roomId)).length
        : scores.length || displayMembers.filter((member) => member.isActive).length;
    const configuration = resolveConfiguration(state, configurationParticipantCount);
    if (round === null) {
      return {
        gameNumber: state.gameNumber,
        phase: state.phase,
        currentTurnNumber: state.currentTurnNumber,
        totalTurns: state.totalTurns,
        phaseStartedAt: state.phaseStartedAt,
        phaseEndsAt: state.phaseEndsAt,
        isParticipant: participantMemberIds.has(membership._id) || state.gameNumber === 0,
        canGuess: false,
        round: null,
        leaderboard,
        configuration,
      };
    }

    const [allStrokes, recentMessages] = await Promise.all([
      ctx.db
        .query('doodleDashStrokes')
        .withIndex('by_roundId_and_sequence', (index) => index.eq('roundId', round._id))
        .take(DOODLE_DASH_MAX_STROKES + 1),
      ctx.db
        .query('doodleDashMessages')
        .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
        .order('desc')
        .take(DOODLE_DASH_MAX_VISIBLE_MESSAGES),
    ]);
    if (allStrokes.length > DOODLE_DASH_MAX_STROKES) {
      throw new Error('Doodle Dash stroke capacity invariant violated.');
    }
    const strokes = allStrokes.filter((stroke) => stroke.isUndone !== true);
    const isDrawer = round.drawerMemberId === membership._id;
    const isRevealed = state.phase === 'reveal' || state.phase === 'complete';
    const canSeeWord = isDrawer || isRevealed;
    const hasGuessed = correctByMemberId.has(membership._id);
    const isParticipant = participantMemberIds.has(membership._id);
    const canGuess = state.phase === 'drawing' && isParticipant && !isDrawer && !hasGuessed && membership.isActive;
    return {
      gameNumber: state.gameNumber,
      phase: state.phase,
      currentTurnNumber: state.currentTurnNumber,
      totalTurns: state.totalTurns,
      phaseStartedAt: state.phaseStartedAt,
      phaseEndsAt: state.phaseEndsAt,
      isParticipant,
      canGuess,
      round: {
        roundId: round._id,
        turnNumber: round.turnNumber,
        roundNumber: round.cycleNumber,
        totalTurns: state.totalTurns,
        drawerMemberId: round.drawerMemberId,
        drawerDisplayName: round.drawerDisplayName,
        isDrawer,
        wordOptions:
          isDrawer && state.phase === 'choosing'
            ? round.wordOptions.map((option, optionIndex) => ({ optionIndex, ...option }))
            : [],
        word: canSeeWord ? round.selectedWord : null,
        category: round.selectedCategory,
        hint:
          !canSeeWord && round.selectedWord !== null
            ? maskDoodleDashWord(round.selectedWord, round.hintOrder, round.revealedLetterCount)
            : null,
        wordLengths: round.selectedWord === null ? [] : doodleDashWordLengths(round.selectedWord),
        correctGuessCount: round.correctGuessCount,
        eligibleGuesserCount: round.eligibleGuesserCount,
        canUndo: strokes.length > 0,
        canRedo: allStrokes.some((stroke) => stroke.isUndone === true),
        strokes: strokes.map((stroke) => ({
          strokeId: stroke._id,
          sequence: stroke.sequence,
          actionId: stroke.actionId ?? String(stroke._id),
          tool: stroke.tool,
          color: stroke.color,
          width: stroke.width,
          points: stroke.points,
        })),
        messages: recentMessages.reverse().map((message) => ({
          messageId: message._id,
          memberId: message.memberId,
          displayName: message.displayName,
          kind: message.kind,
          text: message.text ?? null,
          isClose: message.memberId === membership._id && message.isClose,
          isCurrentPlayer: message.memberId === membership._id,
          createdAt: message.createdAt,
        })),
      },
      leaderboard,
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
    drawDurationMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    if (membership.guestId !== room.ownerGuestId)
      fail('NOT_ROOM_OWNER', 'Only the room owner can configure Doodle Dash.');
    if (room.status === 'closed') fail('ROOM_CLOSED', 'This room is closed.');
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null) throw new Error('Doodle Dash game state is missing.');
    if (state.phase !== 'lobby') {
      fail('DOODLE_DASH_IN_PROGRESS', 'Doodle Dash settings can only be changed before the game starts.');
    }
    const categories = [...new Set(args.categories)];
    if (
      categories.length < 1 ||
      categories.length !== args.categories.length ||
      !categories.every(isDoodleDashCategory) ||
      !isDoodleDashRoundCount(args.roundCount) ||
      !isDoodleDashDrawDuration(args.drawDurationMs)
    ) {
      fail('INVALID_DOODLE_DASH_CONFIGURATION', 'Choose available categories, rounds, and drawing time.');
    }
    await ctx.db.patch('doodleDashGameStates', state._id, {
      configuredCategories: categories,
      configuredRoundCount: args.roundCount,
      configuredDrawDurationMs: args.drawDurationMs,
    });
    return null;
  },
});

export const startGame = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.object({ gameNumber: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    if (membership.guestId !== room.ownerGuestId) fail('NOT_ROOM_OWNER', 'Only the room owner can start Doodle Dash.');
    if (room.status === 'closed') fail('ROOM_CLOSED', 'This room is closed.');
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null) throw new Error('Doodle Dash game state is missing.');
    if (state.phase !== 'lobby') {
      fail(
        state.phase === 'complete' ? 'STALE_ROOM_GAME' : 'DOODLE_DASH_IN_PROGRESS',
        state.phase === 'complete'
          ? 'Finish the next-game vote before playing Doodle Dash again.'
          : 'A Doodle Dash game is already in progress.'
      );
    }
    const participants = await listActiveHumanRoomMembers(ctx, room._id);
    if (participants.length < 2) {
      fail('ROOM_ACTION_NOT_ELIGIBLE', 'Doodle Dash needs at least two players.');
    }
    const configuration = resolveConfiguration(state, participants.length);
    const turnOrder = shuffledMemberIds(participants);
    const totalTurns = turnOrder.length * configuration.roundCount;
    const gameNumber = state.gameNumber + 1;
    const now = Date.now();
    await activateCurrentRoomGame(ctx, room, 'doodleDash', now);
    for (const participant of participants) {
      await ctx.db.insert('doodleDashScores', {
        roomId: room._id,
        gameNumber,
        memberId: participant._id,
        displayName: participant.displayName,
        totalPoints: 0,
        guessPoints: 0,
        drawPoints: 0,
        wordsGuessed: 0,
        drawingTurns: 0,
        correctGuessers: 0,
        updatedAt: now,
      });
    }
    await ctx.db.patch('doodleDashGameStates', state._id, {
      gameNumber,
      turnOrder,
      totalTurns,
      currentTurnNumber: 0,
    });
    await startDoodleDashTurn(
      ctx,
      { ...state, gameNumber, turnOrder, totalTurns },
      room,
      gameNumber,
      1,
      turnOrder,
      totalTurns,
      configuration.categories,
      now
    );
    return { gameNumber };
  },
});

export const chooseWord = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), optionIndex: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.optionIndex) || args.optionIndex < 0 || args.optionIndex > 2) {
      fail('INVALID_DOODLE_DASH_WORD_OPTION', 'Choose one of the three word options.');
    }
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null || state.currentRoundId === null || state.phase !== 'choosing') {
      fail('DOODLE_DASH_CHOICE_CLOSED', 'The word choice is closed.');
    }
    const round = await ctx.db.get('doodleDashRounds', state.currentRoundId);
    if (round === null || round.drawerMemberId !== membership._id) {
      fail('DOODLE_DASH_NOT_DRAWER', 'Only the current drawer can choose the word.');
    }
    await beginDrawing(ctx, state, round, args.optionIndex, Date.now());
    return null;
  },
});

export const submitGuess = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), guess: v.string() },
  returns: v.object({
    kind: v.union(v.literal('guess'), v.literal('close'), v.literal('correct')),
    pointsAwarded: v.number(),
  }),
  handler: async (ctx, args) => {
    let guessText: string;
    try {
      guessText = normalizeDoodleDashGuessText(args.guess);
    } catch {
      fail('INVALID_DOODLE_DASH_GUESS', 'Enter a guess with 1–80 visible characters.');
    }
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null || state.currentRoundId === null || state.phase !== 'drawing') {
      fail('DOODLE_DASH_GUESS_CLOSED', 'This guessing round is closed.');
    }
    const round = await ctx.db.get('doodleDashRounds', state.currentRoundId);
    if (round === null || round.selectedWord === null || round.drawStartedAt === null || round.drawEndsAt === null) {
      fail('DOODLE_DASH_NOT_RUNNING', 'There is no active Doodle Dash turn.');
    }
    if (membership._id === round.drawerMemberId) {
      fail('DOODLE_DASH_NOT_GUESSER', 'The drawer cannot submit guesses.');
    }
    const participantScore = await findScore(ctx, room._id, state.gameNumber, membership._id);
    if (participantScore === null) {
      fail('DOODLE_DASH_NOT_GUESSER', 'You joined after this game started and can play in the next game.');
    }
    const existingCorrect = await ctx.db
      .query('doodleDashCorrectGuesses')
      .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
      .unique();
    if (existingCorrect !== null) {
      fail('DOODLE_DASH_ALREADY_GUESSED', 'You already guessed this word.');
    }
    const memberMessages = await ctx.db
      .query('doodleDashMessages')
      .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
      .take(DOODLE_DASH_MAX_MESSAGES_PER_MEMBER + 1);
    if (memberMessages.length >= DOODLE_DASH_MAX_MESSAGES_PER_MEMBER) {
      fail('DOODLE_DASH_GUESS_CLOSED', 'You reached the guess limit for this turn.');
    }
    const now = Date.now();
    if (now > round.drawEndsAt) fail('DOODLE_DASH_GUESS_CLOSED', 'Time is up for this word.');
    const isCorrect =
      normalizeDoodleDashGuessForComparison(guessText) === normalizeDoodleDashGuessForComparison(round.selectedWord);
    const isClose = !isCorrect && isCloseDoodleDashGuess(guessText, round.selectedWord);
    if (!isCorrect) {
      await ctx.db.insert('doodleDashMessages', {
        roomId: room._id,
        gameNumber: state.gameNumber,
        roundId: round._id,
        memberId: membership._id,
        displayName: membership.displayName,
        kind: 'guess',
        text: guessText,
        isClose,
        createdAt: now,
      });
      return { kind: isClose ? ('close' as const) : ('guess' as const), pointsAwarded: 0 };
    }

    const responseTimeMs = Math.max(0, Math.min(round.drawEndsAt - round.drawStartedAt, now - round.drawStartedAt));
    const configuration = resolveConfiguration(state, state.turnOrder.length);
    const { guessPoints, drawerPoints } = calculateDoodleDashPoints(responseTimeMs, configuration.drawDurationMs);
    await ctx.db.insert('doodleDashCorrectGuesses', {
      roomId: room._id,
      gameNumber: state.gameNumber,
      roundId: round._id,
      memberId: membership._id,
      responseTimeMs,
      guessPoints,
      drawerPoints,
      submittedAt: now,
    });
    await ctx.db.insert('doodleDashMessages', {
      roomId: room._id,
      gameNumber: state.gameNumber,
      roundId: round._id,
      memberId: membership._id,
      displayName: membership.displayName,
      kind: 'correct',
      isClose: false,
      createdAt: now,
    });
    await ctx.db.patch('doodleDashScores', participantScore._id, {
      displayName: membership.displayName,
      totalPoints: participantScore.totalPoints + guessPoints,
      guessPoints: participantScore.guessPoints + guessPoints,
      wordsGuessed: participantScore.wordsGuessed + 1,
      updatedAt: now,
    });
    const drawerScore = await findScore(ctx, room._id, state.gameNumber, round.drawerMemberId);
    if (drawerScore !== null) {
      await ctx.db.patch('doodleDashScores', drawerScore._id, {
        totalPoints: drawerScore.totalPoints + drawerPoints,
        drawPoints: drawerScore.drawPoints + drawerPoints,
        correctGuessers: drawerScore.correctGuessers + 1,
        updatedAt: now,
      });
    }
    const correctGuessCount = round.correctGuessCount + 1;
    const firstCorrectAt = round.firstCorrectAt ?? now;
    await ctx.db.patch('doodleDashRounds', round._id, { correctGuessCount, firstCorrectAt });

    let activeEligibleGuesserCount = 0;
    for (const memberId of state.turnOrder) {
      if (memberId === round.drawerMemberId) continue;
      const member = await ctx.db.get('roomMembers', memberId);
      if (member?.isActive === true) activeEligibleGuesserCount += 1;
    }
    if (correctGuessCount >= activeEligibleGuesserCount) {
      await revealCurrentWord(ctx, state, { ...round, correctGuessCount, firstCorrectAt }, now);
    } else if (round.firstCorrectAt === null && state.phaseEndsAt !== null) {
      const shortenedEndsAt = Math.min(state.phaseEndsAt, now + DOODLE_DASH_FINAL_COUNTDOWN_MS);
      if (shortenedEndsAt < state.phaseEndsAt) {
        await ctx.db.patch('doodleDashRounds', round._id, { drawEndsAt: shortenedEndsAt });
        await ctx.db.patch('doodleDashGameStates', state._id, { phaseEndsAt: shortenedEndsAt });
        const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
          shortenedEndsAt - now,
          internal.doodleDash.endTurn,
          { stateId: state._id, roundId: round._id, gameNumber: state.gameNumber, turnNumber: round.turnNumber }
        );
        void scheduledId;
      }
    }
    return { kind: 'correct' as const, pointsAwarded: guessPoints };
  },
});

export const appendStroke = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    actionId: v.string(),
    tool: v.union(v.literal('pen'), v.literal('eraser'), v.literal('fill')),
    color: v.string(),
    width: v.number(),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
  },
  returns: v.object({ sequence: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null || state.currentRoundId === null || state.phase !== 'drawing') {
      fail('DOODLE_DASH_DRAWING_CLOSED', 'The drawing canvas is closed.');
    }
    const round = await ctx.db.get('doodleDashRounds', state.currentRoundId);
    if (round === null || round.drawerMemberId !== membership._id) {
      fail('DOODLE_DASH_NOT_DRAWER', 'Only the current drawer can use the canvas.');
    }
    const widthAllowed =
      (args.tool === 'pen' && (ALLOWED_PEN_WIDTHS as readonly number[]).includes(args.width)) ||
      (args.tool === 'eraser' && (ALLOWED_ERASER_WIDTHS as readonly number[]).includes(args.width)) ||
      (args.tool === 'fill' && args.width === 0);
    const colorAllowed = args.tool === 'eraser' || (DOODLE_DASH_COLORS as readonly string[]).includes(args.color);
    const pointCountAllowed =
      args.tool === 'fill'
        ? args.points.length === 1
        : args.points.length >= 1 && args.points.length <= DOODLE_DASH_MAX_STROKE_POINTS;
    if (
      !pointCountAllowed ||
      !widthAllowed ||
      !colorAllowed ||
      args.actionId.length < 1 ||
      args.actionId.length > 80 ||
      !/^[a-zA-Z0-9_-]+$/u.test(args.actionId)
    ) {
      fail('INVALID_DOODLE_DASH_STROKE', 'That drawing stroke is invalid.');
    }
    if (round.nextStrokeSequence > DOODLE_DASH_MAX_STROKES) {
      fail('DOODLE_DASH_DRAWING_CLOSED', 'This canvas reached its stroke limit.');
    }
    const points = args.points.map(normalizePoint);
    const sequence = round.nextStrokeSequence;
    const previousStrokes = await ctx.db
      .query('doodleDashStrokes')
      .withIndex('by_roundId_and_sequence', (index) => index.eq('roundId', round._id))
      .take(DOODLE_DASH_MAX_STROKES + 1);
    if (previousStrokes.length > DOODLE_DASH_MAX_STROKES) {
      throw new Error('Doodle Dash stroke capacity invariant violated.');
    }
    for (const stroke of previousStrokes) {
      if (stroke.isUndone === true) await ctx.db.delete('doodleDashStrokes', stroke._id);
    }
    await ctx.db.insert('doodleDashStrokes', {
      roomId: room._id,
      roundId: round._id,
      sequence,
      actionId: args.actionId,
      tool: args.tool,
      color: args.tool === 'eraser' ? '#ffffff' : args.color,
      width: args.width,
      points,
      createdAt: Date.now(),
    });
    await ctx.db.patch('doodleDashRounds', round._id, { nextStrokeSequence: sequence + 1 });
    return { sequence };
  },
});

export const undoStroke = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null || state.currentRoundId === null || state.phase !== 'drawing') {
      fail('DOODLE_DASH_DRAWING_CLOSED', 'The drawing canvas is closed.');
    }
    const round = await ctx.db.get('doodleDashRounds', state.currentRoundId);
    if (round === null || round.drawerMemberId !== membership._id) {
      fail('DOODLE_DASH_NOT_DRAWER', 'Only the current drawer can use the canvas.');
    }
    const strokes = await ctx.db
      .query('doodleDashStrokes')
      .withIndex('by_roundId_and_sequence', (index) => index.eq('roundId', round._id))
      .take(DOODLE_DASH_MAX_STROKES + 1);
    if (strokes.length > DOODLE_DASH_MAX_STROKES) {
      throw new Error('Doodle Dash stroke capacity invariant violated.');
    }
    const latest = latestActiveDoodleDashStroke(strokes);
    if (latest !== undefined) {
      const actionId = latest.actionId;
      for (const stroke of strokes) {
        if (
          stroke.isUndone !== true &&
          (actionId === undefined ? stroke._id === latest._id : stroke.actionId === actionId)
        ) {
          await ctx.db.patch('doodleDashStrokes', stroke._id, { isUndone: true });
        }
      }
    }
    return null;
  },
});

export const redoStroke = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null || state.currentRoundId === null || state.phase !== 'drawing') {
      fail('DOODLE_DASH_DRAWING_CLOSED', 'The drawing canvas is closed.');
    }
    const round = await ctx.db.get('doodleDashRounds', state.currentRoundId);
    if (round === null || round.drawerMemberId !== membership._id) {
      fail('DOODLE_DASH_NOT_DRAWER', 'Only the current drawer can use the canvas.');
    }
    const strokes = await ctx.db
      .query('doodleDashStrokes')
      .withIndex('by_roundId_and_sequence', (index) => index.eq('roundId', round._id))
      .take(DOODLE_DASH_MAX_STROKES + 1);
    if (strokes.length > DOODLE_DASH_MAX_STROKES) {
      throw new Error('Doodle Dash stroke capacity invariant violated.');
    }
    const next = nextRedoDoodleDashStroke(strokes);
    if (next !== undefined) {
      const actionId = next.actionId;
      for (const stroke of strokes) {
        if (
          stroke.isUndone === true &&
          (actionId === undefined ? stroke._id === next._id : stroke.actionId === actionId)
        ) {
          await ctx.db.patch('doodleDashStrokes', stroke._id, { isUndone: false });
        }
      }
    }
    return null;
  },
});

export const clearCanvas = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, membership } = await requireDoodleDashMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findDoodleDashGameState(ctx, room._id);
    if (state === null || state.currentRoundId === null || state.phase !== 'drawing') {
      fail('DOODLE_DASH_DRAWING_CLOSED', 'The drawing canvas is closed.');
    }
    const round = await ctx.db.get('doodleDashRounds', state.currentRoundId);
    if (round === null || round.drawerMemberId !== membership._id) {
      fail('DOODLE_DASH_NOT_DRAWER', 'Only the current drawer can use the canvas.');
    }
    const strokes = await ctx.db
      .query('doodleDashStrokes')
      .withIndex('by_roundId_and_sequence', (index) => index.eq('roundId', round._id))
      .take(DOODLE_DASH_MAX_STROKES + 1);
    if (strokes.length > DOODLE_DASH_MAX_STROKES) throw new Error('Doodle Dash stroke capacity invariant violated.');
    for (const stroke of strokes) await ctx.db.delete('doodleDashStrokes', stroke._id);
    return null;
  },
});

export const autoSelectWord = internalMutation({
  args: {
    stateId: v.id('doodleDashGameStates'),
    roundId: v.id('doodleDashRounds'),
    gameNumber: v.number(),
    turnNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [state, round] = await Promise.all([
      ctx.db.get('doodleDashGameStates', args.stateId),
      ctx.db.get('doodleDashRounds', args.roundId),
    ]);
    if (
      state === null ||
      round === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentTurnNumber !== args.turnNumber ||
      state.phase !== 'choosing' ||
      round.status !== 'choosing'
    ) {
      return null;
    }
    await beginDrawing(ctx, state, round, Math.floor(Math.random() * round.wordOptions.length), Date.now());
    return null;
  },
});

export const revealHint = internalMutation({
  args: {
    stateId: v.id('doodleDashGameStates'),
    roundId: v.id('doodleDashRounds'),
    gameNumber: v.number(),
    turnNumber: v.number(),
    revealCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [state, round] = await Promise.all([
      ctx.db.get('doodleDashGameStates', args.stateId),
      ctx.db.get('doodleDashRounds', args.roundId),
    ]);
    if (
      state === null ||
      round === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentTurnNumber !== args.turnNumber ||
      state.phase !== 'drawing' ||
      round.status !== 'drawing'
    ) {
      return null;
    }
    await ctx.db.patch('doodleDashRounds', round._id, {
      revealedLetterCount: Math.max(round.revealedLetterCount, Math.min(3, Math.floor(args.revealCount))),
    });
    return null;
  },
});

export const endTurn = internalMutation({
  args: {
    stateId: v.id('doodleDashGameStates'),
    roundId: v.id('doodleDashRounds'),
    gameNumber: v.number(),
    turnNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [state, round] = await Promise.all([
      ctx.db.get('doodleDashGameStates', args.stateId),
      ctx.db.get('doodleDashRounds', args.roundId),
    ]);
    if (
      state === null ||
      round === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentTurnNumber !== args.turnNumber ||
      state.phase !== 'drawing' ||
      round.status !== 'drawing'
    ) {
      return null;
    }
    if (state.phaseEndsAt !== null && Date.now() + 50 < state.phaseEndsAt) return null;
    await revealCurrentWord(ctx, state, round, Date.now());
    return null;
  },
});

export const advanceTurn = internalMutation({
  args: {
    stateId: v.id('doodleDashGameStates'),
    roundId: v.id('doodleDashRounds'),
    gameNumber: v.number(),
    turnNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [state, round] = await Promise.all([
      ctx.db.get('doodleDashGameStates', args.stateId),
      ctx.db.get('doodleDashRounds', args.roundId),
    ]);
    if (
      state === null ||
      round === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentTurnNumber !== args.turnNumber ||
      state.phase !== 'reveal' ||
      round.status !== 'reveal'
    ) {
      return null;
    }
    const room = await ctx.db.get('rooms', state.roomId);
    if (room === null || room.status === 'closed' || args.turnNumber >= state.totalTurns) {
      if (room !== null) await finishDoodleDashGame(ctx, state, room, Date.now());
      else await ctx.db.patch('doodleDashGameStates', state._id, { phase: 'complete', phaseEndsAt: null });
      return null;
    }
    const configuration = resolveConfiguration(state, state.turnOrder.length);
    await startDoodleDashTurn(
      ctx,
      state,
      room,
      state.gameNumber,
      args.turnNumber + 1,
      state.turnOrder,
      state.totalTurns,
      configuration.categories,
      Date.now()
    );
    return null;
  },
});
