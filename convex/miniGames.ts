import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx, mutation, type QueryCtx, query } from './_generated/server';
import { fail, MAX_PLAYERS } from './domain';
import {
  chooseMiniGame,
  createEmojiChallenge,
  createStraightLineTarget,
  estimateMiniGamesDurationMs,
  isMiniGamesRoundCount,
  MINI_GAME_DEFINITIONS,
  MINI_GAMES_RESULTS_MS,
  MINI_GAMES_ROUND_MS,
  MINI_GAMES_ROUND_OPTIONS,
  MINI_GAMES_SELECTION_MS,
  type MiniGameId,
  normalizeMiniGamesRoundCount,
  scoreFindEmoji,
  scoreStraightLine,
} from './miniGamesEngine';
import { requireRoomMember } from './roomAccess';
import { activateCurrentRoomGame, completeCurrentRoomGame } from './roomGames';
import { listActiveRoomMembers } from './roomMembers';

const miniGameIdValidator = v.union(v.literal('straightLine'), v.literal('orangeEmojis'));
const miniGamesPhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('selecting'),
  v.literal('playing'),
  v.literal('roundResults'),
  v.literal('complete')
);
const resultStatusValidator = v.union(v.literal('waiting'), v.literal('finished'), v.literal('timedOut'));
const emojiColorValidator = v.union(
  v.literal('orange'),
  v.literal('blue'),
  v.literal('green'),
  v.literal('pink'),
  v.literal('purple')
);
const emojiItemValidator = v.object({
  id: v.string(),
  emoji: v.string(),
  color: emojiColorValidator,
  x: v.number(),
  y: v.number(),
  rotation: v.number(),
});
const resultViewValidator = v.object({
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  status: resultStatusValidator,
  score: v.number(),
  timeMs: v.union(v.number(), v.null()),
  straightness: v.union(v.number(), v.null()),
  correctClicks: v.number(),
  wrongClicks: v.number(),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});
const standingValidator = v.object({
  rank: v.number(),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  totalScore: v.number(),
  roundsFinished: v.number(),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});
const miniGameDefinitionValidator = v.object({
  id: miniGameIdValidator,
  title: v.string(),
  eyebrow: v.string(),
  instructions: v.string(),
});
const gameViewValidator = v.object({
  gameNumber: v.number(),
  phase: miniGamesPhaseValidator,
  phaseStartedAt: v.union(v.number(), v.null()),
  phaseEndsAt: v.union(v.number(), v.null()),
  currentRoundNumber: v.number(),
  totalRounds: v.number(),
  participantCount: v.number(),
  finishedCount: v.number(),
  estimatedDurationMs: v.number(),
  configuration: v.object({
    roundCount: v.number(),
    roundOptions: v.array(v.object({ roundCount: v.number(), estimatedDurationMs: v.number() })),
  }),
  miniGames: v.array(miniGameDefinitionValidator),
  round: v.union(
    v.null(),
    v.object({
      roundId: v.id('miniGamesRounds'),
      roundNumber: v.number(),
      miniGame: miniGameDefinitionValidator,
      selectionStartedAt: v.number(),
      playStartsAt: v.number(),
      playEndsAt: v.number(),
      lineTarget: v.union(
        v.null(),
        v.object({
          start: v.object({ x: v.number(), y: v.number() }),
          end: v.object({ x: v.number(), y: v.number() }),
        })
      ),
      emojiItems: v.array(emojiItemValidator),
      targetEmoji: v.union(v.string(), v.null()),
      targetCount: v.number(),
    })
  ),
  currentResult: v.union(v.null(), resultViewValidator),
  roundResults: v.array(resultViewValidator),
  standings: v.array(standingValidator),
});

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export async function findMiniGamesState(ctx: DatabaseReaderContext, roomId: Id<'rooms'>) {
  return await ctx.db
    .query('miniGamesGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

async function requireMiniGamesMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  sessionToken: string,
  requireActive: boolean
) {
  return await requireRoomMember(ctx, roomId, sessionToken, { gameType: 'miniGames', requireActive });
}

function miniGameDefinition(id: MiniGameId) {
  const definition = MINI_GAME_DEFINITIONS.find((entry) => entry.id === id);
  if (definition === undefined) throw new Error(`Missing mini-game definition: ${id}`);
  return definition;
}

function targetEmojiForRound(round: Doc<'miniGamesRounds'>) {
  return round.targetEmoji ?? round.emojiItems.find((item) => item.color === 'orange')?.emoji ?? '🍊';
}

async function insertRoundParticipant(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  gameNumber: number,
  round: Doc<'miniGamesRounds'>,
  member: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  startedAt: number
) {
  const existing = await ctx.db
    .query('miniGamesResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', member._id))
    .unique();
  if (existing !== null) return false;
  await ctx.db.insert('miniGamesResults', {
    roomId,
    gameNumber,
    roundNumber: round.roundNumber,
    roundId: round._id,
    memberId: member._id,
    displayName: member.displayName,
    miniGameId: round.miniGameId,
    status: 'waiting',
    startedAt,
    finishedAt: null,
    timeMs: null,
    score: 0,
    straightness: null,
    correctClicks: 0,
    wrongClicks: 0,
  });
  return true;
}

