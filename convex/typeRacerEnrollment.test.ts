import { describe, expect, it, vi } from 'vitest';
import { enrollTypeRacerMemberInActiveRace, recordTypeRacerProgress } from './typeRacer';

function queryResult(value: unknown) {
  const index = {
    eq: vi.fn(() => index),
  };
  return {
    withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
      configure(index);
      return { unique: vi.fn(async () => value) };
    }),
  };
}

describe('type racer late enrollment', () => {
  it('adds a late member to a running race with an individual start time', async () => {
    const state = {
      _id: 'state-1',
      roomId: 'room-1',
      raceNumber: 4,
      phase: 'racing',
      startsAt: 1_000,
      participantCount: 1,
    };
    const inserted: Array<{ table: string; value: Record<string, unknown> }> = [];
    const patched: Array<{ table: string; id: string; value: Record<string, unknown> }> = [];
    const db = {
      query: vi.fn((table: string) => queryResult(table === 'typeRacerGameStates' ? state : null)),
      insert: vi.fn(async (table: string, value: Record<string, unknown>) => {
        inserted.push({ table, value });
        return 'progress-2';
      }),
      patch: vi.fn(async (table: string, id: string, value: Record<string, unknown>) => {
        patched.push({ table, id, value });
      }),
    };

    await expect(
      enrollTypeRacerMemberInActiveRace(
        { db } as never,
        'room-1' as never,
        { _id: 'member-2' as never, displayName: 'Grace' },
        8_000
      )
    ).resolves.toBe(true);

    expect(inserted).toEqual([
      {
        table: 'typeRacerProgress',
        value: expect.objectContaining({
          roomId: 'room-1',
          memberId: 'member-2',
          raceNumber: 4,
          displayName: 'Grace',
          status: 'racing',
          startedAt: 8_000,
        }),
      },
    ]);
    expect(patched).toContainEqual({
      table: 'typeRacerGameStates',
      id: 'state-1',
      value: { participantCount: 2 },
    });
  });

  it('measures a late member WPM from when that member joined the race', async () => {
    const state = {
      _id: 'state-1',
      roomId: 'room-1',
      raceNumber: 4,
      phase: 'racing',
      passageText: 'hello',
      startsAt: 1_000,
    };
    const progress = {
      _id: 'progress-2',
      raceNumber: 4,
      status: 'racing',
      revision: 0,
      startedAt: 31_000,
      wpm: 0,
      accuracy: 100,
    };
    const patches: Array<Record<string, unknown>> = [];
    const db = {
      query: vi.fn((table: string) => queryResult(table === 'typeRacerGameStates' ? state : progress)),
      patch: vi.fn(async (_table: string, _id: string, value: Record<string, unknown>) => {
        patches.push(value);
      }),
    };

    const result = await recordTypeRacerProgress(
      { db } as never,
      { _id: 'room-1' } as never,
      { _id: 'member-2' } as never,
      {
        correctChars: 5,
        typedChars: 5,
        totalKeystrokes: 5,
        errorKeystrokes: 0,
        revision: 1,
      },
      61_000
    );

    expect(result).toMatchObject({ kind: 'accepted', wpm: 2 });
    expect(patches[0]).toMatchObject({ wpm: 2 });
  });
});
