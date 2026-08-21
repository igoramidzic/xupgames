import { v } from 'convex/values';
import { components, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalMutation, internalQuery, type MutationCtx, mutation, query } from './_generated/server';
import { fail } from './domain';
import { requireRoomMember } from './roomAccess';
import { activateCurrentRoomGame, completeCurrentRoomGame } from './roomGames';
import { listActiveRoomMembers, listRoomMembersForDisplay } from './roomMembers';
import {
  fetchWorldBankTrendlineRounds,
  selectTrendlineRounds,
  type TrendlineRoundSnapshot,
} from './trendlineWorldBank';

const TRENDLINE_ROUND_COUNT = 6;
const TRENDLINE_POINT_COUNT = 24;
const TRENDLINE_COUNTDOWN_MS = 3_000;
const TRENDLINE_DRAWING_MS = 25_000;
const TRENDLINE_REVEAL_MS = 8_000;

const phaseValidator = v.union(
  v.literal('lobby'),
  v.literal('preparing'),
  v.literal('countdown'),
  v.literal('drawing'),
  v.literal('reveal'),
  v.literal('complete')
);

const roundSnapshotValidator = v.object({
  sourceKey: v.string(),
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
  values: v.array(v.number()),
  sourceName: v.string(),
  sourceOrganization: v.string(),
  sourceUrl: v.string(),
  licenseName: v.string(),
  retrievedAt: v.number(),
});

const leaderboardEntryValidator = v.object({
  rank: v.number(),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  totalPoints: v.number(),
  roundsSubmitted: v.number(),
  bestRoundPoints: v.number(),
  pointsGained: v.union(v.number(), v.null()),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});

const roundViewValidator = v.object({
  roundId: v.string(),
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

const gameViewValidator = v.object({
  gameNumber: v.number(),
  phase: phaseValidator,
  currentRoundNumber: v.number(),
  totalRounds: v.number(),
  phaseStartedAt: v.union(v.number(), v.null()),
  phaseEndsAt: v.union(v.number(), v.null()),
  round: v.union(roundViewValidator, v.null()),
  playerPrediction: v.union(playerPredictionValidator, v.null()),
  leaderboard: v.array(leaderboardEntryValidator),
});

function normalizePrediction(values: number[]): number[] {
  if (
    values.length !== TRENDLINE_POINT_COUNT ||
    values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ) {
    fail('INVALID_TRENDLINE_PREDICTION', 'Draw a complete line inside the chart before submitting.');
  }
  return values.map((value) => Math.round(value * 10_000) / 10_000);
}

export const getGame = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: gameViewValidator,
  handler: async (ctx, args) => {
    const { membership } = await requireRoomMember(ctx, args.roomId, args.sessionToken, {
      gameType: 'trendline',
      requireActive: false,
    });
    const view = await ctx.runQuery(components.trendline.game.getGameView, {
      roomId: args.roomId,
      memberId: membership._id,
    });
    if (view === null) throw new Error('Trendline game state is missing.');

    const memberIds = new Set(view.leaderboard.map((entry) => entry.memberId));
    const displayMembers = view.gameNumber === 0 ? await listRoomMembersForDisplay(ctx, args.roomId) : [];
    const memberById = new Map(
      (
        await Promise.all(
          [...memberIds].map(async (memberId) => await ctx.db.get('roomMembers', memberId as Id<'roomMembers'>))
        )
      )
        .filter((member) => member !== null)
        .map((member) => [member._id, member])
    );
    for (const member of displayMembers) memberById.set(member._id, member);
    const scoreByMemberId = new Map(view.leaderboard.map((entry) => [entry.memberId, entry]));
    const leaderboard = [...memberById.values()]
      .map((member) => {
        const score = scoreByMemberId.get(member._id);
        return {
          memberId: member._id,
          displayName: score?.displayName ?? member.displayName,
          totalPoints: score?.totalPoints ?? 0,
          roundsSubmitted: score?.roundsSubmitted ?? 0,
          bestRoundPoints: score?.bestRoundPoints ?? 0,
          pointsGained: score?.pointsGained ?? null,
          isCurrentPlayer: member._id === membership._id,
          isActive: member.isActive,
        };
      })
      .sort(
        (first, second) =>
          second.totalPoints - first.totalPoints ||
          second.bestRoundPoints - first.bestRoundPoints ||
          first.displayName.localeCompare(second.displayName)
      )
      .map((entry, index) => ({ rank: index + 1, ...entry }));
    return { ...view, leaderboard };
  },
});

