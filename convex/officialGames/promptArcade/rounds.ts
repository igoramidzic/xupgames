import { internal } from '../../_generated/api';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx } from '../../_generated/server';
import { completeCurrentRoomGame } from '../../roomGames';
import {
  normalizeMetricLabel,
  normalizeMetricValue,
  PROMPT_ARCADE_ARTIFACT_GRACE_MS,
  PROMPT_ARCADE_COUNTDOWN_MS,
  PROMPT_ARCADE_MAX_PLAYERS,
  PROMPT_ARCADE_RATING_MS,
  scorePromptArcadeResult,
} from './engine';
import { applyPromptArcadeCreatorBonuses } from './ratings';
import { listPromptArcadeEntries, withdrawInactiveUnusablePromptEntries } from './state';

type RoundScheduleArgs = {
  stateId: Id<'promptArcadeGameStates'>;
  gameNumber: number;
  roundNumber: number;
};

export function analyzePromptArcadePlaylistReadiness<TEntry extends { status: string }>(entries: readonly TEntry[]) {
  const eligibleEntries = entries.filter((entry) => entry.status !== 'withdrawn');
  const readyCount = eligibleEntries.filter((entry) => entry.status === 'ready').length;
  return {
    eligibleCount: eligibleEntries.length,
    readyCount,
    allReady: eligibleEntries.length > 0 && readyCount === eligibleEntries.length,
  };
}

export async function startReadyPromptArcadePlaylist(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  now: number,
  requireAllReady: boolean
): Promise<boolean> {
  if (state.playlistStarted || state.currentRoundId !== null || state.phase === 'complete') return false;
  const entries = await withdrawInactiveUnusablePromptEntries(
    ctx,
    await listPromptArcadeEntries(ctx, state.roomId, state.gameNumber),
    now
  );
  const readiness = analyzePromptArcadePlaylistReadiness(entries);
  if (readiness.readyCount === 0 || (requireAllReady && !readiness.allReady)) return false;

  const startedState = { ...state, playlistStarted: true };
  await ctx.db.patch('promptArcadeGameStates', state._id, { playlistStarted: true });
  if (!(await createNextPromptArcadeRound(ctx, startedState, now))) {
    throw new Error('A ready Prompt Arcade round could not be started.');
  }
  return true;
}

async function insertRoundResults(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  round: Doc<'promptArcadeRounds'>
) {
  const entries = await listPromptArcadeEntries(ctx, state.roomId, state.gameNumber);
  for (const entry of entries) {
    const member = await ctx.db.get('roomMembers', entry.memberId);
    if (member === null || !member.isActive) continue;
    await ctx.db.insert('promptArcadeResults', {
      roomId: state.roomId,
      gameNumber: state.gameNumber,
      roundNumber: round.roundNumber,
      roundId: round._id,
      memberId: entry.memberId,
      displayName: member.displayName,
      status: 'waiting',
      startedAt: round.playStartsAt,
      finishedAt: null,
      elapsedMs: null,
      quality: null,
      score: 0,
      metricLabel: null,
      metricValue: null,
    });
  }
}

export async function createNextPromptArcadeRound(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  now: number
): Promise<boolean> {
  if (!state.playlistStarted || state.currentRoundId !== null || state.phase === 'complete') return false;
  const entries = await listPromptArcadeEntries(ctx, state.roomId, state.gameNumber);
  const entry = entries.find((candidate) => candidate.status === 'ready' && candidate.artifactId !== null);
  if (entry?.artifactId === null || entry === undefined) return false;
  const artifact = await ctx.db.get('promptArcadeArtifacts', entry.artifactId);
  if (artifact === null || artifact.entryId !== entry._id || artifact.gameNumber !== state.gameNumber) {
    throw new Error('A ready Prompt Arcade artifact is missing.');
  }
  const roundNumber = state.currentRoundNumber + 1;
  const playStartsAt = now + PROMPT_ARCADE_COUNTDOWN_MS;
  const roundId = await ctx.db.insert('promptArcadeRounds', {
    roomId: state.roomId,
    gameNumber: state.gameNumber,
    roundNumber,
    entryId: entry._id,
    artifactId: artifact._id,
    status: 'countdown',
    countdownStartedAt: now,
    playStartsAt,
    playEndsAt: playStartsAt + artifact.durationMs,
    resultsStartedAt: null,
  });
  const round = await ctx.db.get('promptArcadeRounds', roundId);
  if (round === null) throw new Error('Prompt Arcade round creation failed.');
  await insertRoundResults(ctx, state, round);
  await ctx.db.patch('promptArcadeGameStates', state._id, {
    phase: 'countdown',
    currentRoundId: round._id,
    currentRoundNumber: roundNumber,
    phaseStartedAt: now,
    phaseEndsAt: playStartsAt,
  });
  await ctx.scheduler.runAfter(PROMPT_ARCADE_COUNTDOWN_MS, internal.promptArcade.beginRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber,
  });
  return true;
}

