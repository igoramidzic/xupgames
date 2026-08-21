import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { enrollTypeRacerMemberInActiveRace } from '../../typeRacer';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

const initialTypeRacerState = {
  raceNumber: 0,
  phase: 'lobby' as const,
  passageId: null,
  passageText: null,
  passageTitle: null,
  passageAuthor: null,
  passageKind: null,
  phaseStartedAt: null,
  startsAt: null,
  phaseEndsAt: null,
  participantCount: 0,
  finishedCount: 0,
  winnerMemberId: null,
  winnerFinishedAt: null,
};

export async function initializeTypeRacerGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  await ctx.db.insert('typeRacerGameStates', { roomId, ...initialTypeRacerState });
}

export async function prepareTypeRacerGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const state = await ctx.db
    .query('typeRacerGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  if (state === null) {
    await initializeTypeRacerGame(ctx, roomId);
    return;
  }
  await ctx.db.patch('typeRacerGameStates', state._id, initialTypeRacerState);
}

export async function syncTypeRacerMembership(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<void> {
  await enrollTypeRacerMemberInActiveRace(ctx, roomId, membership, now);
}

export async function typeRacerGameIsComplete(ctx: DatabaseReaderContext, roomId: Id<'rooms'>): Promise<boolean> {
  const state = await ctx.db
    .query('typeRacerGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
  return state?.phase === 'complete';
}
