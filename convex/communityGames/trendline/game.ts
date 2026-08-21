import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, type QueryCtx, query } from './_generated/server';
import { calculateCrowdMedian, calculateTrendlineScore, validateNormalizedTrendline } from './scoring';
import { memberValidator, phaseValidator, roundSnapshotValidator } from './validators';

export const TRENDLINE_ROUND_COUNT = 6;
const MAX_PLAYERS = 50;

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

async function findState(ctx: DatabaseReaderContext, roomId: string) {
  return await ctx.db
    .query('gameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

async function findRound(ctx: DatabaseReaderContext, roomId: string, gameNumber: number, roundNumber: number) {
  return await ctx.db
    .query('rounds')
    .withIndex('by_room_game_round', (index) =>
      index.eq('roomId', roomId).eq('gameNumber', gameNumber).eq('roundNumber', roundNumber)
    )
    .unique();
}

function validateRoundSnapshots(rounds: Array<Omit<Doc<'roundCache'>, '_id' | '_creationTime'>>): void {
  if (
    rounds.length !== TRENDLINE_ROUND_COUNT ||
    new Set(rounds.map((round) => round.sourceKey)).size !== rounds.length
  ) {
    throw new Error(`Trendline requires ${TRENDLINE_ROUND_COUNT} unique rounds.`);
  }
  for (const round of rounds) {
    validateNormalizedTrendline(round.values);
    if (
      !Number.isFinite(round.axisMin) ||
      !Number.isFinite(round.axisMax) ||
      round.axisMax <= round.axisMin ||
      !Number.isInteger(round.startYear) ||
      !Number.isInteger(round.endYear) ||
      round.endYear - round.startYear + 1 !== round.values.length
    ) {
      throw new Error('Trendline round metadata is invalid.');
    }
  }
}

export function hasEveryoneLockedIn(eligibleMemberIds: string[], submittedMemberIds: string[]): boolean {
  const eligible = new Set(eligibleMemberIds);
  if (eligible.size === 0 || eligible.size > MAX_PLAYERS) return false;
  const submitted = new Set(submittedMemberIds);
  return [...eligible].every((memberId) => submitted.has(memberId));
}

export const initialize = mutation({
  args: { roomId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if ((await findState(ctx, args.roomId)) === null) {
      await ctx.db.insert('gameStates', {
        roomId: args.roomId,
        gameNumber: 0,
        phase: 'lobby',
        currentRoundNumber: 0,
        totalRounds: TRENDLINE_ROUND_COUNT,
        phaseStartedAt: null,
        phaseEndsAt: null,
        preparationId: null,
      });
    }
    return null;
  },
});

export const prepare = mutation({
  args: { roomId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (state === null) {
      await ctx.db.insert('gameStates', {
        roomId: args.roomId,
        gameNumber: 0,
        phase: 'lobby',
        currentRoundNumber: 0,
        totalRounds: TRENDLINE_ROUND_COUNT,
        phaseStartedAt: null,
        phaseEndsAt: null,
        preparationId: null,
      });
    } else {
      await ctx.db.patch('gameStates', state._id, {
        phase: 'lobby',
        currentRoundNumber: 0,
        phaseStartedAt: null,
        phaseEndsAt: null,
        preparationId: null,
      });
    }
    return null;
  },
});

export const getStatus = query({
  args: { roomId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      gameNumber: v.number(),
      phase: phaseValidator,
      currentRoundNumber: v.number(),
      totalRounds: v.number(),
      phaseStartedAt: v.union(v.number(), v.null()),
      phaseEndsAt: v.union(v.number(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    return state === null
      ? null
      : {
          gameNumber: state.gameNumber,
          phase: state.phase,
          currentRoundNumber: state.currentRoundNumber,
          totalRounds: state.totalRounds,
          phaseStartedAt: state.phaseStartedAt,
          phaseEndsAt: state.phaseEndsAt,
        };
  },
});

export const reserveStart = mutation({
  args: { roomId: v.string(), preparationId: v.string(), now: v.number() },
  returns: v.union(
    v.object({ kind: v.literal('reserved'), gameNumber: v.number() }),
    v.object({ kind: v.literal('in_progress') }),
    v.object({ kind: v.literal('complete') }),
    v.object({ kind: v.literal('missing') })
  ),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (state === null) return { kind: 'missing' as const };
    if (state.phase === 'complete') return { kind: 'complete' as const };
    if (state.phase !== 'lobby') return { kind: 'in_progress' as const };
    const gameNumber = state.gameNumber + 1;
    await ctx.db.patch('gameStates', state._id, {
      phase: 'preparing',
      currentRoundNumber: 0,
      phaseStartedAt: args.now,
      phaseEndsAt: null,
      preparationId: args.preparationId,
    });
    return { kind: 'reserved' as const, gameNumber };
  },
});

export const abortStart = mutation({
  args: { roomId: v.string(), preparationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (state?.phase === 'preparing' && state.preparationId === args.preparationId) {
      await ctx.db.patch('gameStates', state._id, {
        phase: 'lobby',
        currentRoundNumber: 0,
        phaseStartedAt: null,
        phaseEndsAt: null,
        preparationId: null,
      });
    }
    return null;
  },
});

export const listCachedRounds = query({
  args: {},
  returns: v.array(roundSnapshotValidator),
  handler: async (ctx) => {
    const rounds = await ctx.db.query('roundCache').withIndex('by_retrievedAt').order('desc').take(48);
    return rounds.map(({ _id, _creationTime, ...round }) => round);
  },
});

export const commitStart = mutation({
  args: {
    roomId: v.string(),
    preparationId: v.string(),
    gameNumber: v.number(),
    rounds: v.array(roundSnapshotValidator),
    participants: v.array(memberValidator),
    now: v.number(),
    startsAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    validateRoundSnapshots(args.rounds);
    if (args.participants.length > MAX_PLAYERS) throw new Error('Trendline participant capacity exceeded.');
    const state = await findState(ctx, args.roomId);
    if (
      state === null ||
      state.phase !== 'preparing' ||
      state.preparationId !== args.preparationId ||
      args.gameNumber !== state.gameNumber + 1
    ) {
      return false;
    }
    for (const participant of args.participants) {
      await ctx.db.insert('scores', {
        roomId: args.roomId,
        gameNumber: args.gameNumber,
        memberId: participant.memberId,
        displayName: participant.displayName,
        totalPoints: 0,
        roundsSubmitted: 0,
        bestRoundPoints: 0,
        updatedAt: args.now,
      });
    }
    for (const [index, round] of args.rounds.entries()) {
      await ctx.db.insert('rounds', {
        roomId: args.roomId,
        gameNumber: args.gameNumber,
        roundNumber: index + 1,
        ...round,
        crowdMedianValues: null,
        scoresFinalizedAt: null,
      });
      const cached = await ctx.db
        .query('roundCache')
        .withIndex('by_sourceKey', (queryIndex) => queryIndex.eq('sourceKey', round.sourceKey))
        .unique();
      if (cached === null) await ctx.db.insert('roundCache', round);
      else await ctx.db.patch('roundCache', cached._id, round);
    }
    await ctx.db.patch('gameStates', state._id, {
      gameNumber: args.gameNumber,
      phase: 'countdown',
      currentRoundNumber: 1,
      totalRounds: TRENDLINE_ROUND_COUNT,
      phaseStartedAt: args.now,
      phaseEndsAt: args.startsAt,
      preparationId: null,
    });
    return true;
  },
});

export const enrollMember = mutation({
  args: { roomId: v.string(), member: memberValidator, now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (
      state === null ||
      state.gameNumber < 1 ||
      state.phase === 'lobby' ||
      state.phase === 'preparing' ||
      state.phase === 'complete'
    ) {
      return false;
    }
    const existing = await ctx.db
      .query('scores')
      .withIndex('by_room_game_member', (index) =>
        index.eq('roomId', args.roomId).eq('gameNumber', state.gameNumber).eq('memberId', args.member.memberId)
      )
      .unique();
    if (existing !== null) {
      if (existing.displayName !== args.member.displayName) {
        await ctx.db.patch('scores', existing._id, { displayName: args.member.displayName, updatedAt: args.now });
      }
      return false;
    }
    await ctx.db.insert('scores', {
      roomId: args.roomId,
      gameNumber: state.gameNumber,
      memberId: args.member.memberId,
      displayName: args.member.displayName,
      totalPoints: 0,
      roundsSubmitted: 0,
      bestRoundPoints: 0,
      updatedAt: args.now,
    });
    return true;
  },
});

export const beginDrawing = mutation({
  args: {
    roomId: v.string(),
    gameNumber: v.number(),
    roundNumber: v.number(),
    now: v.number(),
    phaseEndsAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentRoundNumber !== args.roundNumber ||
      state.phase !== 'countdown'
    ) {
      return false;
    }
    await ctx.db.patch('gameStates', state._id, {
      phase: 'drawing',
      phaseStartedAt: args.now,
      phaseEndsAt: args.phaseEndsAt,
    });
    return true;
  },
});

export const closeRound = mutation({
  args: {
    roomId: v.string(),
    gameNumber: v.number(),
    roundNumber: v.number(),
    now: v.number(),
    phaseEndsAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentRoundNumber !== args.roundNumber ||
      state.phase !== 'drawing'
    ) {
      return false;
    }
    const round = await findRound(ctx, args.roomId, args.gameNumber, args.roundNumber);
    if (round === null) throw new Error('The active Trendline round is missing.');
    const predictions = await ctx.db
      .query('predictions')
      .withIndex('by_round_member', (index) => index.eq('roundId', round._id))
      .take(MAX_PLAYERS + 1);
    if (predictions.length > MAX_PLAYERS) throw new Error('Trendline prediction capacity invariant violated.');
    for (const prediction of predictions) {
      const result = calculateTrendlineScore(prediction.values, round.values, prediction.usedHint);
      await ctx.db.patch('predictions', prediction._id, result);
      const score = await ctx.db
        .query('scores')
        .withIndex('by_room_game_member', (index) =>
          index.eq('roomId', args.roomId).eq('gameNumber', args.gameNumber).eq('memberId', prediction.memberId)
        )
        .unique();
      if (score !== null) {
        await ctx.db.patch('scores', score._id, {
          totalPoints: score.totalPoints + result.pointsAwarded,
          roundsSubmitted: score.roundsSubmitted + 1,
          bestRoundPoints: Math.max(score.bestRoundPoints, result.pointsAwarded),
          updatedAt: args.now,
        });
      }
    }
    await ctx.db.patch('rounds', round._id, {
      crowdMedianValues: calculateCrowdMedian(predictions.map((prediction) => prediction.values)),
      scoresFinalizedAt: args.now,
    });
    await ctx.db.patch('gameStates', state._id, {
      phase: 'reveal',
      phaseStartedAt: args.now,
      phaseEndsAt: args.phaseEndsAt,
    });
    return true;
  },
});

export const advanceAfterReveal = mutation({
  args: {
    roomId: v.string(),
    gameNumber: v.number(),
    roundNumber: v.number(),
    now: v.number(),
    nextStartsAt: v.number(),
  },
  returns: v.union(
    v.object({ kind: v.literal('ignored') }),
    v.object({ kind: v.literal('complete') }),
    v.object({ kind: v.literal('countdown'), roundNumber: v.number() })
  ),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (
      state === null ||
      state.gameNumber !== args.gameNumber ||
      state.currentRoundNumber !== args.roundNumber ||
      state.phase !== 'reveal'
    ) {
      return { kind: 'ignored' as const };
    }
    if (args.roundNumber >= state.totalRounds) {
      await ctx.db.patch('gameStates', state._id, {
        phase: 'complete',
        phaseStartedAt: args.now,
        phaseEndsAt: null,
      });
      return { kind: 'complete' as const };
    }
    const roundNumber = args.roundNumber + 1;
    await ctx.db.patch('gameStates', state._id, {
      phase: 'countdown',
      currentRoundNumber: roundNumber,
      phaseStartedAt: args.now,
      phaseEndsAt: args.nextStartsAt,
    });
    return { kind: 'countdown' as const, roundNumber };
  },
});

