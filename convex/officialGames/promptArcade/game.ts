import { internal } from '../../_generated/api';
import type { Doc, Id } from '../../_generated/dataModel';
import { env, type MutationCtx } from '../../_generated/server';
import { activateCurrentRoomGame } from '../../roomGames';
import { listActiveHumanRoomMembers, listActiveRoomMembers } from '../../roomMembers';
import { normalizePromptArcadePrompt, PROMPT_ARCADE_MAX_PLAYERS, PROMPT_ARCADE_STALE_GENERATION_MS } from './engine';
import { recordPromptArcadeResult, settleIdlePromptArcadePlaylist, startReadyPromptArcadePlaylist } from './rounds';
import {
  findPromptArcadeEntry,
  findPromptArcadeState,
  listPromptArcadeEntries,
  promptArcadeFail,
  requirePromptArcadeMember,
  withdrawInactiveUnusablePromptEntries,
} from './state';

type GameRequest = { roomId: Id<'rooms'>; sessionToken: string };
const GENERATION_STATUSES = new Set(['queued', 'generating', 'validating', 'repairing']);
const STALLED_UNRESOLVED_STATUSES = new Set(['writing', 'needsRevision']);
const STALLED_BLOCKING_STATUSES = new Set(['ready', 'queued', 'generating', 'validating', 'repairing']);

export function analyzeStalledPromptArcadeEntries<TEntry extends { status: string }>(entries: readonly TEntry[]) {
  return {
    unresolved: entries.filter((entry) => STALLED_UNRESOLVED_STATUSES.has(entry.status)),
    blockers: entries.filter((entry) => STALLED_BLOCKING_STATUSES.has(entry.status)),
  };
}

async function requireActivePromptArcadeRoomGame(ctx: MutationCtx, room: Doc<'rooms'>): Promise<void> {
  if (room.status === 'closed') promptArcadeFail('ROOM_CLOSED', 'This room is closed.');
  if (room.currentGameId === undefined) {
    promptArcadeFail('STALE_ROOM_GAME', 'Prompt Arcade is no longer the current room game.');
  }
  const roomGame = await ctx.db.get('roomGames', room.currentGameId);
  if (
    roomGame === null ||
    roomGame.roomId !== room._id ||
    roomGame.gameType !== 'promptArcade' ||
    roomGame.status !== 'active'
  ) {
    promptArcadeFail('STALE_ROOM_GAME', 'Prompt Arcade is no longer the current active room game.');
  }
}

function requireOwner(ownerGuestId: Id<'guestSessions'> | null, memberGuestId: Id<'guestSessions'>) {
  if (ownerGuestId !== memberGuestId) {
    promptArcadeFail('NOT_ROOM_OWNER', 'Only the room owner can perform this Prompt Arcade action.');
  }
}

function requirePromptArcadeGenerationConfiguration() {
  if (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_PROMPT_ARCADE_MODEL?.trim()) {
    promptArcadeFail(
      'PROMPT_ARCADE_NOT_CONFIGURED',
      'Prompt Arcade generation is not configured. Set OPENAI_API_KEY and OPENAI_PROMPT_ARCADE_MODEL first.'
    );
  }
}

