import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NextGameVoting from './NextGameVoting';

const mocks = vi.hoisted(() => ({
  poll: null as Record<string, unknown> | null,
  catalog: [
    {
      gameType: 'trivia',
      name: 'Trivia',
      description: 'Take on another ten questions.',
      author: { name: 'Xup Games', url: 'https://xup.games' },
      source: 'official',
    },
    {
      gameType: 'typeRacer',
      name: 'Type Racer',
      description: 'Line up for a new passage.',
      author: { name: 'Xup Games', url: 'https://xup.games' },
      source: 'official',
    },
    {
      gameType: 'trendline',
      name: 'Trendline',
      description: 'Draw the shape of real-world data, then compare your line with history.',
      author: { name: 'Igor Amidzic', url: null },
      source: 'community',
    },
  ],
  mutationIndex: 0,
  openVoting: vi.fn(),
  castVote: vi.fn(),
  closeRound: vi.fn(),
  chooseGame: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: (_reference: unknown, args: unknown) =>
    typeof args === 'object' && args !== null && 'roomId' in args ? mocks.poll : mocks.catalog,
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
  options: ['trivia', 'typeRacer'],
  eligibleVoterCount: 3,
  votesCast: 0,
  isEligible: true,
  selectedGameType: null,
  tallies: null,
  recommendedGameType: null,
  chosenGameType: null,
  autoAdvanceAt: null,
};

function renderVoting(isOwner = false, currentGameType: 'trivia' | 'typeRacer' | 'trendline' | null = 'trivia') {
  return render(
    <NextGameVoting
      roomId={'room-1' as never}
      currentGameId={currentGameType === null ? null : ('room-game-1' as never)}
      currentGameType={currentGameType}
      sessionToken={'a'.repeat(32)}
      isOwner={isOwner}
    />
  );
}

function renderDialogVoting() {
  return render(
    <NextGameVoting
      roomId={'room-1' as never}
      currentGameId={'room-game-1' as never}
      currentGameType="trivia"
      sessionToken={'a'.repeat(32)}
      isOwner
      layout="dialog"
    />
  );
}

describe('NextGameVoting', () => {
  afterEach(() => vi.useRealTimers());

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

    expect(screen.queryByRole('group', { name: 'Final vote count' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Type Racer/ }));

    await waitFor(() =>
      expect(mocks.castVote).toHaveBeenCalledWith({
        roomId: 'room-1',
        sessionToken: 'a'.repeat(32),
        gameType: 'typeRacer',
      })
    );
  });

  it('lets only the owner close an open round', async () => {
    const user = userEvent.setup();
    mocks.poll = { ...basePoll, votesCast: 1, selectedGameType: 'trivia' };
    renderVoting(true);

    await user.click(screen.getByRole('button', { name: 'Close round' }));
    expect(mocks.closeRound).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: 'a'.repeat(32),
      roundId: 'round-1',
    });
  });

  it("counts down to the owner's winning game without requiring another action", () => {
    mocks.poll = {
      ...basePoll,
      status: 'awaitingOwner',
      roundStatus: 'closed',
      votesCast: 3,
      selectedGameType: 'trivia',
      recommendedGameType: 'trivia',
      autoAdvanceAt: Date.now() + 5_000,
      tallies: [
        { gameType: 'trivia', votes: 2, percentage: 67 },
        { gameType: 'typeRacer', votes: 1, percentage: 33 },
      ],
    };
    renderVoting(true);

    expect(screen.queryByRole('group', { name: 'Final vote count' })).not.toBeInTheDocument();
    expect(screen.queryByText('Players recommend Trivia.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trivia is up next.' })).toBeInTheDocument();
    expect(screen.getByText('The winning game is locked in.')).toBeInTheDocument();
    expect(screen.getByText('Starting Trivia in 5s')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Time until Trivia starts' })).toBeInTheDocument();
    const winner = screen.getByRole('button', { name: /WinnerTrivia/ });
    const loser = screen.getByRole('button', { name: /Type Racer/ });
    expect(winner).toHaveAttribute('data-variant', 'game-choice');
    expect(loser).toHaveAttribute('data-variant', 'game-choice');
    expect(winner).toHaveClass(
      'aspect-[4/3]',
      'data-[selected=true]:bg-[#ecf9f2]',
      'data-[selected=true]:border-[#35a675]'
    );
    expect(loser).toHaveClass('bg-white');
    expect(loser).not.toHaveClass('opacity-40');
    expect(within(winner).getByText('2')).toBeInTheDocument();
    expect(within(loser).getByText('1')).toBeInTheDocument();
    expect(winner.querySelector('svg')?.parentElement).toHaveClass('bg-[var(--game-color)]', 'size-11');
    expect(winner).toHaveAttribute('data-advancing', 'true');
    expect(winner).toBeDisabled();
    expect(loser).toBeDisabled();
    expect(mocks.chooseGame).not.toHaveBeenCalled();
  });

  it('shows non-owners the same completed result styling in a read-only state', () => {
    mocks.poll = {
      ...basePoll,
      status: 'awaitingOwner',
      roundStatus: 'closed',
      votesCast: 3,
      selectedGameType: 'typeRacer',
      recommendedGameType: 'trivia',
      autoAdvanceAt: Date.now() + 5_000,
      tallies: [
        { gameType: 'trivia', votes: 2, percentage: 67 },
        { gameType: 'typeRacer', votes: 1, percentage: 33 },
      ],
    };
    renderVoting(false);

    const winner = screen.getByRole('button', { name: /WinnerTrivia/ });
    const loser = screen.getByRole('button', { name: /Type Racer/ });
    expect(winner).toBeDisabled();
    expect(loser).toBeDisabled();
    expect(winner).toHaveClass('data-[selected=true]:bg-[#ecf9f2]');
    expect(loser).toHaveClass('bg-white');
    expect(loser).not.toHaveClass('opacity-40');
    expect(within(winner).getByText('2')).toBeInTheDocument();
    expect(within(loser).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('The winning game is locked in.')).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for the room owner/)).not.toBeInTheDocument();
  });

  it('updates the winner countdown while the backend transition approaches', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T22:00:00Z'));
    mocks.poll = {
      ...basePoll,
      status: 'awaitingOwner',
      roundStatus: 'closed',
      votesCast: 1,
      recommendedGameType: 'trivia',
      autoAdvanceAt: Date.now() + 5_000,
      tallies: [
        { gameType: 'trivia', votes: 1, percentage: 100 },
        { gameType: 'typeRacer', votes: 0, percentage: 0 },
      ],
    };
    renderVoting(false);

    expect(screen.getByText('Starting Trivia in 5s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2_100));
    expect(screen.getByText('Starting Trivia in 3s')).toBeInTheDocument();
  });

  it('puts the current mode first and keeps every label to the game name', () => {
    renderVoting(false, 'typeRacer');

    const choices = screen.getAllByRole('button');
    expect(choices[0]).toHaveAccessibleName(/Type Racer/);
    expect(choices[0]).toHaveClass('flex-col', 'items-stretch', 'justify-start', 'gap-0!');
    expect(screen.getByRole('button', { name: /Trivia/ })).toHaveClass(
      'flex-col',
      'items-stretch',
      'justify-start',
      'gap-0!'
    );
    expect(screen.getByRole('button', { name: /Trivia/ }).querySelector('svg')).toHaveClass('size-6');
    expect(screen.queryByText('Official')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Type Racer/ })).not.toHaveTextContent('by Xup Games');
    expect(screen.getByRole('button', { name: /Type Racer/ }).parentElement).toHaveClass('grid-cols-3');
  });

  it('uses compact first-game cards while the backend prepares the winner', () => {
    mocks.poll = {
      ...basePoll,
      roomGameId: null,
      status: 'awaitingOwner',
      roundStatus: 'closed',
      options: ['trivia', 'typeRacer', 'trendline'],
      votesCast: 1,
      selectedGameType: 'trivia',
      recommendedGameType: 'trivia',
      autoAdvanceAt: Date.now() + 5_000,
      tallies: [
        { gameType: 'trivia', votes: 1, percentage: 100 },
        { gameType: 'typeRacer', votes: 0, percentage: 0 },
        { gameType: 'trendline', votes: 0, percentage: 0 },
      ],
    };
    renderVoting(true, null);

    expect(screen.getByRole('heading', { name: 'Trivia is up next.' })).toBeInTheDocument();
    const recommendedChoice = screen.getByRole('button', { name: /WinnerTrivia/ });
    expect(recommendedChoice).toHaveClass('h-auto!', 'min-h-0', 'gap-0!');
    expect(recommendedChoice).toHaveAttribute('data-variant', 'game-choice');
    expect(recommendedChoice).toHaveClass('data-[selected=true]:bg-[#ecf9f2]');
    expect(within(recommendedChoice).getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trendline/ })).toHaveTextContent('by Igor Amidzic');
    expect(screen.getByRole('button', { name: /Trendline/ })).toHaveClass('bg-white');
    expect(screen.getByRole('button', { name: /Trendline/ })).not.toHaveClass('opacity-40');
    expect(recommendedChoice).toBeDisabled();
    expect(mocks.chooseGame).not.toHaveBeenCalled();
  });

  it('lets the owner break a tied runoff', async () => {
    const user = userEvent.setup();
    mocks.poll = {
      ...basePoll,
      status: 'awaitingOwner',
      roundStatus: 'closed',
      roundNumber: 2,
      votesCast: 2,
      selectedGameType: 'trivia',
      recommendedGameType: null,
      autoAdvanceAt: null,
      tallies: [
        { gameType: 'trivia', votes: 1, percentage: 50 },
        { gameType: 'typeRacer', votes: 1, percentage: 50 },
      ],
    };
    renderVoting(true);

    expect(screen.getByRole('heading', { name: 'Break the tie.' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Type Racer/ }));
    expect(mocks.chooseGame).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: 'a'.repeat(32),
      expectedRoomGameId: 'room-game-1',
      gameType: 'typeRacer',
    });
  });

  it('keeps a tied runoff read-only for other players', () => {
    mocks.poll = {
      ...basePoll,
      status: 'awaitingOwner',
      roundStatus: 'closed',
      roundNumber: 2,
      votesCast: 2,
      recommendedGameType: null,
      autoAdvanceAt: null,
      tallies: [
        { gameType: 'trivia', votes: 1, percentage: 50 },
        { gameType: 'typeRacer', votes: 1, percentage: 50 },
      ],
    };
    renderVoting(false);

    expect(screen.getByRole('heading', { name: 'The vote is tied.' })).toBeInTheDocument();
    expect(screen.getByText('Waiting for the room owner to break the tie.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trivia/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Type Racer/ })).toBeDisabled();
  });

  it('shows compact community metadata without a description', () => {
    mocks.poll = { ...basePoll, options: ['trivia', 'trendline'] };
    renderVoting();

    const trendline = screen.getByRole('button', { name: /Trendline/ });
    expect(trendline).toHaveClass('aspect-[4/3]', 'min-w-0');
    expect(trendline).toHaveTextContent('Community');
    expect(trendline).not.toHaveTextContent('Community game');
    expect(trendline).not.toHaveTextContent('Draw the shape of real-world data, then compare your line with history.');
    expect(trendline).toHaveTextContent('by Igor Amidzic');
    expect(screen.queryByText('Official')).not.toBeInTheDocument();
    expect(screen.queryByText(/two-thirds majority/)).not.toBeInTheDocument();
  });

  it('uses content-sized cards in the game-change dialog', () => {
    mocks.poll = { ...basePoll, options: ['trivia', 'typeRacer', 'trendline'] };
    renderDialogVoting();

    const trendline = screen.getByRole('button', { name: /Trendline/ });
    expect(trendline).toHaveClass('h-auto!', 'min-h-0', 'p-3.5');
    expect(trendline).not.toHaveClass('aspect-[4/3]');
    expect(trendline.parentElement).toHaveClass('grid-cols-3', 'max-[700px]:grid-cols-1');
  });

  it('keeps every visible vote count aligned to the right edge of its card', () => {
    mocks.poll = {
      ...basePoll,
      votesCast: 1,
      selectedGameType: 'typeRacer',
      tallies: [
        { gameType: 'trivia', votes: 0, percentage: 0 },
        { gameType: 'typeRacer', votes: 1, percentage: 100 },
      ],
    };
    renderVoting(false, 'typeRacer');

    expect(within(screen.getByRole('button', { name: /Type Racer/ })).getByText('1')).toHaveClass('ml-auto');
    expect(within(screen.getByRole('button', { name: /Trivia/ })).getByText('0')).toHaveClass('ml-auto');
  });
});