const leaderboardEntryValidator = v.object({
  memberId: v.string(),
  displayName: v.string(),
  totalPoints: v.number(),
  roundsSubmitted: v.number(),
  bestRoundPoints: v.number(),
  pointsGained: v.union(v.number(), v.null()),
});

const roundViewValidator = v.object({
  roundId: v.id('rounds'),
  roundNumber: v.number(),
  countryCode: v.string(),
  countryName: v.string(),
  indicatorCode: v.string(),
  indicatorName: v.string(),
  category: v.string(),
  unitLabel: v.string(),
  valueDecimals: v.number(),
  axisMin: v.number(),
  axisMax: v.number(),
  startYear: v.number(),
  endYear: v.number(),
  firstValue: v.number(),
  actualValues: v.union(v.array(v.number()), v.null()),
  crowdMedianValues: v.union(v.array(v.number()), v.null()),
  hintedEndValue: v.union(v.number(), v.null()),
  submittedCount: v.number(),
  source: v.union(
    v.null(),
    v.object({
      name: v.string(),
      organization: v.string(),
      url: v.string(),
      licenseName: v.string(),
      retrievedAt: v.number(),
    })
  ),
});

const playerPredictionValidator = v.object({
  values: v.array(v.number()),
  usedHint: v.boolean(),
  pointsAwarded: v.union(v.number(), v.null()),
  meanAbsoluteError: v.union(v.number(), v.null()),
  shapeAccuracy: v.union(v.number(), v.null()),
});