export async function startPromptArcadeGame(ctx: MutationCtx, args: GameRequest) {
  const { room, membership } = await requirePromptArcadeMember(ctx, args.roomId, args.sessionToken, true);
  requireOwner(room.ownerGuestId, membership.guestId);
  if (room.status === 'closed') promptArcadeFail('ROOM_CLOSED', 'This room is closed.');
  requirePromptArcadeGenerationConfiguration();
  const state = await findPromptArcadeState(ctx, room._id);
  if (state === null) throw new Error('Prompt Arcade state is missing.');
  if (state.phase !== 'lobby') {
    promptArcadeFail('PROMPT_ARCADE_IN_PROGRESS', 'Prompt Arcade has already started.');
  }
  const [activeMembers, humanMembers] = await Promise.all([
    listActiveRoomMembers(ctx, room._id),
    listActiveHumanRoomMembers(ctx, room._id),
  ]);
  const members = activeMembers.sort((first, second) => first.joinedAt - second.joinedAt);
  if (humanMembers.length < 1) {
    promptArcadeFail('PROMPT_ARCADE_NO_PLAYERS', 'At least one active human player is required.');
  }
  if (members.length > PROMPT_ARCADE_MAX_PLAYERS) {
    promptArcadeFail(
      'PROMPT_ARCADE_TOO_MANY_PLAYERS',
      `Prompt Arcade supports at most ${PROMPT_ARCADE_MAX_PLAYERS} active players.`
    );
  }
  const now = Date.now();
  await activateCurrentRoomGame(ctx, room, 'promptArcade', now);
  const gameNumber = state.gameNumber + 1;
  for (const [order, member] of members.entries()) {
    await ctx.db.insert('promptArcadeEntries', {
      roomId: room._id,
      gameNumber,
      memberId: member._id,
      displayName: member.displayName,
      prompt: null,
      status: 'writing',
      order,
      attempt: 0,
      artifactId: null,
      errorMessage: null,
      submittedAt: null,
      readyAt: null,
      statusUpdatedAt: now,
    });
    await ctx.db.insert('promptArcadeScores', {
      roomId: room._id,
      gameNumber,
      memberId: member._id,
      displayName: member.displayName,
      totalScore: 0,
      roundsFinished: 0,
      updatedAt: now,
    });
  }
  await ctx.db.patch('promptArcadeGameStates', state._id, {
    gameNumber,
    phase: 'prompting',
    currentRoundId: null,
    currentRoundNumber: 0,
    playlistStarted: false,
    participantCount: members.length,
    phaseStartedAt: now,
    phaseEndsAt: null,
  });
  return { gameNumber, participantCount: members.length };
}

async function queueGeneration(
  ctx: MutationCtx,
  entry: NonNullable<Awaited<ReturnType<typeof findPromptArcadeEntry>>>,
  prompt: string,
  now: number
) {
  const attempt = entry.attempt + 1;
  await ctx.db.patch('promptArcadeEntries', entry._id, {
    prompt,
    status: 'queued',
    attempt,
    artifactId: null,
    errorMessage: null,
    submittedAt: now,
    readyAt: null,
    statusUpdatedAt: now,
  });
  await ctx.scheduler.runAfter(PROMPT_ARCADE_STALE_GENERATION_MS, internal.promptArcade.expireGenerationLease, {
    entryId: entry._id,
    gameNumber: entry.gameNumber,
    attempt,
  });
  return { entryId: entry._id, gameNumber: entry.gameNumber, attempt };
}

function normalizeSubmittedPrompt(rawPrompt: string) {
  try {
    return normalizePromptArcadePrompt(rawPrompt);
  } catch (error) {
    promptArcadeFail(
      'INVALID_PROMPT_ARCADE_PROMPT',
      error instanceof Error ? error.message : 'Describe the mini-game you want to create.'
    );
  }
}

async function queuePromptAndAdvancePhase(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  entry: Doc<'promptArcadeEntries'>,
  prompt: string,
  now: number
) {
  const result = await queueGeneration(ctx, entry, prompt, now);
  const entries = await listPromptArcadeEntries(ctx, entry.roomId, state.gameNumber);
  if (
    !state.playlistStarted &&
    entries.every((candidate) => candidate._id === entry._id || candidate.status !== 'writing')
  ) {
    await ctx.db.patch('promptArcadeGameStates', state._id, {
      phase: 'generating',
      phaseStartedAt: now,
      phaseEndsAt: null,
    });
  }
  return result;
}

export async function submitPromptArcadePrompt(ctx: MutationCtx, args: GameRequest & { prompt: string }) {
  const { room, membership } = await requirePromptArcadeMember(ctx, args.roomId, args.sessionToken, true);
  await requireActivePromptArcadeRoomGame(ctx, room);
  const state = await findPromptArcadeState(ctx, args.roomId);
  if (state === null || state.gameNumber === 0 || state.phase === 'lobby' || state.phase === 'complete') {
    promptArcadeFail('PROMPT_ARCADE_PROMPTS_CLOSED', 'Prompt submission is closed for this game.');
  }
  const entry = await findPromptArcadeEntry(ctx, args.roomId, state.gameNumber, membership._id);
  if (entry === null) promptArcadeFail('PROMPT_ARCADE_NOT_PARTICIPATING', 'You are not a prompt author in this game.');
  const now = Date.now();
  const staleGeneration =
    GENERATION_STATUSES.has(entry.status) && now - entry.statusUpdatedAt >= PROMPT_ARCADE_STALE_GENERATION_MS;
  if (entry.status !== 'writing' && entry.status !== 'needsRevision' && !staleGeneration) {
    promptArcadeFail('PROMPT_ARCADE_PROMPT_LOCKED', 'Your prompt is already being generated.');
  }
  return await queuePromptAndAdvancePhase(ctx, state, entry, normalizeSubmittedPrompt(args.prompt), now);
}

