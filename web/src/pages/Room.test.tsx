import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Room from './Room';

const mocks = vi.hoisted(() => ({
  joinRoom: vi.fn(),
  query: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useMutation: () => mocks.joinRoom,
  usePaginatedQuery: vi.fn(),
  useQuery: (...args: unknown[]) => mocks.query(...args),
}));

describe('Room join flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.joinRoom.mockReset();
    mocks.query.mockReset();
    mocks.query.mockImplementation((_reference, args) => {
      if (args === 'skip' || (typeof args === 'object' && args !== null && 'sessionToken' in args)) {
        return undefined;
      }
      return {
        kind: 'room',
        code: 'ABCDEFGH',
        status: 'open',
        activeMemberCount: 1,
        maxPlayers: 50,
        ownerName: 'Ada',
        isPasswordProtected: true,
      };
    });
  });

  it('requires and submits the room password for a protected room', async () => {
    mocks.joinRoom.mockResolvedValue({ code: 'ABCDEFGH' });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/r/ABCDEFGH']}>
        <Routes>
          <Route path="/r/:code" element={<Room />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Password protected')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your name'), 'Grace');
    await user.type(screen.getByLabelText('Room password'), 'secret phrase');
    await user.click(screen.getByRole('button', { name: 'Join the canvas' }));

    await waitFor(() =>
      expect(mocks.joinRoom).toHaveBeenCalledWith({
        code: 'ABCDEFGH',
        sessionToken: expect.any(String),
        displayName: 'Grace',
        password: 'secret phrase',
      })
    );
  });
});