export const getGameView = query({
  args: { roomId: v.string(), memberId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      gameNumber: v.number(),
      phase: phaseValidator,
      currentRoundNumber: v.number(),
      totalRounds: v.number(),
      phaseStartedAt: v.union(v.number(), v.null()),
      phaseEndsAt: v.union(v.number(), v.null()),
      round: v.union(roundViewValidator, v.null()),
      playerPrediction: v.union(playerPredictionValidator, v.null()),
      leaderboard: v.array(leaderboardEntryValidator),
    })
  ),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (state === null) return null;
    const scores = await ctx.db
      .query('scores')
      .withIndex('by_room_game', (index) => index.eq('roomId', args.roomId).eq('gameNumber', state.gameNumber))
      .take(MAX_PLAYERS + 1);
    if (scores.length > MAX_PLAYERS) throw new Error('Trendline score capacity invariant violated.');
    const round =
      state.currentRoundNumber > 0
        ? await findRound(ctx, args.roomId, state.gameNumber, state.currentRoundNumber)
        : null;
    const predictions =
      round === null
        ? []
        : await ctx.db
            .query('predictions')
            .withIndex('by_round_member', (index) => index.eq('roundId', round._id))
            .take(MAX_PLAYERS + 1);
    if (predictions.length > MAX_PLAYERS) throw new Error('Trendline prediction capacity invariant violated.');
    const playerPrediction = predictions.find((prediction) => prediction.memberId === args.memberId) ?? null;
    const isRevealed = state.phase === 'reveal' || state.phase === 'complete';
    const hint =
      round === null
        ? null
        : await ctx.db
            .query('hints')
            .withIndex('by_round_member', (index) => index.eq('roundId', round._id).eq('memberId', args.memberId))
            .unique();
    const pointsByMember = isRevealed
      ? new Map(predictions.map((prediction) => [prediction.memberId, prediction.pointsAwarded]))
      : new Map<string, number | null>();
    const leaderboard = [...scores]
      .sort(
        (first, second) =>
          second.totalPoints - first.totalPoints ||
          second.bestRoundPoints - first.bestRoundPoints ||
          first.displayName.localeCompare(second.displayName)
      )
      .map((score) => ({
        memberId: score.memberId,
        displayName: score.displayName,
        totalPoints: score.totalPoints,
        roundsSubmitted: score.roundsSubmitted,
        bestRoundPoints: score.bestRoundPoints,
        pointsGained: pointsByMember.get(score.memberId) ?? null,
      }));
    return {
      gameNumber: state.gameNumber,
      phase: state.phase,
      currentRoundNumber: state.currentRoundNumber,
      totalRounds: state.totalRounds,
      phaseStartedAt: state.phaseStartedAt,
      phaseEndsAt: state.phaseEndsAt,
      round:
        round === null
          ? null
          : {
              roundId: round._id,
              roundNumber: round.roundNumber,
              countryCode: round.countryCode,
              countryName: round.countryName,
              indicatorCode: round.indicatorCode,
              indicatorName: round.indicatorName,
              category: round.category,
              unitLabel: round.unitLabel,
              valueDecimals: round.valueDecimals,
              axisMin: round.axisMin,
              axisMax: round.axisMax,
              startYear: round.startYear,
              endYear: round.endYear,
              firstValue: round.values[0],
              actualValues: isRevealed ? round.values : null,
              crowdMedianValues: isRevealed ? round.crowdMedianValues : null,
              hintedEndValue: hint !== null || isRevealed ? (round.values[round.values.length - 1] ?? null) : null,
              submittedCount: predictions.length,
              source: isRevealed
                ? {
                    name: round.sourceName,
                    organization: round.sourceOrganization,
                    url: round.sourceUrl,
                    licenseName: round.licenseName,
                    retrievedAt: round.retrievedAt,
                  }
                : null,
            },
      playerPrediction:
        playerPrediction === null
          ? null
          : {
              values: playerPrediction.values,
              usedHint: playerPrediction.usedHint,
              pointsAwarded: isRevealed ? playerPrediction.pointsAwarded : null,
              meanAbsoluteError: isRevealed ? playerPrediction.meanAbsoluteError : null,
              shapeAccuracy: isRevealed ? playerPrediction.shapeAccuracy : null,
            },
      leaderboard,
    };
  },
});