export async function queuePromptArcadeBotPrompt(
  ctx: MutationCtx,
  bot: Doc<'playtestBots'>,
  prompt: string,
  now: number
): Promise<null | { entryId: Id<'promptArcadeEntries'>; gameNumber: number; attempt: number }> {
  if (!bot.isActive) return null;
  const room = await ctx.db.get('rooms', bot.roomId);
  const membership = await ctx.db.get('roomMembers', bot.memberId);
  if (
    room === null ||
    membership === null ||
    membership.roomId !== room._id ||
    membership.memberKind !== 'playtestBot' ||
    !membership.isActive
  ) {
    return null;
  }
  await requireActivePromptArcadeRoomGame(ctx, room);
  const state = await findPromptArcadeState(ctx, room._id);
  if (
    state === null ||
    state.gameNumber === 0 ||
    state.phase === 'lobby' ||
    state.phase === 'complete' ||
    state.playlistStarted
  ) {
    return null;
  }
  const entry = await findPromptArcadeEntry(ctx, room._id, state.gameNumber, membership._id);
  if (entry === null || (entry.status !== 'writing' && entry.status !== 'needsRevision')) return null;
  const lease = await queuePromptAndAdvancePhase(ctx, state, entry, normalizeSubmittedPrompt(prompt), now);
  const scheduledId: Id<'_scheduled_functions'> = await ctx.scheduler.runAfter(
    0,
    internal.promptArcadeActions.generateBotPrompt,
    lease
  );
  void scheduledId;
  return lease;
}

export async function retryPromptArcadeGeneration(ctx: MutationCtx, args: GameRequest) {
  const { room, membership } = await requirePromptArcadeMember(ctx, args.roomId, args.sessionToken, true);
  await requireActivePromptArcadeRoomGame(ctx, room);
  const state = await findPromptArcadeState(ctx, args.roomId);
  if (state === null || state.gameNumber === 0 || state.phase === 'complete') {
    promptArcadeFail('PROMPT_ARCADE_PROMPTS_CLOSED', 'There is no active generation to retry.');
  }
  const entry = await findPromptArcadeEntry(ctx, args.roomId, state.gameNumber, membership._id);
  if (entry === null || entry.prompt === null) {
    promptArcadeFail('PROMPT_ARCADE_NOT_PARTICIPATING', 'Submit a prompt before retrying generation.');
  }
  const now = Date.now();
  if (!GENERATION_STATUSES.has(entry.status) || now - entry.statusUpdatedAt < PROMPT_ARCADE_STALE_GENERATION_MS) {
    promptArcadeFail('PROMPT_ARCADE_GENERATION_ACTIVE', 'Generation is still active. Try again if it remains stuck.');
  }
  return await queueGeneration(ctx, entry, entry.prompt, now);
}

export async function startPromptArcadePlaylist(ctx: MutationCtx, args: GameRequest): Promise<null> {
  const { room, membership } = await requirePromptArcadeMember(ctx, args.roomId, args.sessionToken, true);
  requireOwner(room.ownerGuestId, membership.guestId);
  await requireActivePromptArcadeRoomGame(ctx, room);
  const state = await findPromptArcadeState(ctx, args.roomId);
  if (state === null || state.gameNumber === 0) throw new Error('Prompt Arcade state is missing.');
  if (state.playlistStarted || state.currentRoundId !== null || state.phase === 'complete') {
    promptArcadeFail('PROMPT_ARCADE_IN_PROGRESS', 'The Prompt Arcade playlist has already started.');
  }
  const entries = await withdrawInactiveUnusablePromptEntries(
    ctx,
    await listPromptArcadeEntries(ctx, args.roomId, state.gameNumber),
    Date.now()
  );
  const readyCount = entries.filter((entry) => entry.status === 'ready').length;
  if (readyCount === 0) {
    promptArcadeFail(
      'PROMPT_ARCADE_NOT_READY',
      'Wait until at least one generated game is ready before starting early.'
    );
  }
  const now = Date.now();
  if (!(await startReadyPromptArcadePlaylist(ctx, state, now, false))) {
    throw new Error('A ready Prompt Arcade round could not be started.');
  }
  return null;
}

