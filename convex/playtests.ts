import { Presence } from '@convex-dev/presence';
import { v } from 'convex/values';
import { components, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx, mutation, query } from './_generated/server';
import { fail, normalizeRoomCode, validateSessionToken } from './domain';
import { gameTypeValidator } from './games';
import { gameBotRunCompletionReason, initializeGameBot, runGameBotTick, stopGameBot } from './playtestAdapters';

const playtestStatusValidator = v.union(
  v.literal('provisioning'),
  v.literal('running'),
  v.literal('stopping'),
  v.literal('stopped')
);

const runSummaryValidator = v.object({
  runId: v.id('playtestRuns'),
  gameType: gameTypeValidator,
  status: playtestStatusValidator,
  isActive: v.boolean(),
  requestedBotCount: v.number(),
  provisionedBotCount: v.number(),
  activeBotCount: v.number(),
  durationMs: v.union(v.number(), v.null()),
  startedAt: v.number(),
  endsAt: v.union(v.number(), v.null()),
  lastTickAt: v.union(v.number(), v.null()),
  stoppedAt: v.union(v.number(), v.null()),
  stopReason: v.union(v.string(), v.null()),
});

const inspectResultValidator = v.union(
  v.object({ kind: v.literal('not_found') }),
  v.object({ kind: v.literal('not_owner') }),
  v.object({
    kind: v.literal('room'),
    room: v.object({
      roomId: v.id('rooms'),
      code: v.string(),
      gameType: gameTypeValidator,
      status: v.union(v.literal('open'), v.literal('closed')),
      activeMemberCount: v.number(),
      humanMemberCount: v.number(),
      maxPlayers: v.number(),
    }),
    latestRun: v.union(runSummaryValidator, v.null()),
  })
);

const PROVISION_BATCH_SIZE = 8;
const BOT_TICK_BATCH_SIZE = 12;
const CLEANUP_BATCH_SIZE = 10;
const BOT_TICK_INTERVAL_MS = 75;
const BOT_HEARTBEAT_INTERVAL_MS = 5_000;
const BOT_HEARTBEAT_REFRESH_MS = 4_000;
const ALLOWED_DURATIONS_MS = [60_000, 120_000, 300_000] as const;
const presence = new Presence<Id<'rooms'>, Id<'roomMembers'>>(components.presence);

function summarizeRun(run: Doc<'playtestRuns'>) {
  return {
    runId: run._id,
    gameType: run.gameType,
    status: run.status,
    isActive: run.isActive,
    requestedBotCount: run.requestedBotCount,
    provisionedBotCount: run.provisionedBotCount,
    activeBotCount: run.activeBotCount,
    durationMs: run.durationMs,
    startedAt: run.startedAt,
    endsAt: run.endsAt,
    lastTickAt: run.lastTickAt,
    stoppedAt: run.stoppedAt,
    stopReason: run.stopReason,
  };
}

async function findRoomByCode(ctx: Pick<MutationCtx, 'db'>, code: string): Promise<Doc<'rooms'> | null> {
  return await ctx.db
    .query('rooms')
    .withIndex('by_code', (index) => index.eq('code', code))
    .unique();
}

async function findGuestByToken(ctx: Pick<MutationCtx, 'db'>, sessionToken: string) {
  return await ctx.db
    .query('guestSessions')
    .withIndex('by_sessionToken', (index) => index.eq('sessionToken', sessionToken))
    .unique();
}

async function requireRoomOwner(
  ctx: Pick<MutationCtx, 'db'>,
  room: Doc<'rooms'>,
  rawSessionToken: string
): Promise<void> {
  const sessionToken = validateSessionToken(rawSessionToken);
  const guest = await findGuestByToken(ctx, sessionToken);
  if (guest === null || guest._id !== room.ownerGuestId) {
    fail('NOT_ROOM_OWNER', 'Only the room owner can run a playtest.');
  }
}

async function beginStopping(ctx: MutationCtx, run: Doc<'playtestRuns'>, reason: string): Promise<void> {
  if (!run.isActive || run.status === 'stopping') {
    return;
  }
  await ctx.db.patch('playtestRuns', run._id, {
    status: 'stopping',
    stopReason: reason,
  });
  const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(0, internal.playtests.cleanup, {
    runId: run._id,
  });
  void scheduledId;
}

