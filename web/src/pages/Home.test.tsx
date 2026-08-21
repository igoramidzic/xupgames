import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home';

const createRoom = vi.hoisted(() => vi.fn());

vi.mock('convex/react', () => ({
  useMutation: () => createRoom,
}));

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear();
    createRoom.mockReset();
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
    expect(screen.getByRole('button', { name: /Drawing/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Trivia/ })).toHaveAttribute('aria-pressed', 'false');

    const main = screen.getByRole('main');
    const preview = screen.getByLabelText('A preview of the shared drawing canvas');
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

    await user.click(screen.getByRole('button', { name: /Trivia/ }));

    const triviaPreview = screen.getByRole('heading', {
      name: 'Which planet has an axial tilt of roughly 98 degrees?',
    }).parentElement;
    expect(triviaPreview).not.toHaveClass('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-300');
  });

  it('creates a trivia room when trivia is selected', async () => {
    createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
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
      expect(createRoom).toHaveBeenCalledWith({
        gameType: 'trivia',
        sessionToken: expect.any(String),
        displayName: 'Grace',
      })
    );
  });

  it('creates a type racer room when type racer is selected', async () => {
    createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Type racer/ }));
    await user.type(screen.getByLabelText('What should we call you?'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() =>
      expect(createRoom).toHaveBeenCalledWith({
        gameType: 'typeRacer',
        sessionToken: expect.any(String),
        displayName: 'Ada',
      })
    );
  });

  it('creates a password-protected room when selected', async () => {
    createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
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
      expect(createRoom).toHaveBeenCalledWith({
        gameType: 'drawing',
        sessionToken: expect.any(String),
        displayName: 'Ada',
        password: 'secret phrase',
      })
    );
  });
});