export async function beginPromptArcadeRound(ctx: MutationCtx, args: RoundScheduleArgs): Promise<null> {
  const state = await ctx.db.get('promptArcadeGameStates', args.stateId);
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.currentRoundNumber !== args.roundNumber ||
    state.currentRoundId === null ||
    state.phase !== 'countdown'
  ) {
    return null;
  }
  const round = await ctx.db.get('promptArcadeRounds', state.currentRoundId);
  if (round === null || round.roundNumber !== args.roundNumber || round.status !== 'countdown') return null;
  const artifact = await ctx.db.get('promptArcadeArtifacts', round.artifactId);
  if (artifact === null || artifact.gameNumber !== state.gameNumber) return null;
  const now = Date.now();
  const playEndsAt = now + artifact.durationMs;
  await ctx.db.patch('promptArcadeRounds', round._id, {
    status: 'playing',
    playStartsAt: now,
    playEndsAt,
  });
  const results = await ctx.db
    .query('promptArcadeResults')
    .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (results.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade round capacity invariant violated.');
  }
  for (const result of results) {
    if (result.status === 'waiting') await ctx.db.patch('promptArcadeResults', result._id, { startedAt: now });
  }
  await ctx.db.patch('promptArcadeGameStates', state._id, {
    phase: 'playing',
    phaseStartedAt: now,
    phaseEndsAt: playEndsAt,
  });
  await ctx.scheduler.runAfter(artifact.durationMs, internal.promptArcade.finalizeRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber: round.roundNumber,
  });
  return null;
}

async function incrementFinishedRound(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  memberId: Id<'roomMembers'>,
  score: number,
  now: number
) {
  const standing = await ctx.db
    .query('promptArcadeScores')
    .withIndex('by_roomId_and_gameNumber_and_memberId', (index) =>
      index.eq('roomId', state.roomId).eq('gameNumber', state.gameNumber).eq('memberId', memberId)
    )
    .unique();
  if (standing === null) return;
  await ctx.db.patch('promptArcadeScores', standing._id, {
    totalScore: standing.totalScore + score,
    roundsFinished: standing.roundsFinished + 1,
    updatedAt: now,
  });
}

export async function showPromptArcadeRoundResults(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  round: Doc<'promptArcadeRounds'>,
  now: number
) {
  if (state.phase === 'roundResults' || state.phase === 'complete' || round.status === 'results') return;
  const results = await ctx.db
    .query('promptArcadeResults')
    .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (results.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade round capacity invariant violated.');
  }
  for (const result of results) {
    if (result.status !== 'waiting') continue;
    await ctx.db.patch('promptArcadeResults', result._id, {
      status: 'timedOut',
      finishedAt: now,
      elapsedMs: Math.max(0, round.playEndsAt - round.playStartsAt),
    });
    await incrementFinishedRound(ctx, state, result.memberId, 0, now);
  }
  await ctx.db.patch('promptArcadeRounds', round._id, { status: 'results', resultsStartedAt: now });
  await ctx.db.patch('promptArcadeGameStates', state._id, {
    phase: 'roundResults',
    phaseStartedAt: now,
    phaseEndsAt: now + PROMPT_ARCADE_RATING_MS,
  });
  await ctx.scheduler.runAfter(PROMPT_ARCADE_RATING_MS, internal.promptArcade.advanceRound, {
    stateId: state._id,
    gameNumber: state.gameNumber,
    roundNumber: round.roundNumber,
  });
}

export async function finalizePromptArcadeRound(ctx: MutationCtx, args: RoundScheduleArgs): Promise<null> {
  const state = await ctx.db.get('promptArcadeGameStates', args.stateId);
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.currentRoundNumber !== args.roundNumber ||
    state.currentRoundId === null ||
    (state.phase !== 'countdown' && state.phase !== 'playing')
  ) {
    return null;
  }
  const round = await ctx.db.get('promptArcadeRounds', state.currentRoundId);
  if (round === null || round.roundNumber !== args.roundNumber) return null;
  await showPromptArcadeRoundResults(ctx, state, round, Date.now());
  return null;
}

