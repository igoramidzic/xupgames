import { GAME_TYPES, type GameType } from './games';

export type VotingRoundResolution =
  | { kind: 'runoff'; finalists: GameType[] }
  | { kind: 'awaitingOwner'; recommendation: GameType | null };

export function resolveVotingRound(
  options: readonly GameType[],
  votes: readonly GameType[],
  roundNumber: number
): VotingRoundResolution {
  if (options.length === 0 || votes.length === 0) {
    throw new Error('A voting round needs options and at least one vote.');
  }

  const voteCounts = new Map<GameType, number>();
  for (const vote of votes) {
    voteCounts.set(vote, (voteCounts.get(vote) ?? 0) + 1);
  }
  const rankedOptions = [...options].sort(
    (first, second) =>
      (voteCounts.get(second) ?? 0) - (voteCounts.get(first) ?? 0) ||
      GAME_TYPES.indexOf(first) - GAME_TYPES.indexOf(second)
  );
  const leader = rankedOptions[0];
  if (leader === undefined) {
    throw new Error('A voting round needs at least one option.');
  }
  const leaderVotes = voteCounts.get(leader) ?? 0;

  if (roundNumber === 1 && leaderVotes * 3 < votes.length * 2) {
    const secondOption = rankedOptions[1];
    if (secondOption === undefined) {
      return { kind: 'awaitingOwner', recommendation: leader };
    }
    const secondPlaceVotes = voteCounts.get(secondOption) ?? 0;
    return {
      kind: 'runoff',
      finalists: rankedOptions.filter((gameType) => (voteCounts.get(gameType) ?? 0) >= secondPlaceVotes),
    };
  }

  const secondOption = rankedOptions[1];
  const secondVotes = secondOption === undefined ? -1 : (voteCounts.get(secondOption) ?? 0);
  return {
    kind: 'awaitingOwner',
    recommendation: leaderVotes > secondVotes ? leader : null,
  };
}
