import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx, mutation, type QueryCtx, query } from './_generated/server';
import { fail, MAX_PLAYERS } from './domain';
import { requireRoomMember } from './roomAccess';
import { activateCurrentRoomGame, completeCurrentRoomGame } from './roomGames';
import { listActiveRoomMembers } from './roomMembers';
import { chooseTypeRacerPassage } from './typeRacerPassages';
import { calculateTypeRacerAccuracy, calculateTypeRacerWpm, compareTypeRacerProgress } from './typeRacerScoring';

export const TYPE_RACER_COUNTDOWN_MS = 4_000;
export const TYPE_RACER_FINISH_GRACE_MS = 15_000;
export const TYPE_RACER_MAX_DURATION_MS = 5 * 60_000;

const typeRacerPhaseValidator = v.union(
  v.literal('lobby'),
  v.literal('countdown'),
  v.literal('racing'),
  v.literal('complete')
);
const typeRacerProgressStatusValidator = v.union(v.literal('waiting'), v.literal('racing'), v.literal('finished'));
const typeRacerPassageKindValidator = v.union(v.literal('phrase'), v.literal('sentence'), v.literal('paragraph'));
const racerValidator = v.object({
  rank: v.number(),
  memberId: v.id('roomMembers'),
  displayName: v.string(),
  status: typeRacerProgressStatusValidator,
  correctChars: v.number(),
  typedChars: v.number(),
  totalChars: v.number(),
  progress: v.number(),
  wpm: v.number(),
  accuracy: v.number(),
  startedAt: v.number(),
  finishedAt: v.union(v.number(), v.null()),
  finishTimeMs: v.union(v.number(), v.null()),
  isCurrentPlayer: v.boolean(),
  isActive: v.boolean(),
});
const gameViewValidator = v.object({
  raceNumber: v.number(),
  phase: typeRacerPhaseValidator,
  phaseStartedAt: v.union(v.number(), v.null()),
  startsAt: v.union(v.number(), v.null()),
  phaseEndsAt: v.union(v.number(), v.null()),
  participantCount: v.number(),
  finishedCount: v.number(),
  winnerMemberId: v.union(v.id('roomMembers'), v.null()),
  passage: v.union(
    v.null(),
    v.object({
      id: v.string(),
      text: v.string(),
      title: v.string(),
      author: v.string(),
      kind: typeRacerPassageKindValidator,
    })
  ),
  racers: v.array(racerValidator),
  currentPlayer: v.union(racerValidator, v.null()),
});

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export type TypeRacerProgressReport = {
  correctChars: number;
  typedChars: number;
  totalKeystrokes: number;
  errorKeystrokes: number;
  revision: number;
  typedText?: string;
};

