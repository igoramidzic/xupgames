import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { PROMPT_ARCADE_MAX_PLAYERS } from './engine';
import { findPromptArcadeEntry, findPromptArcadeState, listPromptArcadeEntries } from './state';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

const initialOperationalState = {
  phase: 'lobby' as const,
  currentRoundId: null,
  currentRoundNumber: 0,
  playlistStarted: false,
  participantCount: 0,
  phaseStartedAt: null,
  phaseEndsAt: null,
};

export async function initializePromptArcadeGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const existing = await findPromptArcadeState(ctx, roomId);
  if (existing !== null) return;
  await ctx.db.insert('promptArcadeGameStates', { roomId, gameNumber: 0, ...initialOperationalState });
}

export async function preparePromptArcadeGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<void> {
  const state = await findPromptArcadeState(ctx, roomId);
  if (state === null) {
    await initializePromptArcadeGame(ctx, roomId);
    return;
  }
  await ctx.db.patch('promptArcadeGameStates', state._id, initialOperationalState);
}

/**
 * Closing the shared room is also a terminal Prompt Arcade transition. Bumping
 * every unfinished entry's attempt invalidates queued and in-flight generation
 * leases, so late provider responses cannot restore or commit a closed game.
 */
export async function closePromptArcadeGame(ctx: MutationCtx, roomId: Id<'rooms'>, now: number): Promise<void> {
  const state = await findPromptArcadeState(ctx, roomId);
  if (state === null || state.phase === 'complete') return;

  const entries = await listPromptArcadeEntries(ctx, roomId, state.gameNumber);
  for (const entry of entries) {
    if (entry.status === 'played' || entry.status === 'withdrawn') continue;
    await ctx.db.patch('promptArcadeEntries', entry._id, {
      status: 'withdrawn',
      attempt: entry.attempt + 1,
      errorMessage: 'The room closed before this game was played.',
      readyAt: null,
      statusUpdatedAt: now,
    });
  }

  await ctx.db.patch('promptArcadeGameStates', state._id, {
    phase: 'complete',
    currentRoundId: null,
    phaseStartedAt: now,
    phaseEndsAt: null,
  });
}

async function enrollPromptArcadeParticipant(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<void> {
  const state = await findPromptArcadeState(ctx, roomId);
  if (
    state === null ||
    state.gameNumber === 0 ||
    state.playlistStarted ||
    (state.phase !== 'prompting' && state.phase !== 'generating')
  ) {
    return;
  }
  if (await findPromptArcadeEntry(ctx, roomId, state.gameNumber, membership._id)) return;
  const entries = await listPromptArcadeEntries(ctx, roomId, state.gameNumber);
  if (entries.length >= PROMPT_ARCADE_MAX_PLAYERS) return;
  await ctx.db.insert('promptArcadeEntries', {
    roomId,
    gameNumber: state.gameNumber,
    memberId: membership._id,
    displayName: membership.displayName,
    prompt: null,
    status: 'writing',
    order: entries.length,
    attempt: 0,
    artifactId: null,
    errorMessage: null,
    submittedAt: null,
    readyAt: null,
    statusUpdatedAt: now,
  });
  await ctx.db.insert('promptArcadeScores', {
    roomId,
    gameNumber: state.gameNumber,
    memberId: membership._id,
    displayName: membership.displayName,
    totalScore: 0,
    roundsFinished: 0,
    updatedAt: now,
  });
  await ctx.db.patch('promptArcadeGameStates', state._id, { participantCount: entries.length + 1 });
}

/**
 * A human joining while prompt collection is still open becomes a prompt
 * author. Once the playlist begins, membership remains shared room state and
 * does not create surprise work in an already-fixed playlist.
 */
export async function syncPromptArcadeMembership(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  membership: Pick<Doc<'roomMembers'>, '_id' | 'displayName'>,
  now: number
): Promise<void> {
  const member = await ctx.db.get('roomMembers', membership._id);
  if (member === null || !member.isActive || member.memberKind === 'playtestBot') return;
  if (
    member.memberKind === undefined &&
    (await ctx.db
      .query('playtestBots')
      .withIndex('by_memberId', (index) => index.eq('memberId', member._id))
      .first()) !== null
  ) {
    return;
  }
  await enrollPromptArcadeParticipant(ctx, roomId, membership, now);
}

/** Enrolls only a bot already provisioned by the owner-only playtest runner. */
export async function enrollPromptArcadePlaytestBot(
  ctx: MutationCtx,
  bot: Pick<Doc<'playtestBots'>, 'roomId' | 'memberId' | 'displayName'>,
  now: number
): Promise<void> {
  const member = await ctx.db.get('roomMembers', bot.memberId);
  if (member === null || member.roomId !== bot.roomId || member.memberKind !== 'playtestBot' || !member.isActive) {
    return;
  }
  await enrollPromptArcadeParticipant(ctx, bot.roomId, { _id: bot.memberId, displayName: bot.displayName }, now);
}

export async function promptArcadeGameIsComplete(ctx: DatabaseReaderContext, roomId: Id<'rooms'>): Promise<boolean> {
  return (await findPromptArcadeState(ctx, roomId))?.phase === 'complete';
}
