import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TrendlineRoom from './TrendlineRoom';

const mocks = vi.hoisted(() => ({
  game: null as Record<string, unknown> | null,
  mutationIndex: 0,
  startGame: vi.fn(),
  submitPrediction: vi.fn(),
  revealHint: vi.fn(),
  leaveRoom: vi.fn(),
  closeRoom: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.game,
  useAction: () => mocks.startGame,
  useMutation: () => {
    const mutations = [mocks.submitPrediction, mocks.revealHint, mocks.leaveRoom, mocks.closeRoom];
    const mutation = mutations[mocks.mutationIndex % mutations.length];
    mocks.mutationIndex += 1;
    return mutation;
  },
}));

vi.mock('@/lib/useRoomPresence', () => ({
  useRoomPresence: () => ({ onlineByMemberId: new Map([['member-1', true]]) }),
}));

vi.mock('@/lib/environment', () => ({ isLocalhost: () => false }));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Igor' };
const session = {
  kind: 'session' as const,
  roomId: 'room-1',
  code: 'ABCDEFGH',
  gameType: 'trendline' as const,
  currentGameId: 'room-game-1',
  status: 'open' as const,
  activeMemberCount: 1,
  maxPlayers: 50,
  isOwner: true,
  ownershipVersion: 0,
  ownershipReason: 'created' as const,
  currentMember: { memberId: 'member-1', displayName: 'Igor', isActive: true, joinedAt: 1, leftAt: null },
  members: [{ memberId: 'member-1', displayName: 'Igor', isOwner: true, isActive: true, joinedAt: 1, leftAt: null }],
};

function drawingGame() {
  return {
    gameNumber: 1,
    phase: 'drawing',
    currentRoundNumber: 1,
    totalRounds: 6,
    phaseStartedAt: Date.now() - 1_000,
    phaseEndsAt: Date.now() + 60_000,
    round: {
      roundId: 'round-1',
      roundNumber: 1,
      countryCode: 'BRA',
      countryName: 'Brazil',
      indicatorCode: 'IT.NET.USER.ZS',
      indicatorName: 'Individuals using the Internet',
      category: 'Technology',
      unitLabel: '% of population',
      valueDecimals: 0,
      axisMin: 0,
      axisMax: 100,
      startYear: 2000,
      endYear: 2023,
      firstValue: 0.1,
      actualValues: null,
      crowdMedianValues: null,
      hintedEndValue: null,
      submittedCount: 0,
      source: null,
    },
    playerPrediction: null,
    leaderboard: [
      {
        rank: 1,
        memberId: 'member-1',
        displayName: 'Igor',
        totalPoints: 0,
        roundsSubmitted: 0,
        bestRoundPoints: 0,
        pointsGained: null,
        isCurrentPlayer: true,
        isActive: true,
      },
    ],
  };
}

describe('TrendlineRoom', () => {
  beforeEach(() => {
    mocks.mutationIndex = 0;
    mocks.startGame.mockReset().mockResolvedValue({ gameNumber: 1, startsAt: Date.now() + 3_000 });
    mocks.submitPrediction.mockReset().mockResolvedValue(null);
    mocks.revealHint.mockReset().mockResolvedValue({ endValue: 0.9 });
    mocks.leaveRoom.mockReset();
    mocks.closeRoom.mockReset();
  });

  it('identifies the game as community-made and starts the game', async () => {
    mocks.game = {
      gameNumber: 0,
      phase: 'lobby',
      currentRoundNumber: 0,
      totalRounds: 6,
      phaseStartedAt: null,
      phaseEndsAt: null,
      round: null,
      playerPrediction: null,
      leaderboard: [],
    };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TrendlineRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByText('Community game · Igor Amidzic')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(mocks.startGame).toHaveBeenCalledWith({ roomId: 'room-1', sessionToken: guest.sessionToken });
  });

  it('draws directly on the chart and submits exactly 24 normalized values', async () => {
    mocks.game = drawingGame();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TrendlineRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Individuals using the Internet in Brazil' })).toBeInTheDocument();
    const chart = screen.getByRole('img', { name: /Prediction chart/ });
    expect(chart).toHaveClass('touch-none');
    expect(screen.queryByLabelText('Prediction year')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Prediction value')).not.toBeInTheDocument();
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 720,
      height: 360,
      right: 720,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    Object.assign(chart, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
    fireEvent.pointerDown(chart, { clientX: 240, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(chart, { pointerId: 1 });
    const lockButton = screen.getByRole('button', { name: 'Lock line' });
    expect(lockButton).toBeEnabled();
    await user.click(lockButton);
    await waitFor(() => expect(mocks.submitPrediction).toHaveBeenCalledTimes(1));
    const request = mocks.submitPrediction.mock.calls[0][0];
    expect(request.values).toHaveLength(24);
    expect(request.values.every((value: number) => value >= 0 && value <= 1)).toBe(true);
  });

  it('keeps its main layout usable at the 320px breakpoint', () => {
    mocks.game = drawingGame();
    render(
      <MemoryRouter>
        <TrendlineRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByRole('main')).toHaveClass('max-[620px]:p-2.5');
    expect(screen.queryByLabelText('Prediction year')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Prediction value')).not.toBeInTheDocument();
  });
});