export const submitPrediction = mutation({
  args: {
    roomId: v.string(),
    memberId: v.string(),
    roundId: v.id('rounds'),
    values: v.array(v.number()),
    eligibleMemberIds: v.array(v.string()),
    now: v.number(),
  },
  returns: v.union(
    v.object({
      kind: v.literal('accepted'),
      allLockedIn: v.boolean(),
      gameNumber: v.number(),
      roundNumber: v.number(),
    }),
    v.object({ kind: v.literal('existing') }),
    v.object({ kind: v.literal('not_running') }),
    v.object({ kind: v.literal('closed') })
  ),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (state === null || state.phase !== 'drawing') return { kind: 'not_running' as const };
    if (state.phaseEndsAt === null || args.now > state.phaseEndsAt) return { kind: 'closed' as const };
    const round = await findRound(ctx, args.roomId, state.gameNumber, state.currentRoundNumber);
    if (round === null || round._id !== args.roundId) return { kind: 'closed' as const };
    const eligibleMemberIds = [...new Set(args.eligibleMemberIds)];
    if (
      eligibleMemberIds.length === 0 ||
      eligibleMemberIds.length > MAX_PLAYERS ||
      !eligibleMemberIds.includes(args.memberId)
    ) {
      throw new Error('Trendline eligible member snapshot is invalid.');
    }
    const existing = await ctx.db
      .query('predictions')
      .withIndex('by_round_member', (index) => index.eq('roundId', round._id).eq('memberId', args.memberId))
      .unique();
    if (existing !== null) return { kind: 'existing' as const };
    const values = validateNormalizedTrendline(args.values);
    const hint = await ctx.db
      .query('hints')
      .withIndex('by_round_member', (index) => index.eq('roundId', round._id).eq('memberId', args.memberId))
      .unique();
    await ctx.db.insert('predictions', {
      roomId: args.roomId,
      gameNumber: state.gameNumber,
      roundId: round._id,
      memberId: args.memberId,
      values,
      usedHint: hint !== null,
      meanAbsoluteError: null,
      shapeAccuracy: null,
      pointsAwarded: null,
      submittedAt: args.now,
    });
    const predictions = await ctx.db
      .query('predictions')
      .withIndex('by_round_member', (index) => index.eq('roundId', round._id))
      .take(MAX_PLAYERS + 1);
    if (predictions.length > MAX_PLAYERS) throw new Error('Trendline prediction capacity invariant violated.');
    return {
      kind: 'accepted' as const,
      allLockedIn: hasEveryoneLockedIn(
        eligibleMemberIds,
        predictions.map((prediction) => prediction.memberId)
      ),
      gameNumber: state.gameNumber,
      roundNumber: state.currentRoundNumber,
    };
  },
});