async function createRound(
  ctx: MutationCtx,
  state: Doc<'miniGamesGameStates'>,
  roundNumber: number,
  previousMiniGameId: MiniGameId | null,
  now: number
) {
  const miniGameId = chooseMiniGame(previousMiniGameId);
  const lineTarget = miniGameId === 'straightLine' ? createStraightLineTarget() : null;
  const emojiChallenge = miniGameId === 'orangeEmojis' ? createEmojiChallenge() : null;
  const playStartsAt = now + MINI_GAMES_SELECTION_MS;
  const playEndsAt = playStartsAt + MINI_GAMES_ROUND_MS;
  const roundId = await ctx.db.insert('miniGamesRounds', {
    roomId: state.roomId,
    gameNumber: state.gameNumber,
    roundNumber,
    miniGameId,
    status: 'selecting',
    selectionStartedAt: now,
    playStartsAt,
    playEndsAt,
    resultsStartedAt: null,
    lineStartX: lineTarget?.start.x ?? null,
    lineStartY: lineTarget?.start.y ?? null,
    lineEndX: lineTarget?.end.x ?? null,
    lineEndY: lineTarget?.end.y ?? null,
    ...(emojiChallenge === null ? {} : { targetEmoji: emojiChallenge.targetEmoji }),
    emojiItems: emojiChallenge?.items ?? [],
  });
  const round = await ctx.db.get('miniGamesRounds', roundId);
  if (round === null) throw new Error('The mini-game round could not be created.');
  const participants = await listActiveRoomMembers(ctx, state.roomId);
  for (const participant of participants) {
    await insertRoundParticipant(ctx, state.roomId, state.gameNumber, round, participant, playStartsAt);
  }
  await ctx.scheduler.runAfter(MINI_GAMES_SELECTION_MS, internal.miniGames.beginRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber,
  });
  await ctx.scheduler.runAfter(MINI_GAMES_SELECTION_MS + MINI_GAMES_ROUND_MS, internal.miniGames.finalizeRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber,
  });
  return { round, participantCount: participants.length };
}

export async function enrollMiniGamesMember(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
) {
  const state = await findMiniGamesState(ctx, roomId);
  if (state === null || state.currentRoundId === null || (state.phase !== 'selecting' && state.phase !== 'playing')) {
    return false;
  }
  const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
  if (round === null || round.playEndsAt <= now) return false;
  const inserted = await insertRoundParticipant(
    ctx,
    roomId,
    state.gameNumber,
    round,
    membership,
    state.phase === 'selecting' ? round.playStartsAt : now
  );
  if (inserted) {
    await ctx.db.patch('miniGamesGameStates', state._id, { participantCount: state.participantCount + 1 });
  }
  return inserted;
}

