import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home';

const mocks = vi.hoisted(() => ({
  createRoom: vi.fn(),
  catalog: [
    {
      gameType: 'trivia',
      name: 'Trivia',
      description: 'Ten fast questions where quick correct answers score more.',
      author: { name: 'Xup Games', url: 'https://xup.games' },
      source: 'official',
    },
    {
      gameType: 'typeRacer',
      name: 'Type Racer',
      description: 'Race friends through a shared passage.',
      author: { name: 'Xup Games', url: 'https://xup.games' },
      source: 'official',
    },
    {
      gameType: 'trendline',
      name: 'Trendline',
      description: 'Draw the shape of real-world data.',
      author: { name: 'Igor Amidzic', url: null },
      source: 'community',
    },
  ],
}));

vi.mock('convex/react', () => ({
  useMutation: () => mocks.createRoom,
  useQuery: () => mocks.catalog,
}));

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.createRoom.mockReset();
    mocks.catalog[0] = { ...mocks.catalog[0], source: 'official' };
  });

  it('renders the game room creation flow', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /One link.*Everyone plays\./ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeInTheDocument();
    expect(screen.getByLabelText('What should we call you?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trivia/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Type Racer/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Official')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trendline/ })).toHaveTextContent('Community game');
    expect(screen.getByRole('button', { name: /Trendline/ })).toHaveTextContent('by Igor Amidzic');
    expect(screen.getByRole('button', { name: /Trivia/ })).not.toHaveTextContent('by Xup Games');
    expect(screen.getByRole('button', { name: /Type Racer/i })).not.toHaveTextContent('by Xup Games');
    expect(screen.getByRole('button', { name: /Trivia/ })).toHaveClass('min-h-44');
    expect(screen.getByRole('button', { name: /Trivia/ })).toHaveStyle({ '--game-color': '#6347e8' });
    expect(screen.getByRole('button', { name: /Trivia/ }).querySelector('svg')).toHaveClass('size-6');
    expect(screen.getByText('Ten fast questions where quick correct answers score more.')).not.toHaveClass(
      'line-clamp-2'
    );
    expect(screen.queryByText(/Choose an official Xup game/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anyone with the link can join/)).not.toBeInTheDocument();

    const main = screen.getByRole('main');
    const preview = screen.getByLabelText('A preview of a trivia round');
    expect(main).toHaveClass('animate-in', 'fade-in', 'slide-in-from-bottom-4', 'duration-500');
    expect(preview).not.toHaveClass('animate-in', 'delay-100');
  });

  it('switches previews without replaying a card entrance animation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Type Racer/i }));

    const typeRacerPreview = screen.getByLabelText('A preview of a multiplayer type race');
    expect(typeRacerPreview).not.toHaveClass('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-300');
  });

  it('creates a trivia room when trivia is selected', async () => {
    mocks.createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Trivia/ }));
    await user.type(screen.getByLabelText('What should we call you?'), 'Grace');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() =>
      expect(mocks.createRoom).toHaveBeenCalledWith({
        gameType: 'trivia',
        sessionToken: expect.any(String),
        displayName: 'Grace',
      })
    );
  });

  it('creates a type racer room when type racer is selected', async () => {
    mocks.createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Type Racer/i }));
    await user.type(screen.getByLabelText('What should we call you?'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() =>
      expect(mocks.createRoom).toHaveBeenCalledWith({
        gameType: 'typeRacer',
        sessionToken: expect.any(String),
        displayName: 'Ada',
      })
    );
  });

  it('creates the attributed community Trendline room when selected', async () => {
    mocks.createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Trendline/i }));
    await user.type(screen.getByLabelText('What should we call you?'), 'Igor');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() =>
      expect(mocks.createRoom).toHaveBeenCalledWith({
        gameType: 'trendline',
        sessionToken: expect.any(String),
        displayName: 'Igor',
      })
    );
  });

  it('creates a password-protected room when selected', async () => {
    mocks.createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('What should we call you?'), 'Ada');
    await user.click(screen.getByLabelText('Require a password to join'));
    await user.type(screen.getByLabelText('Room password'), 'secret phrase');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() =>
      expect(mocks.createRoom).toHaveBeenCalledWith({
        gameType: 'trivia',
        sessionToken: expect.any(String),
        displayName: 'Ada',
        password: 'secret phrase',
      })
    );
  });

  it('labels community games and shows only their database author', () => {
    mocks.catalog[0] = {
      ...mocks.catalog[0],
      name: 'Neighborhood Trivia',
      author: { name: 'Grace Hopper', url: 'https://example.com/grace' },
      source: 'community',
    };

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    const communityGame = screen.getByRole('button', { name: /Neighborhood Trivia/ });
    expect(communityGame).toHaveTextContent('Community game');
    expect(communityGame).toHaveTextContent('by Grace Hopper');
    expect(screen.queryByText('by Xup Games')).not.toBeInTheDocument();
  });
});
