import { internal } from '../../_generated/api';
import type { Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { PROMPT_ARCADE_STALE_GENERATION_MS } from './engine';
import { createNextPromptArcadeRound, settleIdlePromptArcadePlaylist, startReadyPromptArcadePlaylist } from './rounds';

type GenerationLeaseArgs = {
  entryId: Id<'promptArcadeEntries'>;
  gameNumber: number;
  attempt: number;
};

async function isCurrentActivePromptArcadeRoomGame(ctx: MutationCtx, roomId: Id<'rooms'>): Promise<boolean> {
  const room = await ctx.db.get('rooms', roomId);
  if (
    room === null ||
    room.status === 'closed' ||
    room.gameType !== 'promptArcade' ||
    room.currentGameId === undefined
  ) {
    return false;
  }
  const roomGame = await ctx.db.get('roomGames', room.currentGameId);
  return (
    roomGame !== null &&
    roomGame.roomId === room._id &&
    roomGame.gameType === 'promptArcade' &&
    roomGame.status === 'active'
  );
}

export async function beginPromptArcadeGeneration(ctx: MutationCtx, args: GenerationLeaseArgs) {
  const entry = await ctx.db.get('promptArcadeEntries', args.entryId);
  if (
    entry === null ||
    entry.gameNumber !== args.gameNumber ||
    entry.attempt !== args.attempt ||
    entry.status !== 'queued' ||
    entry.prompt === null
  ) {
    return null;
  }
  const state = await ctx.db
    .query('promptArcadeGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', entry.roomId))
    .unique();
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.phase === 'complete' ||
    !(await isCurrentActivePromptArcadeRoomGame(ctx, entry.roomId))
  ) {
    return null;
  }
  const now = Date.now();
  await ctx.db.patch('promptArcadeEntries', entry._id, {
    status: 'generating',
    errorMessage: null,
    statusUpdatedAt: now,
  });
  return {
    entryId: entry._id,
    roomId: entry.roomId,
    memberId: entry.memberId,
    gameNumber: entry.gameNumber,
    attempt: entry.attempt,
    prompt: entry.prompt,
  };
}

export async function setPromptArcadeGenerationStatus(
  ctx: MutationCtx,
  args: GenerationLeaseArgs & { status: 'validating' | 'repairing' }
) {
  const entry = await ctx.db.get('promptArcadeEntries', args.entryId);
  if (
    entry === null ||
    entry.gameNumber !== args.gameNumber ||
    entry.attempt !== args.attempt ||
    (entry.status !== 'generating' && entry.status !== 'validating' && entry.status !== 'repairing')
  ) {
    return false;
  }
  if (!(await isCurrentActivePromptArcadeRoomGame(ctx, entry.roomId))) return false;
  await ctx.db.patch('promptArcadeEntries', entry._id, { status: args.status, statusUpdatedAt: Date.now() });
  return true;
}

export async function markPromptArcadeGenerationFailed(
  ctx: MutationCtx,
  args: GenerationLeaseArgs & { errorMessage: string }
) {
  const entry = await ctx.db.get('promptArcadeEntries', args.entryId);
  if (
    entry === null ||
    entry.gameNumber !== args.gameNumber ||
    entry.attempt !== args.attempt ||
    entry.status === 'ready' ||
    entry.status === 'played'
  ) {
    return false;
  }
  const member = await ctx.db.get('roomMembers', entry.memberId);
  const status = member?.isActive === false ? ('withdrawn' as const) : ('needsRevision' as const);
  const now = Date.now();
  await ctx.db.patch('promptArcadeEntries', entry._id, {
    status,
    errorMessage: Array.from(args.errorMessage.normalize('NFKC').trim()).slice(0, 300).join(''),
    readyAt: null,
    statusUpdatedAt: now,
  });
  const state = await ctx.db
    .query('promptArcadeGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', entry.roomId))
    .unique();
  if (
    state !== null &&
    state.gameNumber === entry.gameNumber &&
    state.playlistStarted &&
    state.currentRoundId === null
  ) {
    await settleIdlePromptArcadePlaylist(ctx, state, now);
  }
  return true;
}