export async function findTypeRacerGameState(ctx: DatabaseReaderContext, roomId: Id<'rooms'>) {
  return await ctx.db
    .query('typeRacerGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

export async function enrollTypeRacerMemberInActiveRace(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<boolean> {
  const state = await findTypeRacerGameState(ctx, roomId);
  if (state === null || state.startsAt === null || (state.phase !== 'countdown' && state.phase !== 'racing')) {
    return false;
  }

  const existing = await ctx.db
    .query('typeRacerProgress')
    .withIndex('by_roomId_and_memberId', (index) => index.eq('roomId', roomId).eq('memberId', membership._id))
    .unique();
  if (existing?.raceNumber === state.raceNumber) {
    if (existing.displayName !== membership.displayName) {
      await ctx.db.patch('typeRacerProgress', existing._id, { displayName: membership.displayName });
    }
    return false;
  }

  const hasStarted = now >= state.startsAt;
  const fields = {
    raceNumber: state.raceNumber,
    displayName: membership.displayName,
    status: hasStarted ? ('racing' as const) : ('waiting' as const),
    correctChars: 0,
    typedChars: 0,
    totalKeystrokes: 0,
    errorKeystrokes: 0,
    revision: 0,
    wpm: 0,
    accuracy: 100,
    startedAt: hasStarted ? now : state.startsAt,
    finishedAt: null,
    updatedAt: now,
  };
  if (existing === null) {
    await ctx.db.insert('typeRacerProgress', {
      roomId,
      memberId: membership._id,
      ...fields,
    });
  } else {
    await ctx.db.patch('typeRacerProgress', existing._id, fields);
  }
  await ctx.db.patch('typeRacerGameStates', state._id, {
    participantCount: state.participantCount + 1,
  });
  return true;
}

async function requireTypeRacerMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  rawSessionToken: string,
  requireActive: boolean
): Promise<{ room: Doc<'rooms'>; membership: Doc<'roomMembers'> }> {
  return await requireRoomMember(ctx, roomId, rawSessionToken, {
    gameType: 'typeRacer',
    requireActive,
  });
}

function validateProgressReport(report: TypeRacerProgressReport, passageLength: number): void {
  const values = [
    report.correctChars,
    report.typedChars,
    report.totalKeystrokes,
    report.errorKeystrokes,
    report.revision,
  ];
  if (
    values.some((value) => !Number.isInteger(value) || value < 0) ||
    report.revision < 1 ||
    report.correctChars > passageLength ||
    report.typedChars > passageLength ||
    report.correctChars > report.typedChars ||
    report.correctChars > report.totalKeystrokes ||
    report.errorKeystrokes > report.totalKeystrokes
  ) {
    fail('INVALID_TYPE_RACER_PROGRESS', 'Typing progress is invalid.');
  }
}

export async function recordTypeRacerProgress(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  membership: Doc<'roomMembers'>,
  report: TypeRacerProgressReport,
  now: number
): Promise<
  | { kind: 'accepted'; wpm: number; accuracy: number; finished: boolean }
  | { kind: 'not_running' | 'not_participating' | 'too_early' }
> {
  const state = await findTypeRacerGameState(ctx, room._id);
  if (
    state === null ||
    state.passageText === null ||
    state.startsAt === null ||
    (state.phase !== 'countdown' && state.phase !== 'racing')
  ) {
    return { kind: 'not_running' };
  }
  validateProgressReport(report, state.passageText.length);
  if (now < state.startsAt) {
    return { kind: 'too_early' };
  }

  const progress = await ctx.db
    .query('typeRacerProgress')
    .withIndex('by_roomId_and_memberId', (index) => index.eq('roomId', room._id).eq('memberId', membership._id))
    .unique();
  if (progress === null || progress.raceNumber !== state.raceNumber) {
    return { kind: 'not_participating' };
  }
  if (progress.status === 'finished' || report.revision <= progress.revision) {
    return {
      kind: 'accepted',
      wpm: progress.wpm,
      accuracy: progress.accuracy,
      finished: progress.status === 'finished',
    };
  }

  const isFinished = report.typedText !== undefined;
  if (isFinished && (report.typedText !== state.passageText || report.correctChars !== state.passageText.length)) {
    fail('INVALID_TYPE_RACER_PROGRESS', 'The passage must be typed exactly before finishing.');
  }
  const elapsedMs = Math.max(1, now - progress.startedAt);
  const wpm = calculateTypeRacerWpm(report.correctChars, elapsedMs);
  const accuracy = calculateTypeRacerAccuracy(report.totalKeystrokes, report.errorKeystrokes);
  await ctx.db.patch('typeRacerProgress', progress._id, {
    status: isFinished ? 'finished' : 'racing',
    correctChars: report.correctChars,
    typedChars: report.typedChars,
    totalKeystrokes: report.totalKeystrokes,
    errorKeystrokes: report.errorKeystrokes,
    revision: report.revision,
    wpm,
    accuracy,
    finishedAt: isFinished ? now : null,
    updatedAt: now,
  });

  if (state.phase === 'countdown') {
    await ctx.db.patch('typeRacerGameStates', state._id, {
      phase: 'racing',
      phaseStartedAt: state.startsAt,
      phaseEndsAt: state.startsAt + TYPE_RACER_MAX_DURATION_MS,
    });
  }

  if (isFinished) {
    const finishedCount = state.finishedCount + 1;
    const firstFinisher = state.winnerMemberId === null;
    const allFinished = finishedCount >= state.participantCount;
    const finishDeadline = firstFinisher ? now + TYPE_RACER_FINISH_GRACE_MS : state.phaseEndsAt;
    await ctx.db.patch('typeRacerGameStates', state._id, {
      finishedCount,
      winnerMemberId: firstFinisher ? membership._id : state.winnerMemberId,
      winnerFinishedAt: firstFinisher ? now : state.winnerFinishedAt,
      phase: allFinished ? 'complete' : 'racing',
      phaseStartedAt: allFinished ? now : state.phaseStartedAt,
      phaseEndsAt: allFinished ? null : finishDeadline,
    });
    if (firstFinisher && !allFinished) {
      const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
        TYPE_RACER_FINISH_GRACE_MS,
        internal.typeRacer.finalizeRace,
        { stateId: state._id, raceNumber: state.raceNumber }
      );
      void scheduledId;
    }
    if (allFinished) {
      await completeCurrentRoomGame(ctx, room, 'typeRacer', now);
    }
  }

  return { kind: 'accepted', wpm, accuracy, finished: isFinished };
}

export const getRace = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: gameViewValidator,
  handler: async (ctx, args) => {
    const { membership } = await requireTypeRacerMember(ctx, args.roomId, args.sessionToken, false);
    const state = await findTypeRacerGameState(ctx, args.roomId);
    if (state === null) {
      throw new Error('Type racer game state is missing.');
    }

    const totalChars = state.passageText?.length ?? 0;
    let progress = await ctx.db
      .query('typeRacerProgress')
      .withIndex('by_roomId_and_raceNumber', (index) =>
        index.eq('roomId', args.roomId).eq('raceNumber', state.raceNumber)
      )
      .take(MAX_PLAYERS + 1);
    if (progress.length > MAX_PLAYERS) {
      throw new Error('Type racer participant capacity invariant violated.');
    }
    if (state.raceNumber === 0) {
      const activeMembers = await listActiveRoomMembers(ctx, args.roomId);
      progress = activeMembers.map((member) => ({
        _id: `waiting-${member._id}` as Id<'typeRacerProgress'>,
        _creationTime: member.joinedAt,
        roomId: args.roomId,
        memberId: member._id,
        raceNumber: 0,
        displayName: member.displayName,
        status: 'waiting' as const,
        correctChars: 0,
        typedChars: 0,
        totalKeystrokes: 0,
        errorKeystrokes: 0,
        revision: 0,
        wpm: 0,
        accuracy: 100,
        startedAt: 0,
        finishedAt: null,
        updatedAt: member.joinedAt,
      }));
    }

    const members = await Promise.all(progress.map(async (entry) => await ctx.db.get('roomMembers', entry.memberId)));
    const sorted = [...progress].sort(compareTypeRacerProgress);
    const racers = sorted.map((entry, index) => {
      const member = members.find((candidate) => candidate?._id === entry.memberId);
      return {
        rank: index + 1,
        memberId: entry.memberId,
        displayName: entry.displayName,
        status: entry.status,
        correctChars: entry.correctChars,
        typedChars: entry.typedChars,
        totalChars,
        progress: totalChars < 1 ? 0 : entry.correctChars / totalChars,
        wpm: entry.wpm,
        accuracy: entry.accuracy,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
        finishTimeMs: entry.finishedAt === null ? null : Math.max(0, entry.finishedAt - entry.startedAt),
        isCurrentPlayer: entry.memberId === membership._id,
        isActive: member?.isActive ?? false,
      };
    });

    return {
      raceNumber: state.raceNumber,
      phase: state.phase,
      phaseStartedAt: state.phaseStartedAt,
      startsAt: state.startsAt,
      phaseEndsAt: state.phaseEndsAt,
      participantCount: state.participantCount,
      finishedCount: state.finishedCount,
      winnerMemberId: state.winnerMemberId,
      passage:
        state.passageId === null ||
        state.passageText === null ||
        state.passageTitle === null ||
        state.passageAuthor === null ||
        state.passageKind === null
          ? null
          : {
              id: state.passageId,
              text: state.passageText,
              title: state.passageTitle,
              author: state.passageAuthor,
              kind: state.passageKind,
            },
      racers,
      currentPlayer: racers.find((racer) => racer.isCurrentPlayer) ?? null,
    };
  },
});