export const startGame = action({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.object({ gameNumber: v.number(), startsAt: v.number() }),
  handler: async (ctx, args): Promise<{ gameNumber: number; startsAt: number }> => {
    const reservation = await ctx.runMutation(internal.trendline.reserveStart, args);
    let rounds: TrendlineRoundSnapshot[] = [];
    try {
      rounds = await fetchWorldBankTrendlineRounds(TRENDLINE_ROUND_COUNT);
    } catch (error) {
      console.error('Trendline World Bank preparation failed.', error);
      const cachedRounds = await ctx.runQuery(internal.trendline.listCachedRounds, {});
      rounds = selectTrendlineRounds(cachedRounds, TRENDLINE_ROUND_COUNT);
    }
    if (rounds.length < TRENDLINE_ROUND_COUNT) {
      await ctx.runMutation(internal.trendline.abortStart, {
        roomId: args.roomId,
        preparationId: reservation.preparationId,
      });
      fail(
        'TRENDLINE_PREPARATION_FAILED',
        'Fresh World Bank data is unavailable right now. Try starting the game again.'
      );
    }
    try {
      return await ctx.runMutation(internal.trendline.commitStart, {
        ...args,
        preparationId: reservation.preparationId,
        gameNumber: reservation.gameNumber,
        rounds,
      });
    } catch (error) {
      await ctx.runMutation(internal.trendline.abortStart, {
        roomId: args.roomId,
        preparationId: reservation.preparationId,
      });
      throw error;
    }
  },
});

export async function submitTrendlinePrediction(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; sessionToken: string; roundId: string; values: number[] }
): Promise<null> {
  const { room, membership } = await requireRoomMember(ctx, args.roomId, args.sessionToken, {
    gameType: 'trendline',
    requireActive: true,
  });
  if (room.status === 'closed') fail('ROOM_CLOSED', 'This room is closed.');
  const activeMembers = await listActiveRoomMembers(ctx, room._id);
  const result = await ctx.runMutation(components.trendline.game.submitPrediction, {
    roomId: room._id,
    memberId: membership._id,
    roundId: args.roundId,
    values: normalizePrediction(args.values),
    eligibleMemberIds: activeMembers.map((member) => member._id),
    now: Date.now(),
  });
  if (result.kind === 'not_running') fail('TRENDLINE_GAME_NOT_RUNNING', 'Trendline is not accepting drawings.');
  if (result.kind === 'closed') fail('TRENDLINE_DRAWING_CLOSED', 'This drawing round is closed.');
  if (result.kind === 'existing') fail('TRENDLINE_ALREADY_SUBMITTED', 'Your line is already locked in.');
  if (result.allLockedIn) {
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(0, internal.trendline.closeRound, {
      roomId: room._id,
      gameNumber: result.gameNumber,
      roundNumber: result.roundNumber,
    });
    void scheduledId;
  }
  return null;
}

export const submitPrediction = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    roundId: v.string(),
    values: v.array(v.number()),
  },
  returns: v.null(),
  handler: submitTrendlinePrediction,
});

export const revealHint = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), roundId: v.string() },
  returns: v.object({ endValue: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireRoomMember(ctx, args.roomId, args.sessionToken, {
      gameType: 'trendline',
      requireActive: true,
    });
    if (room.status === 'closed') fail('ROOM_CLOSED', 'This room is closed.');
    const result = await ctx.runMutation(components.trendline.game.revealHint, {
      roomId: room._id,
      memberId: membership._id,
      roundId: args.roundId,
      now: Date.now(),
    });
    if (result.kind === 'not_running') fail('TRENDLINE_GAME_NOT_RUNNING', 'Trendline is not accepting hints.');
    if (result.kind === 'closed') fail('TRENDLINE_HINT_CLOSED', 'The ending-value hint is no longer available.');
    return { endValue: result.endValue };
  },
});

export async function reserveTrendlineStart(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; sessionToken: string }
): Promise<{ preparationId: string; gameNumber: number }> {
  const { room, membership } = await requireRoomMember(ctx, args.roomId, args.sessionToken, {
    gameType: 'trendline',
    requireActive: true,
    requireOwner: true,
  });
  if (room.status === 'closed') fail('ROOM_CLOSED', 'This room is closed.');
  const preparationId = `${Date.now()}:${membership._id}`;
  const result = await ctx.runMutation(components.trendline.game.reserveStart, {
    roomId: room._id,
    preparationId,
    now: Date.now(),
  });
  if (result.kind === 'complete') fail('STALE_ROOM_GAME', 'Finish the next-game vote before starting Trendline.');
  if (result.kind === 'in_progress') fail('TRENDLINE_GAME_IN_PROGRESS', 'A Trendline game is already in progress.');
  if (result.kind === 'missing') throw new Error('Trendline game state is missing.');
  return { preparationId, gameNumber: result.gameNumber };
}

