import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Admin from './Admin';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  mutationIndex: 0,
}));

vi.mock('convex/react', () => ({
  useMutation: () => {
    const mutation = mocks.mutationIndex % 2 === 0 ? mocks.start : mocks.stop;
    mocks.mutationIndex += 1;
    return mutation;
  },
  useQuery: (...args: unknown[]) => mocks.query(...args),
}));

describe('playtest admin panel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('xupgames:guest-session', crypto.randomUUID());
    window.localStorage.setItem('xupgames:display-name', 'Ada');
    mocks.start.mockReset();
    mocks.stop.mockReset();
    mocks.mutationIndex = 0;
    mocks.query.mockReset();
    mocks.query.mockReturnValue({
      kind: 'room',
      room: {
        roomId: 'room-id',
        code: 'ABCDEFGH',
        gameType: 'drawing',
        status: 'open',
        activeMemberCount: 1,
        humanMemberCount: 1,
        maxPlayers: 50,
      },
      latestRun: null,
    });
  });

  it('starts a bounded run for the selected target room size', async () => {
    mocks.start.mockResolvedValue({ runId: 'run-id' });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/ABCDEFGH']}>
        <Routes>
          <Route path="/admin/:code" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Fill the table. Watch the game bend.' })).toBeInTheDocument();
    expect(screen.getByText('1 seats occupied')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '25 seats' }));
    await user.click(screen.getByRole('button', { name: 'Fill to 25 players' }));

    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith({
        code: 'ABCDEFGH',
        sessionToken: expect.any(String),
        targetActiveMemberCount: 25,
        durationMs: 120_000,
      })
    );
  });

  it('keeps the selected target after the room fills', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/admin/ABCDEFGH']}>
        <Routes>
          <Route path="/admin/:code" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    );

    mocks.query.mockReturnValue({
      kind: 'room',
      room: {
        roomId: 'room-id',
        code: 'ABCDEFGH',
        gameType: 'drawing',
        status: 'open',
        activeMemberCount: 10,
        humanMemberCount: 1,
        maxPlayers: 50,
      },
      latestRun: {
        runId: 'run-id',
        gameType: 'drawing',
        status: 'running',
        isActive: true,
        requestedBotCount: 9,
        provisionedBotCount: 9,
        activeBotCount: 9,
        durationMs: 120_000,
        startedAt: Date.now(),
        endsAt: Date.now() + 120_000,
        lastTickAt: Date.now(),
        stoppedAt: null,
        stopReason: null,
      },
    });
    rerender(
      <MemoryRouter initialEntries={['/admin/ABCDEFGH']}>
        <Routes>
          <Route path="/admin/:code" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: '10 seats' })).toHaveAttribute('data-selected', 'true');
    expect(screen.getByRole('button', { name: '25 seats' })).toHaveAttribute('data-selected', 'false');
  });
});
