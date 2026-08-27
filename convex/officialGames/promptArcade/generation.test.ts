import { describe, expect, it, vi } from 'vitest';
import { beginPromptArcadeGeneration, commitPromptArcadeArtifact, setPromptArcadeGenerationStatus } from './generation';

describe('Prompt Arcade generation leases', () => {
  it('ignores a stale status update from an earlier attempt', async () => {
    const patch = vi.fn(async () => undefined);
    const ctx = { db: { get: vi.fn(async () => ({ gameNumber: 2, attempt: 3, status: 'generating' })), patch } };
    await expect(
      setPromptArcadeGenerationStatus(ctx as never, {
        entryId: 'entry-1' as never,
        gameNumber: 2,
        attempt: 2,
        status: 'validating',
      })
    ).resolves.toBe(false);
    expect(patch).not.toHaveBeenCalled();
  });

  it('rejects a stale artifact commit before inserting database state', async () => {
    const insert = vi.fn(async () => 'artifact-1');
    const patch = vi.fn(async () => undefined);
    const ctx = {
      db: {
        get: vi.fn(async () => ({ gameNumber: 7, attempt: 4, status: 'validating' })),
        insert,
        patch,
      },
    };
    await expect(
      commitPromptArcadeArtifact(ctx as never, {
        entryId: 'entry-1' as never,
        gameNumber: 7,
        attempt: 3,
        title: 'Game',
        interpretation: 'Interpretation',
        instructions: 'Instructions',
        durationMs: 20_000,
        scoringMode: 'quality',
        codeStorageId: 'storage-1' as never,
        codeSha256: 'hash',
        model: 'model',
      })
    ).resolves.toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('does not begin provider work after the room closes', async () => {
    const patch = vi.fn(async () => undefined);
    const entry = {
      _id: 'entry-1',
      roomId: 'room-1',
      memberId: 'member-1',
      gameNumber: 2,
      attempt: 1,
      status: 'queued',
      prompt: 'Draw the best circle',
    };
    const index = { eq: vi.fn(() => index) };
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => (id === 'entry-1' ? entry : { _id: 'room-1', status: 'closed' })),
        query: vi.fn(() => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return { unique: vi.fn(async () => ({ gameNumber: 2, phase: 'generating' })) };
          }),
        })),
        patch,
      },
    };
    await expect(
      beginPromptArcadeGeneration(ctx as never, { entryId: 'entry-1' as never, gameNumber: 2, attempt: 1 })
    ).resolves.toBeNull();
    expect(patch).not.toHaveBeenCalled();
  });

  it('starts the playlist automatically when the final player game becomes ready', async () => {
    const entry = {
      _id: 'entry-1',
      roomId: 'room-1',
      memberId: 'member-1',
      gameNumber: 2,
      attempt: 1,
      status: 'validating',
      prompt: 'Draw the best circle',
      artifactId: null as string | null,
      order: 0,
    };
    const state = {
      _id: 'state-1',
      roomId: 'room-1',
      gameNumber: 2,
      phase: 'generating',
      playlistStarted: false,
      currentRoundId: null,
      currentRoundNumber: 0,
    };
    let artifact: Record<string, unknown> | null = null;
    let round: Record<string, unknown> | null = null;
    const index = { eq: vi.fn(() => index) };
    const insert = vi.fn(async (table: string, value: Record<string, unknown>) => {
      if (table === 'promptArcadeArtifacts') {
        artifact = { _id: 'artifact-1', ...value };
        return 'artifact-1';
      }
      if (table === 'promptArcadeRounds') {
        round = { _id: 'round-1', ...value };
        return 'round-1';
      }
      return 'result-1';
    });
    const patch = vi.fn(async (table: string, _id: string, value: Record<string, unknown>) => {
      if (table === 'promptArcadeEntries') Object.assign(entry, value);
      if (table === 'promptArcadeGameStates') Object.assign(state, value);
    });
    const ctx = {
      db: {
        get: vi.fn(async (table: string) => {
          if (table === 'promptArcadeEntries') return entry;
          if (table === 'rooms') {
            return {
              _id: 'room-1',
              status: 'open',
              gameType: 'promptArcade',
              currentGameId: 'room-game-1',
            };
          }
          if (table === 'roomGames') {
            return { _id: 'room-game-1', roomId: 'room-1', gameType: 'promptArcade', status: 'active' };
          }
          if (table === 'promptArcadeArtifacts') return artifact;
          if (table === 'promptArcadeRounds') return round;
          if (table === 'roomMembers') {
            return { _id: 'member-1', displayName: 'Igor', isActive: true, memberKind: 'player' };
          }
          return null;
        }),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return {
              unique: vi.fn(async () => (table === 'promptArcadeGameStates' ? state : null)),
              take: vi.fn(async () => (table === 'promptArcadeEntries' ? [entry] : [])),
            };
          }),
        })),
        insert,
        patch,
      },
      scheduler: { runAfter: vi.fn(async () => 'scheduled-round') },
    };

    await expect(
      commitPromptArcadeArtifact(ctx as never, {
        entryId: 'entry-1' as never,
        gameNumber: 2,
        attempt: 1,
        title: 'Circle Lab',
        interpretation: 'Draw a circle quickly.',
        instructions: 'Trace the circle.',
        durationMs: 20_000,
        scoringMode: 'quality',
        codeStorageId: 'storage-1' as never,
        codeSha256: 'hash',
        model: 'model',
      })
    ).resolves.toBe(true);

    expect(entry.status).toBe('ready');
    expect(state.playlistStarted).toBe(true);
    expect(state.phase).toBe('countdown');
    expect(insert).toHaveBeenCalledWith('promptArcadeRounds', expect.objectContaining({ entryId: 'entry-1' }));
  });
});