export const inspect = query({
  args: { code: v.string(), sessionToken: v.string() },
  returns: inspectResultValidator,
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const sessionToken = validateSessionToken(args.sessionToken);
    const room = await ctx.db
      .query('rooms')
      .withIndex('by_code', (index) => index.eq('code', code))
      .unique();
    if (room === null) {
      return { kind: 'not_found' as const };
    }

    const guest = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (index) => index.eq('sessionToken', sessionToken))
      .unique();
    if (guest === null || guest._id !== room.ownerGuestId) {
      return { kind: 'not_owner' as const };
    }

    const latestRun = await ctx.db
      .query('playtestRuns')
      .withIndex('by_roomId', (index) => index.eq('roomId', room._id))
      .order('desc')
      .first();
    const activeBotCount = latestRun?.isActive ? latestRun.activeBotCount : 0;

    return {
      kind: 'room' as const,
      room: {
        roomId: room._id,
        code: room.code,
        gameType: room.gameType,
        status: room.status,
        activeMemberCount: room.activeMemberCount,
        humanMemberCount: Math.max(0, room.activeMemberCount - activeBotCount),
        maxPlayers: room.maxPlayers,
      },
      latestRun: latestRun === null ? null : summarizeRun(latestRun),
    };
  },
});

export const start = mutation({
  args: {
    code: v.string(),
    sessionToken: v.string(),
    targetActiveMemberCount: v.number(),
    durationMs: v.optional(v.number()),
  },
  returns: v.object({ runId: v.id('playtestRuns') }),
  handler: async (ctx, args) => {
    const code = normalizeRoomCode(args.code);
    const room = await findRoomByCode(ctx, code);
    if (room === null) {
      fail('ROOM_NOT_FOUND', 'Room not found.');
    }
    await requireRoomOwner(ctx, room, args.sessionToken);
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'Open a new room before starting a playtest.');
    }
    if (
      !Number.isInteger(args.targetActiveMemberCount) ||
      args.targetActiveMemberCount < 2 ||
      args.targetActiveMemberCount > room.maxPlayers
    ) {
      fail('INVALID_PLAYTEST_TARGET', `Choose a room size between 2 and ${room.maxPlayers}.`);
    }
    if (
      room.gameType === 'drawing' &&
      !ALLOWED_DURATIONS_MS.includes(args.durationMs as (typeof ALLOWED_DURATIONS_MS)[number])
    ) {
      fail('INVALID_PLAYTEST_DURATION', 'Choose a playtest duration of 1, 2, or 5 minutes.');
    }

    const existingRun = await ctx.db
      .query('playtestRuns')
      .withIndex('by_roomId_and_isActive', (index) => index.eq('roomId', room._id).eq('isActive', true))
      .unique();
    if (existingRun !== null) {
      fail('PLAYTEST_ALREADY_RUNNING', 'Stop the current playtest before starting another one.');
    }

    const requestedBotCount = args.targetActiveMemberCount - room.activeMemberCount;
    if (requestedBotCount < 1) {
      fail('INVALID_PLAYTEST_TARGET', 'Choose a target above the number of people already in the room.');
    }

    const now = Date.now();
    const durationMs = room.gameType === 'trivia' ? null : (args.durationMs ?? null);
    const runId = await ctx.db.insert('playtestRuns', {
      roomId: room._id,
      gameType: room.gameType,
      status: 'provisioning',
      isActive: true,
      requestedBotCount,
      provisionedBotCount: 0,
      activeBotCount: 0,
      durationMs,
      startedAt: now,
      endsAt: durationMs === null ? null : now + durationMs,
      lastTickAt: null,
      stoppedAt: null,
      stopReason: null,
      nextBotNumber: 1,
      tickCursor: 1,
    });
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(0, internal.playtests.provision, {
      runId,
    });
    void scheduledId;
    return { runId };
  },
});