export async function recordPromptArcadeResult(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  round: Doc<'promptArcadeRounds'>,
  result: Doc<'promptArcadeResults'>,
  qualityInput: number,
  metricLabel: string | undefined,
  metricValue: number | undefined,
  now: number
) {
  const artifact = await ctx.db.get('promptArcadeArtifacts', round.artifactId);
  if (artifact === null) throw new Error('The Prompt Arcade artifact is missing.');
  const scored = scorePromptArcadeResult(
    artifact.scoringMode,
    qualityInput,
    now - round.playStartsAt,
    artifact.durationMs
  );
  await ctx.db.patch('promptArcadeResults', result._id, {
    status: 'finished',
    finishedAt: now,
    elapsedMs: scored.elapsedMs,
    quality: scored.quality,
    score: scored.score,
    metricLabel: normalizeMetricLabel(metricLabel),
    metricValue: normalizeMetricValue(metricValue),
  });
  await incrementFinishedRound(ctx, state, result.memberId, scored.score, now);
  const results = await ctx.db
    .query('promptArcadeResults')
    .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (results.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade round capacity invariant violated.');
  }
  if (results.every((candidate) => candidate._id === result._id || candidate.status !== 'waiting')) {
    await showPromptArcadeRoundResults(ctx, state, round, now);
  }
  return { score: scored.score, elapsedMs: scored.elapsedMs };
}

export async function settleIdlePromptArcadePlaylist(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  now: number
): Promise<void> {
  if (!state.playlistStarted || state.currentRoundId !== null || state.phase === 'complete') return;
  if (await createNextPromptArcadeRound(ctx, state, now)) return;
  const entries = await withdrawInactiveUnusablePromptEntries(
    ctx,
    await listPromptArcadeEntries(ctx, state.roomId, state.gameNumber),
    now
  );
  const allTerminal =
    entries.length > 0 &&
    entries.every((candidate) => candidate.status === 'played' || candidate.status === 'withdrawn');
  if (allTerminal) {
    await applyPromptArcadeCreatorBonuses(ctx, state, now);
    await ctx.db.patch('promptArcadeGameStates', state._id, {
      phase: 'complete',
      phaseStartedAt: now,
      phaseEndsAt: null,
    });
    const room = await ctx.db.get('rooms', state.roomId);
    if (room !== null) await completeCurrentRoomGame(ctx, room, 'promptArcade', now);
    await ctx.scheduler.runAfter(PROMPT_ARCADE_ARTIFACT_GRACE_MS, internal.promptArcade.cleanupArtifacts, {
      roomId: state.roomId,
      gameNumber: state.gameNumber,
    });
    return;
  }
  await ctx.db.patch('promptArcadeGameStates', state._id, {
    phase: 'generating',
    phaseStartedAt: now,
    phaseEndsAt: null,
  });
}

export async function cleanupPromptArcadeArtifacts(
  ctx: MutationCtx,
  args: { roomId: Id<'rooms'>; gameNumber: number }
): Promise<null> {
  const entries = await ctx.db
    .query('promptArcadeEntries')
    .withIndex('by_roomId_and_gameNumber', (index) => index.eq('roomId', args.roomId).eq('gameNumber', args.gameNumber))
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (entries.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade participant capacity invariant violated.');
  }
  if (entries.length === 0 || entries.some((entry) => entry.status !== 'played' && entry.status !== 'withdrawn')) {
    return null;
  }
  const artifacts = await ctx.db
    .query('promptArcadeArtifacts')
    .withIndex('by_roomId_and_gameNumber', (index) => index.eq('roomId', args.roomId).eq('gameNumber', args.gameNumber))
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (artifacts.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade artifact capacity invariant violated.');
  }
  for (const artifact of artifacts) await ctx.storage.delete(artifact.codeStorageId);
  return null;
}

export async function advancePromptArcadeRound(ctx: MutationCtx, args: RoundScheduleArgs): Promise<null> {
  const state = await ctx.db.get('promptArcadeGameStates', args.stateId);
  if (
    state === null ||
    state.gameNumber !== args.gameNumber ||
    state.currentRoundNumber !== args.roundNumber ||
    state.currentRoundId === null ||
    state.phase !== 'roundResults'
  ) {
    return null;
  }
  const round = await ctx.db.get('promptArcadeRounds', state.currentRoundId);
  if (round === null || round.roundNumber !== args.roundNumber || round.status !== 'results') return null;
  const entry = await ctx.db.get('promptArcadeEntries', round.entryId);
  if (entry !== null && entry.gameNumber === state.gameNumber) {
    await ctx.db.patch('promptArcadeEntries', entry._id, { status: 'played', statusUpdatedAt: Date.now() });
  }
  const now = Date.now();
  const clearedState = { ...state, currentRoundId: null };
  await ctx.db.patch('promptArcadeGameStates', state._id, { currentRoundId: null });
  await settleIdlePromptArcadePlaylist(ctx, clearedState, now);
  return null;
}