export const startRace = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.object({ raceNumber: v.number(), startsAt: v.number() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireTypeRacerMember(ctx, args.roomId, args.sessionToken, true);
    if (membership.guestId !== room.ownerGuestId) {
      fail('NOT_ROOM_OWNER', 'Only the room owner can start the race.');
    }
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const state = await findTypeRacerGameState(ctx, room._id);
    if (state === null) {
      throw new Error('Type racer game state is missing.');
    }
    if (state.phase === 'countdown' || state.phase === 'racing') {
      fail('TYPE_RACER_IN_PROGRESS', 'A type race is already in progress.');
    }
    if (state.phase === 'complete') {
      fail('STALE_ROOM_GAME', 'Finish the next-game vote before starting another race.');
    }

    const participants = await listActiveRoomMembers(ctx, room._id);
    const passage = chooseTypeRacerPassage(state.passageId);
    const now = Date.now();
    await activateCurrentRoomGame(ctx, room, 'typeRacer', now);
    const startsAt = now + TYPE_RACER_COUNTDOWN_MS;
    const raceNumber = state.raceNumber + 1;
    for (const participant of participants) {
      const existing = await ctx.db
        .query('typeRacerProgress')
        .withIndex('by_roomId_and_memberId', (index) => index.eq('roomId', room._id).eq('memberId', participant._id))
        .unique();
      const fields = {
        raceNumber,
        displayName: participant.displayName,
        status: 'waiting' as const,
        correctChars: 0,
        typedChars: 0,
        totalKeystrokes: 0,
        errorKeystrokes: 0,
        revision: 0,
        wpm: 0,
        accuracy: 100,
        startedAt: startsAt,
        finishedAt: null,
        updatedAt: now,
      };
      if (existing === null) {
        await ctx.db.insert('typeRacerProgress', {
          roomId: room._id,
          memberId: participant._id,
          ...fields,
        });
      } else {
        await ctx.db.patch('typeRacerProgress', existing._id, fields);
      }
    }

    await ctx.db.patch('typeRacerGameStates', state._id, {
      raceNumber,
      phase: 'countdown',
      passageId: passage.id,
      passageText: passage.text,
      passageTitle: passage.title,
      passageAuthor: passage.author,
      passageKind: passage.kind,
      phaseStartedAt: now,
      startsAt,
      phaseEndsAt: startsAt,
      participantCount: participants.length,
      finishedCount: 0,
      winnerMemberId: null,
      winnerFinishedAt: null,
    });
    const beginScheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
      TYPE_RACER_COUNTDOWN_MS,
      internal.typeRacer.beginRace,
      { stateId: state._id, raceNumber }
    );
    const timeoutScheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
      TYPE_RACER_COUNTDOWN_MS + TYPE_RACER_MAX_DURATION_MS,
      internal.typeRacer.finalizeRace,
      { stateId: state._id, raceNumber }
    );
    void beginScheduledId;
    void timeoutScheduledId;
    return { raceNumber, startsAt };
  },
});

