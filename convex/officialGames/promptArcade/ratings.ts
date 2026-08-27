import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { PROMPT_ARCADE_CREATOR_BONUS_POINTS, PROMPT_ARCADE_MAX_PLAYERS } from './engine';
import { listPromptArcadeEntries, promptArcadeFail } from './state';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

type RankingEntry = Pick<
  Doc<'promptArcadeEntries'>,
  '_id' | 'memberId' | 'displayName' | 'order' | 'status' | 'artifactId'
>;
type RankingArtifact = Pick<Doc<'promptArcadeArtifacts'>, '_id' | 'entryId' | 'title' | 'interpretation'>;
type RankingRating = Pick<Doc<'promptArcadeRatings'>, 'entryId' | 'rating'>;

export type PromptArcadeGameRanking = {
  rank: number;
  entryId: Id<'promptArcadeEntries'>;
  memberId: Id<'roomMembers'>;
  displayName: string;
  title: string;
  interpretation: string;
  averageRating: number | null;
  ratingCount: number;
  isWinner: boolean;
  creatorBonus: number;
};

const MAX_GAME_RATINGS = PROMPT_ARCADE_MAX_PLAYERS * PROMPT_ARCADE_MAX_PLAYERS;

function compareRatingTotals(
  first: { ratingTotal: number; ratingCount: number },
  second: { ratingTotal: number; ratingCount: number }
) {
  if (first.ratingCount === 0 && second.ratingCount === 0) return 0;
  if (first.ratingCount === 0) return 1;
  if (second.ratingCount === 0) return -1;
  return second.ratingTotal * first.ratingCount - first.ratingTotal * second.ratingCount;
}

export function rankPromptArcadeGames(
  entries: readonly RankingEntry[],
  artifacts: readonly RankingArtifact[],
  ratings: readonly RankingRating[]
): PromptArcadeGameRanking[] {
  const artifactByEntryId = new Map(artifacts.map((artifact) => [artifact.entryId, artifact]));
  const totalsByEntryId = new Map<Id<'promptArcadeEntries'>, { ratingTotal: number; ratingCount: number }>();
  for (const rating of ratings) {
    const totals = totalsByEntryId.get(rating.entryId) ?? { ratingTotal: 0, ratingCount: 0 };
    totals.ratingTotal += rating.rating;
    totals.ratingCount += 1;
    totalsByEntryId.set(rating.entryId, totals);
  }

  const ranked = entries
    .flatMap((entry) => {
      if (entry.status !== 'played' || entry.artifactId === null) return [];
      const artifact = artifactByEntryId.get(entry._id);
      if (artifact === undefined || artifact._id !== entry.artifactId) return [];
      const totals = totalsByEntryId.get(entry._id) ?? { ratingTotal: 0, ratingCount: 0 };
      return [{ entry, artifact, ...totals }];
    })
    .sort(
      (first, second) =>
        compareRatingTotals(first, second) ||
        second.ratingCount - first.ratingCount ||
        first.entry.order - second.entry.order
    );

  const highestRated = ranked.find((entry) => entry.ratingCount > 0) ?? null;
  return ranked.map((entry, index) => {
    const isWinner =
      highestRated !== null &&
      entry.ratingCount > 0 &&
      entry.ratingTotal * highestRated.ratingCount === highestRated.ratingTotal * entry.ratingCount;
    return {
      rank: index + 1,
      entryId: entry.entry._id,
      memberId: entry.entry.memberId,
      displayName: entry.entry.displayName,
      title: entry.artifact.title,
      interpretation: entry.artifact.interpretation,
      averageRating: entry.ratingCount === 0 ? null : entry.ratingTotal / entry.ratingCount,
      ratingCount: entry.ratingCount,
      isWinner,
      creatorBonus: isWinner ? PROMPT_ARCADE_CREATOR_BONUS_POINTS : 0,
    };
  });
}

export async function listPromptArcadeRatings(ctx: DatabaseReaderContext, roomId: Id<'rooms'>, gameNumber: number) {
  const ratings = await ctx.db
    .query('promptArcadeRatings')
    .withIndex('by_roomId_and_gameNumber', (index) => index.eq('roomId', roomId).eq('gameNumber', gameNumber))
    .take(MAX_GAME_RATINGS + 1);
  if (ratings.length > MAX_GAME_RATINGS) {
    throw new Error('Prompt Arcade rating capacity invariant violated.');
  }
  return ratings;
}