export async function expirePromptArcadeGenerationLease(ctx: MutationCtx, args: GenerationLeaseArgs): Promise<null> {
  const entry = await ctx.db.get('promptArcadeEntries', args.entryId);
  if (
    entry === null ||
    entry.gameNumber !== args.gameNumber ||
    entry.attempt !== args.attempt ||
    (entry.status !== 'queued' &&
      entry.status !== 'generating' &&
      entry.status !== 'validating' &&
      entry.status !== 'repairing')
  ) {
    return null;
  }
  const now = Date.now();
  const ageMs = now - entry.statusUpdatedAt;
  if (ageMs < PROMPT_ARCADE_STALE_GENERATION_MS) {
    await ctx.scheduler.runAfter(
      PROMPT_ARCADE_STALE_GENERATION_MS - ageMs,
      internal.promptArcade.expireGenerationLease,
      args
    );
    return null;
  }
  const member = await ctx.db.get('roomMembers', entry.memberId);
  const status = member?.isActive === false ? ('withdrawn' as const) : ('needsRevision' as const);
  await ctx.db.patch('promptArcadeEntries', entry._id, {
    status,
    errorMessage:
      status === 'withdrawn'
        ? 'The author left before this game finished generating.'
        : 'Generation stopped before finishing. Retry this prompt to continue.',
    readyAt: null,
    statusUpdatedAt: now,
  });
  const state = await ctx.db
    .query('promptArcadeGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', entry.roomId))
    .unique();
  if (
    state !== null &&
    state.gameNumber === entry.gameNumber &&
    state.playlistStarted &&
    state.currentRoundId === null
  ) {
    await settleIdlePromptArcadePlaylist(ctx, state, now);
  }
  return null;
}

export async function commitPromptArcadeArtifact(
  ctx: MutationCtx,
  args: GenerationLeaseArgs & {
    title: string;
    interpretation: string;
    instructions: string;
    durationMs: number;
    scoringMode: 'speed' | 'quality' | 'qualityAndSpeed';
    codeStorageId: Id<'_storage'>;
    codeSha256: string;
    model: string;
  }
) {
  const entry = await ctx.db.get('promptArcadeEntries', args.entryId);
  if (
    entry === null ||
    entry.gameNumber !== args.gameNumber ||
    entry.attempt !== args.attempt ||
    entry.status !== 'validating'
  ) {
    return false;
  }
  const state = await ctx.db
    .query('promptArcadeGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', entry.roomId))
    .unique();
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.phase === 'complete' ||
    !(await isCurrentActivePromptArcadeRoomGame(ctx, entry.roomId))
  ) {
    return false;
  }
  const now = Date.now();
  const artifactId = await ctx.db.insert('promptArcadeArtifacts', {
    roomId: entry.roomId,
    gameNumber: entry.gameNumber,
    entryId: entry._id,
    memberId: entry.memberId,
    title: args.title,
    interpretation: args.interpretation,
    instructions: args.instructions,
    durationMs: args.durationMs,
    scoringMode: args.scoringMode,
    codeStorageId: args.codeStorageId,
    codeSha256: args.codeSha256,
    model: args.model,
    createdAt: now,
  });
  await ctx.db.patch('promptArcadeEntries', entry._id, {
    status: 'ready',
    artifactId,
    errorMessage: null,
    readyAt: now,
    statusUpdatedAt: now,
  });
  if (state.playlistStarted && state.currentRoundId === null) {
    await createNextPromptArcadeRound(ctx, state, now);
  } else if (!state.playlistStarted) {
    await startReadyPromptArcadePlaylist(ctx, state, now, true);
  }
  return true;
}
