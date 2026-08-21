import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveGuest } from '@/lib/guest';
import Room from './Room';

const mocks = vi.hoisted(() => ({
  joinRoom: vi.fn(),
  query: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useMutation: () => mocks.joinRoom,
  useQuery: (...args: unknown[]) => mocks.query(...args),
}));

vi.mock('@/games/GameRoom', () => ({ default: () => <div>Trivia room</div> }));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess } }));

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
        gameType: 'trivia',
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
    await user.click(screen.getByRole('button', { name: 'Join the quiz' }));

    await waitFor(() =>
      expect(mocks.joinRoom).toHaveBeenCalledWith({
        code: 'ABCDEFGH',
        sessionToken: expect.any(String),
        displayName: 'Grace',
        password: 'secret phrase',
      })
    );
  });

  it('notifies a transferred owner', async () => {
    window.sessionStorage.clear();
    saveGuest('Ada');
    mocks.toastSuccess.mockReset();
    mocks.query
      .mockReset()
      .mockReturnValueOnce({
        kind: 'room',
        code: 'ABCDEFGH',
        gameType: 'trivia',
        status: 'open',
        activeMemberCount: 2,
        maxPlayers: 50,
        ownerName: 'Ada',
        isPasswordProtected: false,
      })
      .mockReturnValueOnce({
        kind: 'session',
        roomId: 'room-1',
        code: 'ABCDEFGH',
        gameType: 'trivia',
        currentGameId: 'room-game-1',
        status: 'open',
        activeMemberCount: 2,
        maxPlayers: 50,
        isOwner: true,
        ownershipVersion: 1,
        ownershipReason: 'transferred',
        currentMember: {
          memberId: 'member-ada',
          displayName: 'Ada',
          isActive: true,
          joinedAt: 1,
          leftAt: null,
        },
        members: [
          {
            memberId: 'member-ada',
            displayName: 'Ada',
            isOwner: true,
            isActive: true,
            joinedAt: 1,
            leftAt: null,
          },
          {
            memberId: 'member-grace',
            displayName: 'Grace',
            isOwner: false,
            isActive: true,
            joinedAt: 2,
            leftAt: null,
          },
        ],
      });

    render(
      <MemoryRouter initialEntries={['/r/ABCDEFGH']}>
        <Routes>
          <Route path="/r/:code" element={<Room />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "You're the room owner now",
        expect.objectContaining({ description: expect.stringContaining('previous owner left') })
      )
    );
  });
});