async function showRoundResults(
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

async function recordResult(
  ctx: MutationCtx,
  state: Doc<'miniGamesGameStates'>,
  round: Doc<'miniGamesRounds'>,
  result: Doc<'miniGamesResults'>,
  fields: Pick<Doc<'miniGamesResults'>, 'score' | 'straightness' | 'correctClicks' | 'wrongClicks'>,
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

function assertSubmissionOpen(state: Doc<'miniGamesGameStates'>, round: Doc<'miniGamesRounds'>, now: number) {
  if (state.phase !== 'playing' || round.status !== 'playing' || now > round.playEndsAt) {
    fail('MINI_GAMES_NOT_RUNNING', 'This mini-game round has ended.');
  }
}

export const getGame = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: gameViewValidator,
  handler: async (ctx, args) => {
    const { membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, false);
    const state = await findMiniGamesState(ctx, args.roomId);
    if (state === null) throw new Error('Mini Game Mix state is missing.');
    const round = state.currentRoundId === null ? null : await ctx.db.get('miniGamesRounds', state.currentRoundId);
    let currentRoundResults: Doc<'miniGamesResults'>[] = [];
    if (round !== null) {
      currentRoundResults = await ctx.db
        .query('miniGamesResults')
        .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
        .take(MAX_PLAYERS + 1);
      if (currentRoundResults.length > MAX_PLAYERS)
        throw new Error('Mini-game participant capacity invariant violated.');
    }
    const allResults = await ctx.db
      .query('miniGamesResults')
      .withIndex('by_roomId_and_gameNumber', (index) =>
        index.eq('roomId', args.roomId).eq('gameNumber', state.gameNumber)
      )
      .take(MAX_PLAYERS * 10 + 1);
    if (allResults.length > MAX_PLAYERS * 10) throw new Error('Mini-game result capacity invariant violated.');
    const activeMembers = await listActiveRoomMembers(ctx, args.roomId);
    const scoreByMember = new Map<
      Id<'roomMembers'>,
      { displayName: string; totalScore: number; roundsFinished: number }
    >();
    for (const member of activeMembers) {
      scoreByMember.set(member._id, { displayName: member.displayName, totalScore: 0, roundsFinished: 0 });
    }
    for (const result of allResults) {
      const aggregate = scoreByMember.get(result.memberId) ?? {
        displayName: result.displayName,
        totalScore: 0,
        roundsFinished: 0,
      };
      aggregate.totalScore += result.score;
      if (result.status !== 'waiting') aggregate.roundsFinished += 1;
      scoreByMember.set(result.memberId, aggregate);
    }
    const memberDocs = await Promise.all(
      [...scoreByMember.keys()].map(async (memberId) => await ctx.db.get('roomMembers', memberId))
    );
    const activeByMemberId = new Map(memberDocs.map((member) => [member?._id, member?.isActive ?? false]));
    const standings = [...scoreByMember.entries()]
      .map(([memberId, score]) => ({
        memberId,
        ...score,
        isCurrentPlayer: memberId === membership._id,
        isActive: activeByMemberId.get(memberId) ?? false,
      }))
      .sort(
        (first, second) => second.totalScore - first.totalScore || first.displayName.localeCompare(second.displayName)
      )
      .map((standing, index) => ({ ...standing, rank: index + 1 }));
    const resultViews = currentRoundResults
      .map((result) => ({
        memberId: result.memberId,
        displayName: result.displayName,
        status: result.status,
        score: result.score,
        timeMs: result.timeMs,
        straightness: result.straightness,
        correctClicks: result.correctClicks,
        wrongClicks: result.wrongClicks,
        isCurrentPlayer: result.memberId === membership._id,
        isActive: activeByMemberId.get(result.memberId) ?? true,
      }))
      .sort((first, second) => second.score - first.score || (first.timeMs ?? Infinity) - (second.timeMs ?? Infinity));
    const definition = round === null ? null : miniGameDefinition(round.miniGameId);
    const configuredRoundCount = normalizeMiniGamesRoundCount(state.configuredRoundCount);
    return {
      gameNumber: state.gameNumber,
      phase: state.phase,
      phaseStartedAt: state.phaseStartedAt,
      phaseEndsAt: state.phaseEndsAt,
      currentRoundNumber: state.currentRoundNumber,
      totalRounds: state.totalRounds,
      participantCount: state.participantCount,
      finishedCount: state.finishedCount,
      estimatedDurationMs: estimateMiniGamesDurationMs(configuredRoundCount),
      configuration: {
        roundCount: configuredRoundCount,
        roundOptions: MINI_GAMES_ROUND_OPTIONS.map((roundCount) => ({
          roundCount,
          estimatedDurationMs: estimateMiniGamesDurationMs(roundCount),
        })),
      },
      miniGames: MINI_GAME_DEFINITIONS.map((entry) => ({ ...entry })),
      round:
        round === null || definition === null
          ? null
          : (() => {
              const targetEmoji = round.miniGameId === 'orangeEmojis' ? targetEmojiForRound(round) : null;
              return {
                roundId: round._id,
                roundNumber: round.roundNumber,
                miniGame: { ...definition },
                selectionStartedAt: round.selectionStartedAt,
                playStartsAt: round.playStartsAt,
                playEndsAt: round.playEndsAt,
                lineTarget:
                  round.lineStartX === null ||
                  round.lineStartY === null ||
                  round.lineEndX === null ||
                  round.lineEndY === null
                    ? null
                    : {
                        start: { x: round.lineStartX, y: round.lineStartY },
                        end: { x: round.lineEndX, y: round.lineEndY },
                      },
                emojiItems: round.emojiItems,
                targetEmoji,
                targetCount:
                  targetEmoji === null ? 0 : round.emojiItems.filter((item) => item.emoji === targetEmoji).length,
              };
            })(),
      currentResult: resultViews.find((result) => result.isCurrentPlayer) ?? null,
      roundResults: resultViews,
      standings,
    };
  },
});

