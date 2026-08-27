import type { ConvexError } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';
import { applyPromptArcadeCreatorBonuses, rankPromptArcadeGames, recordPromptArcadeRating } from './ratings';

describe('Prompt Arcade game ratings', () => {
  it('ranks by average rating and gives every first-place tie the creator bonus', () => {
    const entries = [
      { _id: 'entry-1', memberId: 'member-1', displayName: 'Igor', order: 0 },
      { _id: 'entry-2', memberId: 'member-2', displayName: 'Maya', order: 1 },
      { _id: 'entry-3', memberId: 'member-3', displayName: 'Theo', order: 2 },
    ].map((entry, index) => ({
      ...entry,
      status: 'played' as const,
      artifactId: `artifact-${index + 1}`,
    }));
    const artifacts = entries.map((entry, index) => ({
      _id: `artifact-${index + 1}`,
      entryId: entry._id,
      title: `Game ${index + 1}`,
      interpretation: `Interpretation ${index + 1}`,
    }));
    const ratings = [
      { entryId: 'entry-1', rating: 5 },
      { entryId: 'entry-1', rating: 4 },
      { entryId: 'entry-2', rating: 4 },
      { entryId: 'entry-2', rating: 5 },
      { entryId: 'entry-3', rating: 4 },
    ];

    const rankings = rankPromptArcadeGames(entries as never, artifacts as never, ratings as never);

    expect(rankings.map((ranking) => ranking.entryId)).toEqual(['entry-1', 'entry-2', 'entry-3']);
    expect(rankings.slice(0, 2)).toEqual([
      expect.objectContaining({ averageRating: 4.5, isWinner: true, creatorBonus: 500 }),
      expect.objectContaining({ averageRating: 4.5, isWinner: true, creatorBonus: 500 }),
    ]);
    expect(rankings[2]).toEqual(expect.objectContaining({ averageRating: 4, isWinner: false, creatorBonus: 0 }));
  });

  it('does not crown an unrated game', () => {
    const rankings = rankPromptArcadeGames(
      [
        {
          _id: 'entry-1',
          memberId: 'member-1',
          displayName: 'Igor',
          order: 0,
          status: 'played',
          artifactId: 'artifact-1',
        },
      ] as never,
      [{ _id: 'artifact-1', entryId: 'entry-1', title: 'Solo', interpretation: 'A solo game.' }] as never,
      []
    );

    expect(rankings[0]).toEqual(
      expect.objectContaining({ averageRating: null, ratingCount: 0, isWinner: false, creatorBonus: 0 })
    );
  });

  it('applies the creator bonus once and leaves an already-bonused score unchanged', async () => {
    const entry = {
      _id: 'entry-1',
      memberId: 'member-1',
      displayName: 'Igor',
      order: 0,
      status: 'played',
      artifactId: 'artifact-1',
    };
    const artifact = {
      _id: 'artifact-1',
      entryId: 'entry-1',
      title: 'Signal Gallows',
      interpretation: 'Guess the transmission.',
    };
    const rating = { entryId: 'entry-1', rating: 5 };
    let score = {
      _id: 'score-1',
      memberId: 'member-1',
      totalScore: 1_000,
      creatorBonus: 0,
    };
    const index = { eq: vi.fn(() => index) };
    const patch = vi.fn(async () => undefined);
    const ctx = {
      db: {
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return {
              take: vi.fn(async () => {
                if (table === 'promptArcadeEntries') return [entry];
                if (table === 'promptArcadeArtifacts') return [artifact];
                if (table === 'promptArcadeRatings') return [rating];
                if (table === 'promptArcadeScores') return [score];
                return [];
              }),
            };
          }),
        })),
        patch,
      },
    };
    const state = { roomId: 'room-1', gameNumber: 1 };

    await applyPromptArcadeCreatorBonuses(ctx as never, state as never, 20_000);
    expect(patch).toHaveBeenCalledWith('promptArcadeScores', 'score-1', {
      totalScore: 1_500,
      creatorBonus: 500,
      updatedAt: 20_000,
    });

    patch.mockClear();
    score = { ...score, totalScore: 1_500, creatorBonus: 500 };
    await applyPromptArcadeCreatorBonuses(ctx as never, state as never, 21_000);
    expect(patch).not.toHaveBeenCalled();
  });

  it('upserts a participating peer rating but rejects self-ratings', async () => {
    const state = {
      roomId: 'room-1',
      gameNumber: 2,
      phase: 'roundResults',
      currentRoundId: 'round-1',
      phaseEndsAt: 15_000,
    };
    const round = {
      _id: 'round-1',
      roundNumber: 1,
      entryId: 'entry-1',
      status: 'results',
    };
    const index = { eq: vi.fn(() => index) };
    const insert = vi.fn(async () => 'rating-1');
    const ctx = {
      db: {
        get: vi.fn(async (table: string) =>
          table === 'promptArcadeEntries' ? { gameNumber: 2, memberId: 'member-1' } : null
        ),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return {
              unique: vi.fn(async () =>
                table === 'promptArcadeResults' ? { _id: 'result-2', memberId: 'member-2' } : null
              ),
            };
          }),
        })),
        insert,
        patch: vi.fn(async () => undefined),
      },
    };

    await expect(
      recordPromptArcadeRating(ctx as never, state as never, round as never, 'member-2' as never, 5, 12_000)
    ).resolves.toEqual({ rating: 5 });
    expect(insert).toHaveBeenCalledWith(
      'promptArcadeRatings',
      expect.objectContaining({ roundId: 'round-1', entryId: 'entry-1', raterMemberId: 'member-2', rating: 5 })
    );

    await expect(
      recordPromptArcadeRating(ctx as never, state as never, round as never, 'member-1' as never, 5, 12_000)
    ).rejects.toMatchObject({
      data: { code: 'PROMPT_ARCADE_SELF_RATING' },
    } satisfies Partial<ConvexError<{ code: string }>>);
  });

  it('rejects invalid values and submissions after the five-second window', async () => {
    const baseState = {
      roomId: 'room-1',
      gameNumber: 2,
      phase: 'roundResults',
      currentRoundId: 'round-1',
      phaseEndsAt: 15_000,
    };
    const round = { _id: 'round-1', entryId: 'entry-1', status: 'results' };
    const ctx = { db: {} };

    await expect(
      recordPromptArcadeRating(ctx as never, baseState as never, round as never, 'member-2' as never, 6, 12_000)
    ).rejects.toMatchObject({ data: { code: 'INVALID_PROMPT_ARCADE_RATING' } });
    await expect(
      recordPromptArcadeRating(ctx as never, baseState as never, round as never, 'member-2' as never, 5, 15_001)
    ).rejects.toMatchObject({ data: { code: 'PROMPT_ARCADE_RATING_CLOSED' } });
  });
});