export const reportProgress = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    correctChars: v.number(),
    typedChars: v.number(),
    totalKeystrokes: v.number(),
    errorKeystrokes: v.number(),
    revision: v.number(),
    typedText: v.optional(v.string()),
  },
  returns: v.object({ wpm: v.number(), accuracy: v.number(), finished: v.boolean() }),
  handler: async (ctx, args) => {
    const { room, membership } = await requireTypeRacerMember(ctx, args.roomId, args.sessionToken, true);
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const result = await recordTypeRacerProgress(ctx, room, membership, args, Date.now());
    if (result.kind === 'not_running') {
      fail('TYPE_RACER_NOT_RUNNING', 'There is no active type race.');
    }
    if (result.kind === 'not_participating') {
      fail('TYPE_RACER_NOT_PARTICIPATING', 'You are not on the current race roster. Rejoin the room and try again.');
    }
    if (result.kind === 'too_early') {
      fail('TYPE_RACER_NOT_RUNNING', 'Wait for the countdown to finish.');
    }
    if (result.kind !== 'accepted') {
      throw new Error(`Unexpected type racer progress result: ${result.kind}`);
    }
    return { wpm: result.wpm, accuracy: result.accuracy, finished: result.finished };
  },
});

export const beginRace = internalMutation({
  args: { stateId: v.id('typeRacerGameStates'), raceNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('typeRacerGameStates', args.stateId);
    if (state === null || state.raceNumber !== args.raceNumber || state.phase !== 'countdown') {
      return null;
    }
    const room = await ctx.db.get('rooms', state.roomId);
    const now = Date.now();
    if (room === null || room.status === 'closed' || state.startsAt === null) {
      await ctx.db.patch('typeRacerGameStates', state._id, {
        phase: 'complete',
        phaseStartedAt: now,
        phaseEndsAt: null,
      });
      return null;
    }
    await ctx.db.patch('typeRacerGameStates', state._id, {
      phase: 'racing',
      phaseStartedAt: state.startsAt,
      phaseEndsAt: state.startsAt + TYPE_RACER_MAX_DURATION_MS,
    });
    return null;
  },
});

export const finalizeRace = internalMutation({
  args: { stateId: v.id('typeRacerGameStates'), raceNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.get('typeRacerGameStates', args.stateId);
    if (
      state === null ||
      state.raceNumber !== args.raceNumber ||
      (state.phase !== 'countdown' && state.phase !== 'racing')
    ) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch('typeRacerGameStates', state._id, {
      phase: 'complete',
      phaseStartedAt: now,
      phaseEndsAt: null,
    });
    const room = await ctx.db.get('rooms', state.roomId);
    if (room !== null && room.status !== 'closed') {
      await completeCurrentRoomGame(ctx, room, 'typeRacer', now);
    }
    return null;
  },
});
