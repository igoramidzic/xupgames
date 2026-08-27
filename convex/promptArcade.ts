import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import {
  finishStalledPromptArcadePlaylist,
  retryPromptArcadeGeneration,
  startPromptArcadeGame,
  startPromptArcadePlaylist,
  submitPromptArcadePrompt,
  submitPromptArcadeResult,
} from './officialGames/promptArcade/game';
import {
  beginPromptArcadeGeneration,
  commitPromptArcadeArtifact,
  expirePromptArcadeGenerationLease,
  markPromptArcadeGenerationFailed,
  setPromptArcadeGenerationStatus,
} from './officialGames/promptArcade/generation';
import {
  advancePromptArcadeRound,
  beginPromptArcadeRound,
  cleanupPromptArcadeArtifacts,
  finalizePromptArcadeRound,
} from './officialGames/promptArcade/rounds';
import {
  promptArcadeGameViewValidator,
  promptArcadeScoringModeValidator,
} from './officialGames/promptArcade/validators';
import { getPromptArcadeGame } from './officialGames/promptArcade/view';

const gameRequestArgs = { roomId: v.id('rooms'), sessionToken: v.string() };
const queuedGenerationResultValidator = v.object({
  entryId: v.id('promptArcadeEntries'),
  gameNumber: v.number(),
  attempt: v.number(),
});

export const getGame = query({
  args: gameRequestArgs,
  returns: promptArcadeGameViewValidator,
  handler: getPromptArcadeGame,
});

export const startGame = mutation({
  args: gameRequestArgs,
  returns: v.object({ gameNumber: v.number(), participantCount: v.number() }),
  handler: startPromptArcadeGame,
});

export const queuePrompt = internalMutation({
  args: { ...gameRequestArgs, prompt: v.string() },
  returns: queuedGenerationResultValidator,
  handler: submitPromptArcadePrompt,
});

export const queueRetry = internalMutation({
  args: gameRequestArgs,
  returns: queuedGenerationResultValidator,
  handler: retryPromptArcadeGeneration,
});

export const startPlaylist = mutation({
  args: gameRequestArgs,
  returns: v.null(),
  handler: startPromptArcadePlaylist,
});

export const finishStalledPlaylist = mutation({
  args: gameRequestArgs,
  returns: v.null(),
  handler: finishStalledPromptArcadePlaylist,
});

export const submitResult = mutation({
  args: {
    ...gameRequestArgs,
    roundId: v.id('promptArcadeRounds'),
    quality: v.number(),
    metricLabel: v.optional(v.string()),
    metricValue: v.optional(v.number()),
  },
  returns: v.object({ score: v.number(), elapsedMs: v.number() }),
  handler: submitPromptArcadeResult,
});

const generationLeaseArgs = {
  entryId: v.id('promptArcadeEntries'),
  gameNumber: v.number(),
  attempt: v.number(),
};

export const beginGeneration = internalMutation({
  args: generationLeaseArgs,
  returns: v.union(
    v.null(),
    v.object({
      entryId: v.id('promptArcadeEntries'),
      roomId: v.id('rooms'),
      memberId: v.id('roomMembers'),
      gameNumber: v.number(),
      attempt: v.number(),
      prompt: v.string(),
    })
  ),
  handler: beginPromptArcadeGeneration,
});

export const setGenerationStatus = internalMutation({
  args: {
    ...generationLeaseArgs,
    status: v.union(v.literal('validating'), v.literal('repairing')),
  },
  returns: v.boolean(),
  handler: setPromptArcadeGenerationStatus,
});

export const markGenerationFailed = internalMutation({
  args: { ...generationLeaseArgs, errorMessage: v.string() },
  returns: v.boolean(),
  handler: markPromptArcadeGenerationFailed,
});

export const expireGenerationLease = internalMutation({
  args: generationLeaseArgs,
  returns: v.null(),
  handler: expirePromptArcadeGenerationLease,
});

export const commitArtifact = internalMutation({
  args: {
    ...generationLeaseArgs,
    title: v.string(),
    interpretation: v.string(),
    instructions: v.string(),
    durationMs: v.number(),
    scoringMode: promptArcadeScoringModeValidator,
    codeStorageId: v.id('_storage'),
    codeSha256: v.string(),
    model: v.string(),
  },
  returns: v.boolean(),
  handler: commitPromptArcadeArtifact,
});

const roundScheduleArgs = {
  stateId: v.id('promptArcadeGameStates'),
  gameNumber: v.number(),
  roundNumber: v.number(),
};

export const beginRound = internalMutation({
  args: roundScheduleArgs,
  returns: v.null(),
  handler: beginPromptArcadeRound,
});

export const finalizeRound = internalMutation({
  args: roundScheduleArgs,
  returns: v.null(),
  handler: finalizePromptArcadeRound,
});

export const advanceRound = internalMutation({
  args: roundScheduleArgs,
  returns: v.null(),
  handler: advancePromptArcadeRound,
});

export const cleanupArtifacts = internalMutation({
  args: { roomId: v.id('rooms'), gameNumber: v.number() },
  returns: v.null(),
  handler: cleanupPromptArcadeArtifacts,
});