export const configureGame = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), roundCount: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
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
  },
});

export const startGame = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.object({ gameNumber: v.number(), roundNumber: v.number(), miniGameId: miniGameIdValidator }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
    if (membership.guestId !== room.ownerGuestId)
      fail('NOT_ROOM_OWNER', 'Only the room owner can start Mini Game Mix.');
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
  },
});

export const submitStraightLine = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
  },
  returns: v.object({ score: v.number(), straightness: v.number(), timeMs: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findMiniGamesState(ctx, room._id);
    if (state === null || state.currentRoundId === null)
      fail('MINI_GAMES_NOT_RUNNING', 'No mini-game round is active.');
    const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
    if (round === null || round.miniGameId !== 'straightLine') {
      fail('INVALID_MINI_GAME_SUBMISSION', 'This round is not the straight-line challenge.');
    }
    const now = Date.now();
    assertSubmissionOpen(state, round, now);
    if (
      args.points.length < 2 ||
      args.points.length > 300 ||
      args.points.some(
        (point) =>
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          point.x < 0 ||
          point.x > 1 ||
          point.y < 0 ||
          point.y > 1
      ) ||
      round.lineStartX === null ||
      round.lineStartY === null ||
      round.lineEndX === null ||
      round.lineEndY === null
    ) {
      fail('INVALID_MINI_GAME_SUBMISSION', 'Draw one complete line from start to finish.');
    }
    const result = await ctx.db
      .query('miniGamesResults')
      .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
      .unique();
    if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
    if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your line is already locked in.');
    const timeMs = Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt));
    const scored = scoreStraightLine(
      args.points,
      { x: round.lineStartX, y: round.lineStartY },
      { x: round.lineEndX, y: round.lineEndY },
      timeMs
    );
    const recorded = await recordResult(
      ctx,
      state,
      round,
      result,
      { score: scored.score, straightness: scored.straightness, correctClicks: 0, wrongClicks: 0 },
      now
    );
    return { ...recorded, straightness: scored.straightness };
  },
});

