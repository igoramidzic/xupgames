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

  it('keeps trivia bots until the owner removes them without a duration control', async () => {
    mocks.start.mockResolvedValue({ runId: 'run-id' });
    const user = userEvent.setup();
    mocks.query.mockReturnValue({
      kind: 'room',
      room: {
        roomId: 'room-id',
        code: 'ABCDEFGH',
        gameType: 'trivia',
        status: 'open',
        activeMemberCount: 1,
        humanMemberCount: 1,
        maxPlayers: 50,
      },
      latestRun: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/ABCDEFGH']}>
        <Routes>
          <Route path="/admin/:code" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Trivia answer adapter')).toBeInTheDocument();
    expect(screen.queryByText('Run for')).not.toBeInTheDocument();
    expect(screen.getByText('Players stay')).toBeInTheDocument();
    expect(screen.getByText('Until you remove them')).toBeInTheDocument();
    expect(screen.getByText(/stay at the table until you remove them/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fill to 10 players' }));

    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith({
        code: 'ABCDEFGH',
        sessionToken: expect.any(String),
        targetActiveMemberCount: 10,
      })
    );
  });

  it('lets the owner explicitly remove persistent trivia players', async () => {
    mocks.stop.mockResolvedValue(null);
    const user = userEvent.setup();
    mocks.query.mockReturnValue({
      kind: 'room',
      room: {
        roomId: 'room-id',
        code: 'ABCDEFGH',
        gameType: 'trivia',
        status: 'open',
        activeMemberCount: 10,
        humanMemberCount: 1,
        maxPlayers: 50,
      },
      latestRun: {
        runId: 'run-id',
        gameType: 'trivia',
        status: 'running',
        isActive: true,
        requestedBotCount: 9,
        provisionedBotCount: 9,
        activeBotCount: 9,
        durationMs: null,
        startedAt: Date.now(),
        endsAt: null,
        lastTickAt: Date.now(),
        stoppedAt: null,
        stopReason: null,
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin/ABCDEFGH']}>
        <Routes>
          <Route path="/admin/:code" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Remove players' }));
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledWith({ runId: 'run-id', sessionToken: expect.any(String) }));
  });

  it('keeps type racer bots across races without a duration control', async () => {
    mocks.start.mockResolvedValue({ runId: 'run-id' });
    const user = userEvent.setup();
    mocks.query.mockReturnValue({
      kind: 'room',
      room: {
        roomId: 'room-id',
        code: 'ABCDEFGH',
        gameType: 'typeRacer',
        status: 'open',
        activeMemberCount: 1,
        humanMemberCount: 1,
        maxPlayers: 50,
      },
      latestRun: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/ABCDEFGH']}>
        <Routes>
          <Route path="/admin/:code" element={<Admin />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Type racer adapter')).toBeInTheDocument();
    expect(screen.queryByText('Run for')).not.toBeInTheDocument();
    expect(screen.getByText('Players stay')).toBeInTheDocument();
    expect(screen.getByText('Until you remove them')).toBeInTheDocument();
    expect(screen.getByText(/type in every race/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fill to 10 players' }));

    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith({
        code: 'ABCDEFGH',
        sessionToken: expect.any(String),
        targetActiveMemberCount: 10,
      })
    );
  });
});
