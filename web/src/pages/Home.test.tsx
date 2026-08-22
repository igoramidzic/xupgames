import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home, { HOME_PREVIEW_FADE_MS, HOME_PREVIEW_HOLD_MS } from './Home';

const mocks = vi.hoisted(() => ({
  createRoom: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useMutation: () => mocks.createRoom,
}));

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.createRoom.mockReset();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates rooms from only a name and optional password', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /One link.*Everyone plays\./ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeInTheDocument();
    expect(screen.getByLabelText('What should we call you?')).toBeInTheDocument();
    expect(screen.getByLabelText('Require a password to join')).toBeInTheDocument();
    expect(screen.queryByText('Choose a game')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trivia/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'A preview of a Doodle Dash drawing turn' })).toBeInTheDocument();
  });

  it('starts randomly, then fades through every game preview', () => {
    vi.useFakeTimers();
    vi.mocked(Math.random).mockReturnValue(0.99);
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('region', { name: 'A preview of drawing a real-world historical trend' })
    ).toBeInTheDocument();
    const carousel = document.querySelector('[data-preview-carousel]');
    expect(carousel).toHaveAttribute('data-visible', 'true');

    act(() => vi.advanceTimersByTime(HOME_PREVIEW_HOLD_MS));
    expect(carousel).toHaveAttribute('data-visible', 'false');
    expect(
      screen.getByRole('region', { name: 'A preview of drawing a real-world historical trend' })
    ).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(HOME_PREVIEW_FADE_MS));
    expect(carousel).toHaveAttribute('data-visible', 'true');
    expect(screen.getByRole('region', { name: 'A preview of a Doodle Dash drawing turn' })).toBeInTheDocument();

    expect(Math.random).toHaveBeenCalledTimes(1);
  });

  it('creates a game-neutral room and moves the choice into the room', async () => {
    mocks.createRoom.mockResolvedValue({ code: 'ABCDEFGH' });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('What should we call you?'), 'Grace');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));

    await waitFor(() =>
      expect(mocks.createRoom).toHaveBeenCalledWith({
        sessionToken: expect.any(String),
        displayName: 'Grace',
      })
    );
  });

  it('creates a password-protected room without selecting a game', async () => {
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
        sessionToken: expect.any(String),
        displayName: 'Ada',
        password: 'secret phrase',
      })
    );
  });
});
