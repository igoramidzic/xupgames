import type { Doc, Id } from '../../_generated/dataModel';
import type { QueryCtx } from '../../_generated/server';
import { PROMPT_ARCADE_MAX_PLAYERS, PROMPT_ARCADE_STALE_GENERATION_MS } from './engine';
import { findPromptArcadeState, listPromptArcadeEntries, requirePromptArcadeMember } from './state';

const GENERATION_STATUSES = new Set(['queued', 'generating', 'validating', 'repairing']);

export async function getPromptArcadeGame(ctx: QueryCtx, args: { roomId: Id<'rooms'>; sessionToken: string }) {
  const { room, membership } = await requirePromptArcadeMember(ctx, args.roomId, args.sessionToken, false);
  const state = await findPromptArcadeState(ctx, args.roomId);
  if (state === null) throw new Error('Prompt Arcade state is missing.');
  const entries = await listPromptArcadeEntries(ctx, args.roomId, state.gameNumber);
  const artifacts = await Promise.all(
    entries.map(async (entry) =>
      entry.artifactId === null ? null : await ctx.db.get('promptArcadeArtifacts', entry.artifactId)
    )
  );
  const artifactById = new Map(artifacts.flatMap((artifact) => (artifact === null ? [] : [[artifact._id, artifact]])));
  const members = await Promise.all(entries.map(async (entry) => await ctx.db.get('roomMembers', entry.memberId)));
  const activeByMemberId = new Map(members.map((member) => [member?._id, member?.isActive ?? false]));
  const summary = {
    total: entries.length,
    writing: 0,
    queued: 0,
    generating: 0,
    validating: 0,
    repairing: 0,
    ready: 0,
    needsRevision: 0,
    withdrawn: 0,
    played: 0,
  };
  for (const entry of entries) summary[entry.status] += 1;
  const entryViews = entries.map((entry) => ({
    entryId: entry._id,
    memberId: entry.memberId,
    displayName: entry.displayName,
    prompt: entry.prompt,
    status: entry.status,
    order: entry.order,
    attempt: entry.attempt,
    errorMessage: entry.errorMessage,
    submittedAt: entry.submittedAt,
    readyAt: entry.readyAt,
    statusUpdatedAt: entry.statusUpdatedAt,
    retryAvailableAt: GENERATION_STATUSES.has(entry.status)
      ? entry.statusUpdatedAt + PROMPT_ARCADE_STALE_GENERATION_MS
      : null,
    artifactTitle: entry.artifactId === null ? null : (artifactById.get(entry.artifactId)?.title ?? null),
    isCurrentPlayer: entry.memberId === membership._id,
    isActive: activeByMemberId.get(entry.memberId) ?? false,
  }));

  const round = state.currentRoundId === null ? null : await ctx.db.get('promptArcadeRounds', state.currentRoundId);
  const roundEntry = round === null ? null : await ctx.db.get('promptArcadeEntries', round.entryId);
  const roundArtifact = round === null ? null : await ctx.db.get('promptArcadeArtifacts', round.artifactId);
  const codeUrl = roundArtifact === null ? null : await ctx.storage.getUrl(roundArtifact.codeStorageId);
  let results: Doc<'promptArcadeResults'>[] = [];
  if (round !== null) {
    results = await ctx.db
      .query('promptArcadeResults')
      .withIndex('by_roundId', (index) => index.eq('roundId', round._id))
      .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
    if (results.length > PROMPT_ARCADE_MAX_PLAYERS) {
      throw new Error('Prompt Arcade round capacity invariant violated.');
    }
  }
  const resultViews = results
    .map((result) => ({
      memberId: result.memberId,
      displayName: result.displayName,
      status: result.status,
      quality: result.quality,
      elapsedMs: result.elapsedMs,
      score: result.score,
      metricLabel: result.metricLabel,
      metricValue: result.metricValue,
      isCurrentPlayer: result.memberId === membership._id,
      isActive: activeByMemberId.get(result.memberId) ?? true,
    }))
    .sort(
      (first, second) =>
        second.score - first.score ||
        (first.elapsedMs ?? Number.POSITIVE_INFINITY) - (second.elapsedMs ?? Number.POSITIVE_INFINITY)
    );
  const scores = await ctx.db
    .query('promptArcadeScores')
    .withIndex('by_roomId_and_gameNumber', (index) =>
      index.eq('roomId', args.roomId).eq('gameNumber', state.gameNumber)
    )
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (scores.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade score capacity invariant violated.');
  }
  const standings = scores
    .map((score) => ({
      memberId: score.memberId,
      displayName: score.displayName,
      totalScore: score.totalScore,
      roundsFinished: score.roundsFinished,
      isCurrentPlayer: score.memberId === membership._id,
      isActive: activeByMemberId.get(score.memberId) ?? false,
    }))
    .sort(
      (first, second) => second.totalScore - first.totalScore || first.displayName.localeCompare(second.displayName)
    )
    .map((standing, index) => ({ ...standing, rank: index + 1 }));

  const eligibleEntryCount = entries.filter((entry) => {
    if (entry.status === 'withdrawn') return false;
    if (entry.status !== 'writing' && entry.status !== 'needsRevision') return true;
    return activeByMemberId.get(entry.memberId) ?? false;
  }).length;
  const requiredReadyCount = eligibleEntryCount;
  return {
    gameNumber: state.gameNumber,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt,
    currentRoundNumber: state.currentRoundNumber,
    participantCount: entries.length,
    requiredReadyCount,
    playlistStarted: state.playlistStarted,
    isOwner: room.ownerGuestId === membership.guestId,
    canStartPlaylist:
      !state.playlistStarted && state.phase !== 'lobby' && state.phase !== 'complete' && summary.ready > 0,
    summary,
    entries: entryViews,
    round:
      round === null || roundEntry === null || roundEntry.prompt === null || roundArtifact === null
        ? null
        : {
            roundId: round._id,
            roundNumber: round.roundNumber,
            status: round.status,
            countdownStartedAt: round.countdownStartedAt,
            playStartsAt: round.playStartsAt,
            playEndsAt: round.playEndsAt,
            resultsStartedAt: round.resultsStartedAt,
            entry: {
              entryId: roundEntry._id,
              memberId: roundEntry.memberId,
              displayName: roundEntry.displayName,
              prompt: roundEntry.prompt,
            },
            artifact: {
              artifactId: roundArtifact._id,
              title: roundArtifact.title,
              interpretation: roundArtifact.interpretation,
              instructions: roundArtifact.instructions,
              durationMs: roundArtifact.durationMs,
              scoringMode: roundArtifact.scoringMode,
              codeUrl,
            },
          },
    currentResult: resultViews.find((result) => result.isCurrentPlayer) ?? null,
    roundResults: resultViews,
    standings,
  };
}