export const stop = mutation({
  args: { runId: v.id('playtestRuns'), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('playtestRuns', args.runId);
    if (run === null) {
      fail('PLAYTEST_NOT_FOUND', 'Playtest not found.');
    }
    const room = await ctx.db.get('rooms', run.roomId);
    if (room === null) {
      fail('ROOM_NOT_FOUND', 'Room not found.');
    }
    await requireRoomOwner(ctx, room, args.sessionToken);
    await beginStopping(ctx, run, 'Stopped by the room owner.');
    return null;
  },
});

export const provision = internalMutation({
  args: { runId: v.id('playtestRuns') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('playtestRuns', args.runId);
    if (run === null || !run.isActive || run.status !== 'provisioning') {
      return null;
    }
    const room = await ctx.db.get('rooms', run.roomId);
    if (room === null || room.status === 'closed') {
      await beginStopping(ctx, run, 'The room closed.');
      return null;
    }

    const remaining = run.requestedBotCount - run.provisionedBotCount;
    const availableSeats = Math.max(0, room.maxPlayers - room.activeMemberCount);
    const batchSize = Math.min(PROVISION_BATCH_SIZE, remaining, availableSeats);
    if (batchSize < 1) {
      if (run.provisionedBotCount < 1) {
        await ctx.db.patch('playtestRuns', run._id, {
          status: 'stopped',
          isActive: false,
          stoppedAt: Date.now(),
          stopReason: 'The room filled before bots could join.',
        });
        return null;
      }
      await ctx.db.patch('playtestRuns', run._id, {
        status: 'running',
        stopReason: remaining > 0 ? 'The room reached its player limit.' : null,
      });
      const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(0, internal.playtests.tick, {
        runId: run._id,
      });
      void scheduledId;
      return null;
    }

    const now = Date.now();
    for (let offset = 0; offset < batchSize; offset += 1) {
      const botNumber = run.nextBotNumber + offset;
      const displayName = `Bot ${String(botNumber).padStart(2, '0')}`;
      const guestId = await ctx.db.insert('guestSessions', {
        sessionToken: crypto.randomUUID(),
        displayName,
        createdAt: now,
        updatedAt: now,
      });
      const memberId = await ctx.db.insert('roomMembers', {
        roomId: room._id,
        guestId,
        displayName,
        isActive: true,
        joinedAt: now,
        leftAt: null,
      });
      const botId = await ctx.db.insert('playtestBots', {
        runId: run._id,
        roomId: room._id,
        guestId,
        memberId,
        botNumber,
        displayName,
        isActive: true,
        lastPresenceHeartbeatAt: 0,
        joinedAt: now,
        leftAt: null,
      });
      const bot = await ctx.db.get('playtestBots', botId);
      if (bot === null) {
        throw new Error('New playtest bot could not be loaded.');
      }
      await initializeGameBot(ctx, room, bot);
    }

    const provisionedBotCount = run.provisionedBotCount + batchSize;
    await ctx.db.patch('rooms', room._id, { activeMemberCount: room.activeMemberCount + batchSize });
    await ctx.db.patch('playtestRuns', run._id, {
      provisionedBotCount,
      activeBotCount: run.activeBotCount + batchSize,
      nextBotNumber: run.nextBotNumber + batchSize,
    });

    const shouldContinueProvisioning =
      provisionedBotCount < run.requestedBotCount && room.activeMemberCount + batchSize < room.maxPlayers;
    const scheduledId: Id<'_scheduled_functions'> = shouldContinueProvisioning
      ? await ctx.scheduler.runAfter(100, internal.playtests.provision, { runId: run._id })
      : await (async () => {
          await ctx.db.patch('playtestRuns', run._id, {
            status: 'running',
            stopReason: provisionedBotCount < run.requestedBotCount ? 'The room reached its player limit.' : null,
          });
          return await ctx.scheduler.runAfter(0, internal.playtests.tick, { runId: run._id });
        })();
    void scheduledId;
    return null;
  },
});

