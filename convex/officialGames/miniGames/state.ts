import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { requireRoomMember } from '../../roomAccess';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export async function findMiniGamesState(ctx: DatabaseReaderContext, roomId: Id<'rooms'>) {
  return await ctx.db
    .query('miniGamesGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

export async function requireMiniGamesMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  sessionToken: string,
  requireActive: boolean
) {
  return await requireRoomMember(ctx, roomId, sessionToken, { gameType: 'miniGames', requireActive });
}

export async function insertRoundParticipant(
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