export async function getPromptArcadeGameRankings(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  gameNumber: number,
  entries?: Doc<'promptArcadeEntries'>[]
) {
  const gameEntries = entries ?? (await listPromptArcadeEntries(ctx, roomId, gameNumber));
  const [artifacts, ratings] = await Promise.all([
    ctx.db
      .query('promptArcadeArtifacts')
      .withIndex('by_roomId_and_gameNumber', (index) => index.eq('roomId', roomId).eq('gameNumber', gameNumber))
      .take(PROMPT_ARCADE_MAX_PLAYERS + 1),
    listPromptArcadeRatings(ctx, roomId, gameNumber),
  ]);
  if (artifacts.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade artifact capacity invariant violated.');
  }
  return rankPromptArcadeGames(gameEntries, artifacts, ratings);
}

export async function applyPromptArcadeCreatorBonuses(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  now: number
): Promise<void> {
  const rankings = await getPromptArcadeGameRankings(ctx, state.roomId, state.gameNumber);
  const bonusByMemberId = new Map<Id<'roomMembers'>, number>();
  for (const ranking of rankings) {
    bonusByMemberId.set(ranking.memberId, (bonusByMemberId.get(ranking.memberId) ?? 0) + ranking.creatorBonus);
  }
  const scores = await ctx.db
    .query('promptArcadeScores')
    .withIndex('by_roomId_and_gameNumber', (index) =>
      index.eq('roomId', state.roomId).eq('gameNumber', state.gameNumber)
    )
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (scores.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade score capacity invariant violated.');
  }
  for (const score of scores) {
    const creatorBonus = bonusByMemberId.get(score.memberId) ?? 0;
    const previousBonus = score.creatorBonus ?? 0;
    if (creatorBonus === previousBonus) continue;
    await ctx.db.patch('promptArcadeScores', score._id, {
      totalScore: score.totalScore - previousBonus + creatorBonus,
      creatorBonus,
      updatedAt: now,
    });
  }
}

export async function recordPromptArcadeRating(
  ctx: MutationCtx,
  state: Doc<'promptArcadeGameStates'>,
  round: Doc<'promptArcadeRounds'>,
  raterMemberId: Id<'roomMembers'>,
  rating: number,
  now: number
): Promise<{ rating: number }> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    promptArcadeFail('INVALID_PROMPT_ARCADE_RATING', 'Choose a rating from 1 through 5 stars.');
  }
  if (
    state.phase !== 'roundResults' ||
    state.currentRoundId !== round._id ||
    round.status !== 'results' ||
    state.phaseEndsAt === null ||
    now > state.phaseEndsAt
  ) {
    promptArcadeFail('PROMPT_ARCADE_RATING_CLOSED', 'Rating for this game has closed.');
  }
  const entry = await ctx.db.get('promptArcadeEntries', round.entryId);
  if (entry === null || entry.gameNumber !== state.gameNumber) {
    throw new Error('The Prompt Arcade rating entry is missing.');
  }
  if (entry.memberId === raterMemberId) {
    promptArcadeFail('PROMPT_ARCADE_SELF_RATING', 'Creators cannot rate their own game.');
  }
  const result = await ctx.db
    .query('promptArcadeResults')
    .withIndex('by_roundId_and_memberId', (index) => index.eq('roundId', round._id).eq('memberId', raterMemberId))
    .unique();
  if (result === null) {
    promptArcadeFail('PROMPT_ARCADE_NOT_PARTICIPATING', 'Only players in this game can rate it.');
  }
  const existing = await ctx.db
    .query('promptArcadeRatings')
    .withIndex('by_roundId_and_raterMemberId', (index) =>
      index.eq('roundId', round._id).eq('raterMemberId', raterMemberId)
    )
    .unique();
  if (existing === null) {
    await ctx.db.insert('promptArcadeRatings', {
      roomId: state.roomId,
      gameNumber: state.gameNumber,
      roundNumber: round.roundNumber,
      roundId: round._id,
      entryId: round.entryId,
      raterMemberId,
      rating,
      createdAt: now,
      updatedAt: now,
    });
  } else if (existing.rating !== rating) {
    await ctx.db.patch('promptArcadeRatings', existing._id, { rating, updatedAt: now });
  }
  return { rating };
}