export async function finishStalledPromptArcadePlaylist(ctx: MutationCtx, args: GameRequest): Promise<null> {
  const { room, membership } = await requirePromptArcadeMember(ctx, args.roomId, args.sessionToken, true);
  requireOwner(room.ownerGuestId, membership.guestId);
  await requireActivePromptArcadeRoomGame(ctx, room);
  const state = await findPromptArcadeState(ctx, args.roomId);
  if (state === null || !state.playlistStarted || state.currentRoundId !== null || state.phase !== 'generating') {
    promptArcadeFail(
      'PROMPT_ARCADE_NOT_STALLED',
      'The playlist can only be finished while it is waiting between generated games.'
    );
  }
  const entries = await listPromptArcadeEntries(ctx, args.roomId, state.gameNumber);
  const { unresolved, blockers } = analyzeStalledPromptArcadeEntries(entries);
  if (unresolved.length === 0 || blockers.length > 0) {
    promptArcadeFail(
      'PROMPT_ARCADE_NOT_STALLED',
      blockers.length > 0
        ? 'A generated game or generation job is still available. Wait for it to finish.'
        : 'There are no unresolved prompts to withdraw.'
    );
  }
  const now = Date.now();
  for (const entry of unresolved) {
    await ctx.db.patch('promptArcadeEntries', entry._id, {
      status: 'withdrawn',
      errorMessage: 'The room owner ended this unresolved prompt so the stalled playlist could finish.',
      readyAt: null,
      statusUpdatedAt: now,
    });
  }
  await settleIdlePromptArcadePlaylist(ctx, state, now);
  return null;
}

export async function submitPromptArcadeResult(
  ctx: MutationCtx,
  args: GameRequest & {
    roundId: Id<'promptArcadeRounds'>;
    quality: number;
    metricLabel?: string;
    metricValue?: number;
  }
) {
  const { room, membership } = await requirePromptArcadeMember(ctx, args.roomId, args.sessionToken, true);
  await requireActivePromptArcadeRoomGame(ctx, room);
  const state = await findPromptArcadeState(ctx, args.roomId);
  if (state === null || state.currentRoundId === null || state.currentRoundId !== args.roundId) {
    promptArcadeFail('PROMPT_ARCADE_STALE_ROUND', 'That result belongs to an earlier Prompt Arcade round.');
  }
  const round = await ctx.db.get('promptArcadeRounds', state.currentRoundId);
  if (round === null) throw new Error('The current Prompt Arcade round is missing.');
  const result = await ctx.db
    .query('promptArcadeResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', membership._id))
    .unique();
  if (result === null) promptArcadeFail('PROMPT_ARCADE_NOT_PARTICIPATING', 'You joined after this round began.');
  if (result.status === 'finished') {
    return { score: result.score, elapsedMs: result.elapsedMs ?? 0 };
  }
  if (state.phase !== 'playing' || round.status !== 'playing') {
    promptArcadeFail('PROMPT_ARCADE_NOT_RUNNING', 'This Prompt Arcade round is not accepting results.');
  }
  const now = Date.now();
  if (now > round.playEndsAt) {
    promptArcadeFail('PROMPT_ARCADE_NOT_RUNNING', 'This Prompt Arcade round has ended.');
  }
  if (result.status !== 'waiting') {
    promptArcadeFail('PROMPT_ARCADE_ALREADY_SUBMITTED', 'Your result for this round is already recorded.');
  }
  return await recordPromptArcadeResult(
    ctx,
    state,
    round,
    result,
    args.quality,
    args.metricLabel,
    args.metricValue,
    now
  );
}