export const reserveStart = internalMutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.object({ preparationId: v.string(), gameNumber: v.number() }),
  handler: reserveTrendlineStart,
});

export const listCachedRounds = internalQuery({
  args: {},
  returns: v.array(roundSnapshotValidator),
  handler: async (ctx) => await ctx.runQuery(components.trendline.game.listCachedRounds, {}),
});

export const abortStart = internalMutation({
  args: { roomId: v.id('rooms'), preparationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(components.trendline.game.abortStart, args);
    return null;
  },
});

export const commitStart = internalMutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    preparationId: v.string(),
    gameNumber: v.number(),
    rounds: v.array(roundSnapshotValidator),
  },
  returns: v.object({ gameNumber: v.number(), startsAt: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireRoomMember(ctx, args.roomId, args.sessionToken, {
      gameType: 'trendline',
      requireActive: true,
    });
    if (membership.guestId !== room.ownerGuestId) fail('NOT_ROOM_OWNER', 'Only the room owner can start Trendline.');
    if (room.status === 'closed') fail('ROOM_CLOSED', 'This room is closed.');
    const now = Date.now();
    const startsAt = now + TRENDLINE_COUNTDOWN_MS;
    const participants = await listActiveRoomMembers(ctx, room._id);
    await activateCurrentRoomGame(ctx, room, 'trendline', now);
    const committed = await ctx.runMutation(components.trendline.game.commitStart, {
      roomId: room._id,
      preparationId: args.preparationId,
      gameNumber: args.gameNumber,
      rounds: args.rounds,
      participants: participants.map((participant) => ({
        memberId: participant._id,
        displayName: participant.displayName,
      })),
      now,
      startsAt,
    });
    if (!committed) {
      fail('TRENDLINE_PREPARATION_FAILED', 'Trendline could not finish loading. Try starting the game again.');
    }
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
      TRENDLINE_COUNTDOWN_MS,
      internal.trendline.beginDrawing,
      { roomId: room._id, gameNumber: args.gameNumber, roundNumber: 1 }
    );
    void scheduledId;
    return { gameNumber: args.gameNumber, startsAt };
  },
});

export const beginDrawing = internalMutation({
  args: { roomId: v.id('rooms'), gameNumber: v.number(), roundNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get('rooms', args.roomId);
    if (room === null || room.status === 'closed' || room.gameType !== 'trendline') return null;
    const now = Date.now();
    const began = await ctx.runMutation(components.trendline.game.beginDrawing, {
      ...args,
      now,
      phaseEndsAt: now + TRENDLINE_DRAWING_MS,
    });
    if (began) {
      const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
        TRENDLINE_DRAWING_MS,
        internal.trendline.closeRound,
        args
      );
      void scheduledId;
    }
    return null;
  },
});

export const closeRound = internalMutation({
  args: { roomId: v.id('rooms'), gameNumber: v.number(), roundNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get('rooms', args.roomId);
    if (room === null || room.status === 'closed' || room.gameType !== 'trendline') return null;
    const now = Date.now();
    const closed = await ctx.runMutation(components.trendline.game.closeRound, {
      ...args,
      now,
      phaseEndsAt: now + TRENDLINE_REVEAL_MS,
    });
    if (closed) {
      const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
        TRENDLINE_REVEAL_MS,
        internal.trendline.advanceAfterReveal,
        args
      );
      void scheduledId;
    }
    return null;
  },
});

export const advanceAfterReveal = internalMutation({
  args: { roomId: v.id('rooms'), gameNumber: v.number(), roundNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get('rooms', args.roomId);
    if (room === null || room.status === 'closed' || room.gameType !== 'trendline') return null;
    const now = Date.now();
    const result = await ctx.runMutation(components.trendline.game.advanceAfterReveal, {
      ...args,
      now,
      nextStartsAt: now + TRENDLINE_COUNTDOWN_MS,
    });
    if (result.kind === 'complete') {
      await completeCurrentRoomGame(ctx, room, 'trendline', now);
    } else if (result.kind === 'countdown') {
      const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
        TRENDLINE_COUNTDOWN_MS,
        internal.trendline.beginDrawing,
        { roomId: room._id, gameNumber: args.gameNumber, roundNumber: result.roundNumber }
      );
      void scheduledId;
    }
    return null;
  },
});