export const tick = internalMutation({
  args: { runId: v.id('playtestRuns') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('playtestRuns', args.runId);
    if (run === null || !run.isActive || run.status !== 'running') {
      return null;
    }
    const room = await ctx.db.get('rooms', run.roomId);
    if (room === null || room.status === 'closed') {
      await beginStopping(ctx, run, 'The room closed.');
      return null;
    }
    const now = Date.now();
    const completionReason = gameBotRunCompletionReason(room, run, now);
    if (completionReason !== null) {
      await beginStopping(ctx, run, completionReason);
      return null;
    }

    const tail = await ctx.db
      .query('playtestBots')
      .withIndex('by_runId_and_botNumber', (index) => index.eq('runId', run._id).gte('botNumber', run.tickCursor))
      .take(BOT_TICK_BATCH_SIZE);
    const head =
      tail.length < BOT_TICK_BATCH_SIZE
        ? await ctx.db
            .query('playtestBots')
            .withIndex('by_runId_and_botNumber', (index) => index.eq('runId', run._id).lt('botNumber', run.tickCursor))
            .take(BOT_TICK_BATCH_SIZE - tail.length)
        : [];
    const bots = [...tail, ...head].filter((bot) => bot.isActive);
    if (bots.length < 1) {
      await beginStopping(ctx, run, 'No active bots remained.');
      return null;
    }

    for (const bot of bots) {
      const presenceSessionId = `playtest-${run._id}-${bot.botNumber}`;
      if (now - (bot.lastPresenceHeartbeatAt ?? 0) >= BOT_HEARTBEAT_REFRESH_MS) {
        await presence.heartbeat(ctx, room._id, bot.memberId, presenceSessionId, BOT_HEARTBEAT_INTERVAL_MS);
        await ctx.db.patch('playtestBots', bot._id, { lastPresenceHeartbeatAt: now });
      }
      const { cursor } = await runGameBotTick(ctx, room, bot);
      await presence.updateRoomUser(ctx, room._id, bot.memberId, {
        ...cursor,
        displayName: bot.displayName,
      });
    }

    const lastBot = bots[bots.length - 1];
    await ctx.db.patch('playtestRuns', run._id, {
      lastTickAt: now,
      tickCursor: lastBot === undefined || lastBot.botNumber >= run.provisionedBotCount ? 1 : lastBot.botNumber + 1,
    });
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
      BOT_TICK_INTERVAL_MS,
      internal.playtests.tick,
      { runId: run._id }
    );
    void scheduledId;
    return null;
  },
});

export const cleanup = internalMutation({
  args: { runId: v.id('playtestRuns') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get('playtestRuns', args.runId);
    if (run === null || !run.isActive || run.status !== 'stopping') {
      return null;
    }
    const room = await ctx.db.get('rooms', run.roomId);
    const bots = await ctx.db
      .query('playtestBots')
      .withIndex('by_runId_and_isActive', (index) => index.eq('runId', run._id).eq('isActive', true))
      .take(CLEANUP_BATCH_SIZE);
    if (bots.length < 1) {
      await ctx.db.patch('playtestRuns', run._id, {
        status: 'stopped',
        isActive: false,
        activeBotCount: 0,
        stoppedAt: Date.now(),
      });
      return null;
    }

    const now = Date.now();
    let activeMembershipsRemoved = 0;
    for (const bot of bots) {
      await stopGameBot(ctx, room, bot);
      const membership = await ctx.db.get('roomMembers', bot.memberId);
      if (membership?.isActive) {
        await ctx.db.patch('roomMembers', membership._id, { isActive: false, leftAt: now });
        activeMembershipsRemoved += 1;
      }
      await ctx.db.patch('playtestBots', bot._id, { isActive: false, leftAt: now });
    }

    if (room !== null && activeMembershipsRemoved > 0) {
      await ctx.db.patch('rooms', room._id, {
        activeMemberCount: Math.max(0, room.activeMemberCount - activeMembershipsRemoved),
      });
    }
    await ctx.db.patch('playtestRuns', run._id, {
      activeBotCount: Math.max(0, run.activeBotCount - activeMembershipsRemoved),
    });
    const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(0, internal.playtests.cleanup, {
      runId: run._id,
    });
    void scheduledId;
    return null;
  },
});
