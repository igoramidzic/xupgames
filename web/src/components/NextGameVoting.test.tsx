import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NextGameVoting from './NextGameVoting';

const mocks = vi.hoisted(() => ({
  poll: null as Record<string, unknown> | null,
  mutationIndex: 0,
  openVoting: vi.fn(),
  castVote: vi.fn(),
  closeRound: vi.fn(),
  chooseGame: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.poll,
  useMutation: () => {
    const mutations = [mocks.openVoting, mocks.castVote, mocks.closeRound, mocks.chooseGame];
    const mutation = mutations[mocks.mutationIndex % mutations.length];
    mocks.mutationIndex += 1;
    return mutation;
  },
}));

const basePoll = {
  pollId: 'poll-1',
  roomGameId: 'room-game-1',
  status: 'round1',
  roundId: 'round-1',
  roundNumber: 1,
  roundStatus: 'open',
  options: ['drawing', 'trivia', 'typeRacer'],
  eligibleVoterCount: 3,
  votesCast: 0,
  isEligible: true,
  selectedGameType: null,
  tallies: null,
  recommendedGameType: null,
  chosenGameType: null,
};

function renderVoting(isOwner = false, currentGameType: 'drawing' | 'trivia' | 'typeRacer' = 'drawing') {
  return render(
    <NextGameVoting
      roomId={'room-1' as never}
      currentGameId={'room-game-1' as never}
      currentGameType={currentGameType}
      sessionToken={'a'.repeat(32)}
      isOwner={isOwner}
    />
  );
}

describe('NextGameVoting', () => {
  beforeEach(() => {
    mocks.mutationIndex = 0;
    mocks.openVoting.mockReset().mockResolvedValue(null);
    mocks.castVote.mockReset().mockResolvedValue(null);
    mocks.closeRound.mockReset().mockResolvedValue({ status: 'awaitingOwner', roundNumber: 1 });
    mocks.chooseGame.mockReset().mockResolvedValue({ roomGameId: 'room-game-2', gameType: 'trivia' });
    mocks.poll = { ...basePoll };
  });

  it('keeps counts hidden until the player votes and saves their choice', async () => {
    const user = userEvent.setup();
    renderVoting();

    expect(screen.getByText(/Vote to reveal the live count/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Final vote count' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Switch to Trivia/ }));

    await waitFor(() =>
      expect(mocks.castVote).toHaveBeenCalledWith({
        roomId: 'room-1',
        sessionToken: 'a'.repeat(32),
        gameType: 'trivia',
      })
    );
  });

  it('lets only the owner close an open round', async () => {
    const user = userEvent.setup();
    mocks.poll = { ...basePoll, votesCast: 1, selectedGameType: 'drawing' };
    renderVoting(true);

    await user.click(screen.getByRole('button', { name: 'Close round' }));
    expect(mocks.closeRound).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: 'a'.repeat(32),
      roundId: 'round-1',
    });
  });

  it('shows the final tally and leaves the game selection to the owner', async () => {
    const user = userEvent.setup();
    mocks.poll = {
      ...basePoll,
      status: 'awaitingOwner',
      roundStatus: 'closed',
      votesCast: 3,
      selectedGameType: 'trivia',
      recommendedGameType: 'trivia',
      tallies: [
        { gameType: 'drawing', votes: 1, percentage: 33 },
        { gameType: 'trivia', votes: 2, percentage: 67 },
        { gameType: 'typeRacer', votes: 0, percentage: 0 },
      ],
    };
    renderVoting(true);

    expect(screen.getByRole('group', { name: 'Final vote count' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Top voteSwitch to Trivia/ }));
    expect(mocks.chooseGame).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: 'a'.repeat(32),
      expectedRoomGameId: 'room-game-1',
      gameType: 'trivia',
    });
  });

  it('puts the current mode first with its familiar replay action', () => {
    renderVoting(false, 'typeRacer');

    const choices = screen.getAllByRole('button');
    expect(choices[0]).toHaveAccessibleName(/Race Again/);
    expect(screen.getByRole('button', { name: /Switch to Drawing/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to Trivia/ })).toBeInTheDocument();
  });
});