export const revealHint = mutation({
  args: { roomId: v.string(), memberId: v.string(), roundId: v.id('rounds'), now: v.number() },
  returns: v.union(
    v.object({ kind: v.literal('revealed'), endValue: v.number() }),
    v.object({ kind: v.literal('closed') }),
    v.object({ kind: v.literal('not_running') })
  ),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (state === null || state.phase !== 'drawing') return { kind: 'not_running' as const };
    if (state.phaseEndsAt === null || args.now > state.phaseEndsAt) return { kind: 'closed' as const };
    const round = await findRound(ctx, args.roomId, state.gameNumber, state.currentRoundNumber);
    if (round === null || round._id !== args.roundId) return { kind: 'closed' as const };
    const prediction = await ctx.db
      .query('predictions')
      .withIndex('by_round_member', (index) => index.eq('roundId', round._id).eq('memberId', args.memberId))
      .unique();
    if (prediction !== null) return { kind: 'closed' as const };
    const existing = await ctx.db
      .query('hints')
      .withIndex('by_round_member', (index) => index.eq('roundId', round._id).eq('memberId', args.memberId))
      .unique();
    if (existing === null) {
      await ctx.db.insert('hints', { roundId: round._id, memberId: args.memberId, revealedAt: args.now });
    }
    return {
      kind: 'revealed' as const,
      endValue: round.values[round.values.length - 1] ?? round.values[0],
    };
  },
});

