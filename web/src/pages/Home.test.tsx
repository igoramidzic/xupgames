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

  it('renders the drawing room creation flow', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Draw over.*each other\./ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a room' })).toBeInTheDocument();
    expect(screen.getByLabelText('What should we call you?')).toBeInTheDocument();
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
        sessionToken: expect.any(String),
        displayName: 'Ada',
        password: 'secret phrase',
      })
    );
  });
});
