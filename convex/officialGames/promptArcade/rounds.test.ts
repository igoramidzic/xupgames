import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzePromptArcadePlaylistReadiness, beginPromptArcadeRound, createNextPromptArcadeRound } from './rounds';

describe('Prompt Arcade playlist readiness', () => {
  it('requires every non-withdrawn player game for automatic start', () => {
    expect(
      analyzePromptArcadePlaylistReadiness([{ status: 'ready' }, { status: 'generating' }, { status: 'withdrawn' }])
    ).toEqual({ eligibleCount: 2, readyCount: 1, allReady: false });
    expect(
      analyzePromptArcadePlaylistReadiness([{ status: 'ready' }, { status: 'ready' }, { status: 'withdrawn' }])
    ).toEqual({ eligibleCount: 2, readyCount: 2, allReady: true });
  });
});

describe('Prompt Arcade scheduled round transitions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts the full play duration from the actual scheduled begin time', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const patch = vi.fn(async () => undefined);
    const runAfter = vi.fn(async () => 'scheduled-finalize');
    const index = { eq: vi.fn(() => index) };
    const ctx = {
      db: {
        get: vi.fn(async (table: string) => {
          if (table === 'promptArcadeGameStates') {
            return {
              _id: 'state-1',
              gameNumber: 4,
              currentRoundNumber: 2,
              currentRoundId: 'round-2',
              phase: 'countdown',
            };
          }
          if (table === 'promptArcadeRounds') {
            return {
              _id: 'round-2',
              roundNumber: 2,
              status: 'countdown',
              artifactId: 'artifact-2',
            };
          }
          if (table === 'promptArcadeArtifacts') return { gameNumber: 4, durationMs: 20_000 };
          return null;
        }),
        patch,
        query: vi.fn(() => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return { take: vi.fn(async () => [{ _id: 'result-1', status: 'waiting' }]) };
          }),
        })),
      },
      scheduler: { runAfter },
    };

    await beginPromptArcadeRound(ctx as never, {
      stateId: 'state-1' as never,
      gameNumber: 4,
      roundNumber: 2,
    });

    expect(patch).toHaveBeenCalledWith(
      'promptArcadeRounds',
      'round-2',
      expect.objectContaining({ status: 'playing', playStartsAt: 10_000, playEndsAt: 30_000 })
    );
    expect(patch).toHaveBeenCalledWith(
      'promptArcadeResults',
      'result-1',
      expect.objectContaining({ startedAt: 10_000 })
    );
    expect(runAfter).toHaveBeenCalledWith(
      20_000,
      'internal.promptArcade.finalizeRound',
      expect.objectContaining({ gameNumber: 4, roundNumber: 2 })
    );
  });

  it('creates round results for active Prompt Arcade playtest bots', async () => {
    const entry = {
      _id: 'entry-bot-1',
      roomId: 'room-1',
      gameNumber: 2,
      memberId: 'member-bot-1',
      displayName: 'Bot 01',
      status: 'ready',
      artifactId: 'artifact-1',
      order: 0,
    };
    const artifact = {
      _id: 'artifact-1',
      entryId: entry._id,
      gameNumber: 2,
      durationMs: 20_000,
    };
    const state = {
      _id: 'state-1',
      roomId: 'room-1',
      gameNumber: 2,
      phase: 'generating',
      playlistStarted: true,
      currentRoundId: null,
      currentRoundNumber: 0,
    };
    let round: Record<string, unknown> | null = null;
    const index = { eq: vi.fn(() => index) };
    const insert = vi.fn(async (table: string, value: Record<string, unknown>) => {
      if (table === 'promptArcadeRounds') {
        round = { _id: 'round-1', ...value };
        return 'round-1';
      }
      return 'result-1';
    });
    const ctx = {
      db: {
        get: vi.fn(async (table: string) => {
          if (table === 'promptArcadeArtifacts') return artifact;
          if (table === 'promptArcadeRounds') return round;
          if (table === 'roomMembers') {
            return {
              _id: 'member-bot-1',
              displayName: 'Bot 01',
              isActive: true,
              memberKind: 'playtestBot',
            };
          }
          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return { take: vi.fn(async () => (table === 'promptArcadeEntries' ? [entry] : [])) };
          }),
        })),
        insert,
        patch: vi.fn(async () => undefined),
      },
      scheduler: { runAfter: vi.fn(async () => 'scheduled-begin') },
    };

    await expect(createNextPromptArcadeRound(ctx as never, state as never, 10_000)).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith(
      'promptArcadeResults',
      expect.objectContaining({
        memberId: 'member-bot-1',
        displayName: 'Bot 01',
        status: 'waiting',
      })
    );
  });
});