export const getBotContext = query({
  args: { roomId: v.string(), botId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      phase: phaseValidator,
      roundId: v.union(v.id('rounds'), v.null()),
      actualValues: v.union(v.array(v.number()), v.null()),
      phaseStartedAt: v.union(v.number(), v.null()),
      phaseEndsAt: v.union(v.number(), v.null()),
      plan: v.union(
        v.null(),
        v.object({ plannedRoundId: v.union(v.id('rounds'), v.null()), submitAt: v.number(), submitted: v.boolean() })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const state = await findState(ctx, args.roomId);
    if (state === null) return null;
    const round =
      state.currentRoundNumber > 0
        ? await findRound(ctx, args.roomId, state.gameNumber, state.currentRoundNumber)
        : null;
    const plan = await ctx.db
      .query('playtestBotStates')
      .withIndex('by_botId', (index) => index.eq('botId', args.botId))
      .unique();
    return {
      phase: state.phase,
      roundId: round?._id ?? null,
      actualValues: round?.values ?? null,
      phaseStartedAt: state.phaseStartedAt,
      phaseEndsAt: state.phaseEndsAt,
      plan:
        plan === null
          ? null
          : { plannedRoundId: plan.plannedRoundId, submitAt: plan.submitAt, submitted: plan.submitted },
    };
  },
});

export const setBotPlan = mutation({
  args: {
    botId: v.string(),
    roomId: v.string(),
    plannedRoundId: v.union(v.id('rounds'), v.null()),
    submitAt: v.number(),
    submitted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('playtestBotStates')
      .withIndex('by_botId', (index) => index.eq('botId', args.botId))
      .unique();
    const fields = {
      roomId: args.roomId,
      plannedRoundId: args.plannedRoundId,
      submitAt: args.submitAt,
      submitted: args.submitted,
    };
    if (existing === null) await ctx.db.insert('playtestBotStates', { botId: args.botId, ...fields });
    else await ctx.db.patch('playtestBotStates', existing._id, fields);
    return null;
  },
});
