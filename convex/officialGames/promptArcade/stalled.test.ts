import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeCurrentRoomGame } from '../../roomGames';
import { analyzeStalledPromptArcadeEntries } from './game';
import { cleanupPromptArcadeArtifacts, settleIdlePromptArcadePlaylist } from './rounds';

vi.mock('../../roomGames', () => ({
  activateCurrentRoomGame: vi.fn(),
  completeCurrentRoomGame: vi.fn(),
}));

describe('Prompt Arcade stalled playlist handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects only unresolved prompts and treats live work or ready games as blockers', () => {
    const analysis = analyzeStalledPromptArcadeEntries([
      { id: 'played', status: 'played' },
      { id: 'writer', status: 'writing' },
      { id: 'failed', status: 'needsRevision' },
      { id: 'queued', status: 'queued' },
      { id: 'ready', status: 'ready' },
      { id: 'withdrawn', status: 'withdrawn' },
    ]);
    expect(analysis.unresolved.map((entry) => entry.id)).toEqual(['writer', 'failed']);
    expect(analysis.blockers.map((entry) => entry.id)).toEqual(['queued', 'ready']);
  });

  it('completes when played games and explicitly withdrawn unresolved prompts are all that remain', async () => {
    const entries = [
      { _id: 'entry-played', roomId: 'room-1', gameNumber: 3, memberId: 'member-1', order: 0, status: 'played' },
      {
        _id: 'entry-withdrawn',
        roomId: 'room-1',
        gameNumber: 3,
        memberId: 'member-2',
        order: 1,
        status: 'withdrawn',
      },
    ];
    const index = { eq: vi.fn(() => index) };
    const patch = vi.fn(async () => undefined);
    const runAfter = vi.fn(async () => 'scheduled-cleanup');
    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return { take: vi.fn(async () => entries) };
          }),
        })),
        get: vi.fn(async (table: string) => (table === 'rooms' ? { _id: 'room-1', gameType: 'promptArcade' } : null)),
        patch,
      },
      scheduler: { runAfter },
    };
    const state = {
      _id: 'state-1',
      roomId: 'room-1',
      gameNumber: 3,
      phase: 'generating',
      currentRoundId: null,
      currentRoundNumber: 2,
      playlistStarted: true,
    };

    await settleIdlePromptArcadePlaylist(ctx as never, state as never, 50_000);

    expect(patch).toHaveBeenCalledWith(
      'promptArcadeGameStates',
      'state-1',
      expect.objectContaining({ phase: 'complete', phaseStartedAt: 50_000 })
    );
    expect(completeCurrentRoomGame).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ _id: 'room-1' }),
      'promptArcade',
      50_000
    );
    expect(runAfter).toHaveBeenCalledWith(3_600_000, expect.anything(), { roomId: 'room-1', gameNumber: 3 });
  });

  it('deletes terminal target-game blobs after current room state advances and retains artifact rows', async () => {
    const index = { eq: vi.fn(() => index) };
    const entries = [{ status: 'played' }, { status: 'withdrawn' }];
    const artifacts = [{ codeStorageId: 'storage-1' }, { codeStorageId: 'storage-2' }];
    const deleteBlob = vi.fn(async () => undefined);
    const deleteRow = vi.fn(async () => undefined);
    const ctx = {
      db: {
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            if (table === 'promptArcadeGameStates') {
              return { unique: vi.fn(async () => ({ roomId: 'room-1', gameNumber: 4, phase: 'playing' })) };
            }
            return { take: vi.fn(async () => (table === 'promptArcadeEntries' ? entries : artifacts)) };
          }),
        })),
        delete: deleteRow,
      },
      storage: { delete: deleteBlob },
    };

    await cleanupPromptArcadeArtifacts(ctx as never, { roomId: 'room-1' as never, gameNumber: 3 });

    expect(deleteBlob.mock.calls).toEqual([['storage-1'], ['storage-2']]);
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it('does not clean artifacts while a target-game entry is still active', async () => {
    const index = { eq: vi.fn(() => index) };
    const deleteBlob = vi.fn(async () => undefined);
    const queriedTables: string[] = [];
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          queriedTables.push(table);
          return {
            withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
              configure(index);
              return { take: vi.fn(async () => [{ status: 'played' }, { status: 'ready' }]) };
            }),
          };
        }),
      },
      storage: { delete: deleteBlob },
    };

    await cleanupPromptArcadeArtifacts(ctx as never, { roomId: 'room-1' as never, gameNumber: 3 });

    expect(deleteBlob).not.toHaveBeenCalled();
    expect(queriedTables).toEqual(['promptArcadeEntries']);
  });
});