export const submitOrangeEmojis = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), clickedIds: v.array(v.string()) },
  returns: v.object({ score: v.number(), accuracy: v.number(), timeMs: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireMiniGamesMember(ctx, args.roomId, args.sessionToken, true);
    const state = await findMiniGamesState(ctx, room._id);
    if (state === null || state.currentRoundId === null)
      fail('MINI_GAMES_NOT_RUNNING', 'No mini-game round is active.');
    const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
    if (round === null || round.miniGameId !== 'orangeEmojis') {
      fail('INVALID_MINI_GAME_SUBMISSION', 'This round is not the matching-emoji challenge.');
    }
    const now = Date.now();
    assertSubmissionOpen(state, round, now);
    const result = await ctx.db
      .query('miniGamesResults')
      .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
      .unique();
    if (result === null) fail('MINI_GAMES_NOT_RUNNING', 'You are not enrolled in this mini-game round.');
    if (result.status !== 'waiting') fail('MINI_GAMES_ALREADY_SUBMITTED', 'Your emoji picks are already locked in.');
    const clickedIds = new Set(args.clickedIds);
    const itemIds = new Set(round.emojiItems.map((item) => item.id));
    const targetEmoji = targetEmojiForRound(round);
    const targetIds = round.emojiItems.filter((item) => item.emoji === targetEmoji).map((item) => item.id);
    if (
      clickedIds.size !== args.clickedIds.length ||
      args.clickedIds.length > round.emojiItems.length ||
      args.clickedIds.some((id) => !itemIds.has(id)) ||
      targetIds.some((id) => !clickedIds.has(id))
    ) {
      fail('INVALID_MINI_GAME_SUBMISSION', 'Click every copy of the target emoji before locking in your picks.');
    }
    const wrongClicks = args.clickedIds.filter((id) => !targetIds.includes(id)).length;
    const timeMs = Math.max(0, Math.min(MINI_GAMES_ROUND_MS, now - result.startedAt));
    const scored = scoreFindEmoji(targetIds.length, wrongClicks, timeMs);
    const recorded = await recordResult(
      ctx,
      state,
      round,
      result,
      { score: scored.score, straightness: null, correctClicks: targetIds.length, wrongClicks },
      now
    );
    return { ...recorded, accuracy: scored.accuracy };
  },
});

export const beginRound = internalMutation({
  args: { stateId: v.id('miniGamesGameStates'), gameNumber: v.number(), roundNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('miniGamesGameStates', args.stateId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentRoundNumber !== args.roundNumber ||
      state.currentRoundId === null ||
      state.phase !== 'selecting'
    )
      return null;
    const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
    if (round === null || round.roundNumber !== args.roundNumber) return null;
    const now = Date.now();
    await ctx.db.patch('miniGamesRounds', round._id, { status: 'playing' });
    await ctx.db.patch('miniGamesGameStates', state._id, {
      phase: 'playing',
      phaseStartedAt: now,
      phaseEndsAt: round.playEndsAt,
    });
    return null;
  },
});

export const finalizeRound = internalMutation({
  args: { stateId: v.id('miniGamesGameStates'), gameNumber: v.number(), roundNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('miniGamesGameStates', args.stateId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentRoundNumber !== args.roundNumber ||
      state.currentRoundId === null ||
      (state.phase !== 'selecting' && state.phase !== 'playing')
    )
      return null;
    const round = await ctx.db.get('miniGamesRounds', state.currentRoundId);
    if (round === null || round.roundNumber !== args.roundNumber) return null;
    await showRoundResults(ctx, state, round, Date.now());
    return null;
  },
});

export const advanceRound = internalMutation({
  args: { stateId: v.id('miniGamesGameStates'), gameNumber: v.number(), roundNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('miniGamesGameStates', args.stateId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentRoundNumber !== args.roundNumber ||
      state.currentRoundId === null ||
      state.phase !== 'roundResults'
    )
      return null;
    const currentRound = await ctx.db.get('miniGamesRounds', state.currentRoundId);
    if (currentRound === null) return null;
    const now = Date.now();
    if (state.currentRoundNumber >= state.totalRounds) {
      await ctx.db.patch('miniGamesGameStates', state._id, {
        phase: 'complete',
        phaseStartedAt: now,
        phaseEndsAt: null,
      });
      const room = await ctx.db.get('rooms', state.roomId);
      if (room !== null) await completeCurrentRoomGame(ctx, room, 'miniGames', now);
      return null;
    }
    const nextRoundNumber = state.currentRoundNumber + 1;
    const { round, participantCount } = await createRound(ctx, state, nextRoundNumber, currentRound.miniGameId, now);
    await ctx.db.patch('miniGamesGameStates', state._id, {
      phase: 'selecting',
      currentRoundId: round._id,
      currentRoundNumber: nextRoundNumber,
      phaseStartedAt: now,
      phaseEndsAt: round.playStartsAt,
      participantCount,
      finishedCount: 0,
    });
    return null;
  },
});
