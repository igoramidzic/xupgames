import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GameModeControl, { GameModeContent } from './GameModeControl';

const mocks = vi.hoisted(() => ({
  poll: null as Record<string, unknown> | null,
  catalog: [
    {
      gameType: 'typeRacer',
      name: 'Type Racer',
      description: 'Race on the same passage.',
      author: { name: 'Xup Games', url: 'https://xup.games' },
      source: 'official',
    },
    {
      gameType: 'trivia',
      name: 'Trivia',
      description: 'Answer hard questions.',
      author: { name: 'Xup Games', url: 'https://xup.games' },
      source: 'official',
    },
  ],
  mutationIndex: 0,
  startVote: vi.fn(),
  changeGame: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: (_reference: unknown, args: unknown) =>
    typeof args === 'object' && args !== null && 'roomId' in args ? mocks.poll : mocks.catalog,
  useMutation: () => {
    const mutations = [mocks.startVote, mocks.changeGame];
    const mutation = mutations[mocks.mutationIndex % mutations.length];
    mocks.mutationIndex += 1;
    return mutation;
  },
}));

vi.mock('@/components/NextGameVoting', () => ({
  default: () => <div>Live game ballot</div>,
}));

function renderControl(isOwner = true) {
  function Harness() {
    const [open, setOpen] = useState(false);
    const props = {
      roomId: 'room-1' as never,
      currentGameId: 'room-game-1' as never,
      currentGameType: 'typeRacer' as const,
      sessionToken: 'a'.repeat(32),
      isOwner,
      isClosed: false,
    };
    return (
      <>
        <GameModeControl {...props} onOpen={() => setOpen(true)} />
        <GameModeContent {...props} open={open} onClose={() => setOpen(false)}>
          <div>Current game card</div>
        </GameModeContent>
      </>
    );
  }

  return render(<Harness />);
}

describe('GameModeControl', () => {
  beforeEach(() => {
    mocks.poll = null;
    mocks.mutationIndex = 0;
    mocks.startVote.mockReset().mockResolvedValue(null);
    mocks.changeGame.mockReset().mockResolvedValue({ roomGameId: 'room-game-2', gameType: 'trivia' });
  });

  it('replaces the owner game card with the choice flow instead of opening a dialog', async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole('button', { name: 'Change game' }));

    expect(screen.getByRole('heading', { name: "Who picks what's next?" })).toBeInTheDocument();
    expect(screen.queryByText('Current game card')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.getByText('Current game card')).toBeInTheDocument();
  });

  it('lets the owner switch the room directly from the inline game list', async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole('button', { name: 'Change game' }));
    await user.click(screen.getByRole('button', { name: /I'll choose/ }));
    await user.click(screen.getByRole('button', { name: 'Trivia' }));

    await waitFor(() =>
      expect(mocks.changeGame).toHaveBeenCalledWith({
        roomId: 'room-1',
        sessionToken: 'a'.repeat(32),
        expectedRoomGameId: 'room-game-1',
        gameType: 'trivia',
      })
    );
  });

  it('ends the current round and replaces the owner card with the ballot', async () => {
    const user = userEvent.setup();
    renderControl();

    await user.click(screen.getByRole('button', { name: 'Change game' }));
    await user.click(screen.getByRole('button', { name: /Let the room vote/ }));

    await waitFor(() =>
      expect(mocks.startVote).toHaveBeenCalledWith({
        roomId: 'room-1',
        sessionToken: 'a'.repeat(32),
        expectedRoomGameId: 'room-game-1',
      })
    );
    expect(screen.getByText('Live game ballot')).toBeInTheDocument();
    expect(screen.getByText(/You opened the room vote/)).toBeInTheDocument();
  });

  it('replaces every player game card when the owner starts a vote', () => {
    mocks.poll = { trigger: 'owner', pollId: 'poll-1' };
    renderControl(false);

    expect(screen.getByText(/The game is paused/)).toBeInTheDocument();
    expect(screen.getByText('Live game ballot')).toBeInTheDocument();
    expect(screen.queryByText('Current game card')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change game' })).not.toBeInTheDocument();
  });

  it('keeps Change game visible for the owner and opens the active post-game ballot', async () => {
    mocks.poll = { trigger: 'gameComplete', pollId: 'poll-1' };
    const user = userEvent.setup();

    const owner = renderControl(true);
    expect(screen.getByText('Current game card')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change game' }));
    expect(screen.getByText('Live game ballot')).toBeInTheDocument();

    owner.unmount();
    renderControl(false);
    expect(screen.getByText('Current game card')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change game' })).not.toBeInTheDocument();
  });
});
