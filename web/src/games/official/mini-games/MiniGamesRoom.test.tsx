import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MiniGamesRoom from './MiniGamesRoom';

const mocks = vi.hoisted(() => ({
  game: undefined as unknown,
  mutation: vi.fn(async () => undefined),
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.game,
  useMutation: () => mocks.mutation,
}));

vi.mock('@/lib/useRoomPresence', () => ({ useRoomPresence: () => ({ onlineByMemberId: new Map() }) }));
vi.mock('@/components/GameModeControl', () => ({
  default: () => null,
  GameModeContent: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/GameSurfaceTransition', () => ({
  default: ({
    children,
    showResults,
    results,
  }: {
    children: React.ReactNode;
    showResults: boolean;
    results: (args: { playIntro: boolean }) => React.ReactNode;
  }) => <div data-game-surface-transition>{showResults ? results({ playIntro: false }) : children}</div>,
}));

const session = {
  kind: 'session',
  roomId: 'room-1',
  currentGameId: 'room-game-1',
  gameType: 'miniGames',
  code: 'ABCDEFGH',
  status: 'open',
  isOwner: true,
  memberId: 'member-1',
  currentMember: {
    memberId: 'member-1',
    displayName: 'Igor',
    isOwner: true,
    isActive: true,
    leftAt: null,
  },
  activeMemberCount: 1,
  members: [
    {
      memberId: 'member-1',
      displayName: 'Igor',
      isOwner: true,
      isActive: true,
      leftAt: null,
    },
  ],
};
const guest = { sessionToken: 'a'.repeat(32), displayName: 'Igor' };
const baseGame = {
  gameNumber: 0,
  phase: 'lobby',
  phaseStartedAt: null,
  phaseEndsAt: null,
  currentRoundNumber: 0,
  totalRounds: 10,
  participantCount: 0,
  finishedCount: 0,
  estimatedDurationMs: 172_000,
  configuration: {
    roundCount: 10,
    roundOptions: [
      { roundCount: 10, estimatedDurationMs: 172_000 },
      { roundCount: 15, estimatedDurationMs: 258_000 },
      { roundCount: 20, estimatedDurationMs: 344_000 },
      { roundCount: 25, estimatedDurationMs: 430_000 },
    ],
  },
  miniGames: [
    { id: 'straightLine', title: 'Draw a straight line', eyebrow: 'Steady hand', instructions: 'Draw it.' },
    {
      id: 'orangeEmojis',
      title: 'Find this emoji',
      eyebrow: 'Match maker',
      instructions: 'Click every copy of the emoji shown above the board.',
    },
    { id: 'guessPercentage', title: 'Guess the percentage', eyebrow: 'Slice sense', instructions: 'Estimate it.' },
    { id: 'circleCenter', title: 'Click the circle center', eyebrow: 'Bullseye', instructions: 'Find it.' },
    { id: 'batteryPercentage', title: 'Guess the battery', eyebrow: 'Charge check', instructions: 'Estimate it.' },
  ],
  round: null,
  currentResult: null,
  roundResults: [],
  standings: [
    {
      rank: 1,
      memberId: 'member-1',
      displayName: 'Igor',
      totalScore: 0,
      roundsFinished: 0,
      isCurrentPlayer: true,
      isActive: true,
    },
  ],
};

describe('MiniGamesRoom', () => {
  beforeEach(() => {
    mocks.mutation.mockClear();
    mocks.game = baseGame;
  });

  it('shows the configured playlist length and calculated full duration', () => {
    render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Tiny games.*One big score/ })).toBeInTheDocument();
    expect(screen.getAllByText('10 mini-games').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Mini Game Mix game configuration' })).toHaveTextContent('About 3 min');
    expect(screen.getByRole('button', { name: 'Start the mix' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Mini Game Mix game configuration' })).toContainElement(
      screen.getByRole('button', { name: 'Configure' })
    );
    expect(screen.getByRole('region', { name: 'Mini Game Mix game configuration' })).toHaveTextContent(
      '5 challenges in rotation'
    );
  });

  it('renders the synchronized spinner with a staged ease-in', async () => {
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'selecting',
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 3_200,
      currentRoundNumber: 2,
      round: {
        roundId: 'round-2',
        roundNumber: 2,
        miniGame: baseGame.miniGames[1],
        selectionStartedAt: Date.now(),
        playStartsAt: Date.now() + 3_200,
        playEndsAt: Date.now() + 13_200,
        lineTarget: null,
        emojiItems: [],
        targetEmoji: '🍊',
        targetCount: 5,
      },
    };
    const view = render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Spin the mix.' })).toBeInTheDocument();
    expect(screen.getByText('Round 2 · Picking the next challenge')).toBeInTheDocument();
    expect(screen.getAllByText('Find this emoji').length).toBeGreaterThan(1);
    await waitFor(() =>
      expect(view.container.querySelector('[data-roulette-track="true"]')).toHaveStyle({
        transition: 'transform 2400ms cubic-bezier(.42,0,.18,1) 420ms',
      })
    );
  });

  it('shows each mini-game score before the next spinner', () => {
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'roundResults',
      currentRoundNumber: 1,
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 4_000,
      round: {
        roundId: 'round-1',
        roundNumber: 1,
        miniGame: baseGame.miniGames[0],
        selectionStartedAt: Date.now() - 13_000,
        playStartsAt: Date.now() - 10_000,
        playEndsAt: Date.now(),
        lineTarget: { start: { x: 0.1, y: 0.2 }, end: { x: 0.9, y: 0.8 } },
        emojiItems: [],
        targetEmoji: null,
        targetCount: 0,
      },
      roundResults: [
        {
          memberId: 'member-1',
          displayName: 'Igor',
          status: 'finished',
          score: 920,
          timeMs: 2_100,
          straightness: 98,
          correctClicks: 0,
          wrongClicks: 0,
          isCurrentPlayer: true,
          isActive: true,
        },
      ],
    };
    render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByText('Steady hand · Round 1 of 10 · Scores')).toBeInTheDocument();
    expect(screen.getByText('+920')).toBeInTheDocument();
    expect(screen.getByText('98% straight · 2.1s')).toBeInTheDocument();
    const timer = screen.getByRole('timer', { name: /Next spin: \d seconds/ });
    expect(timer).toHaveClass('rounded-full');
    expect(timer.getAttribute('style')).toContain('--countdown-progress:');
    expect(screen.queryByText(/Next spin in/)).not.toBeInTheDocument();
  });

  it('keeps the card shell mounted and uses the same header layout from play to scores', () => {
    const round = {
      roundId: 'round-percentage',
      roundNumber: 1,
      miniGame: baseGame.miniGames[2],
      selectionStartedAt: Date.now() - 3_200,
      playStartsAt: Date.now(),
      playEndsAt: Date.now() + 10_000,
      lineTarget: null,
      emojiItems: [],
      targetEmoji: null,
      targetCount: 0,
      percentageTargetColor: 'coral',
      percentageSegments: [
        { color: 'coral', percentage: 42 },
        { color: 'gold', percentage: 28 },
        { color: 'mint', percentage: 30 },
      ],
      batteryPercentage: null,
      circleTarget: null,
      distancePlaces: null,
      mapTargetName: null,
      mapAnswerPoint: null,
      numericAnswer: null,
    };
    const playingGame = {
      ...baseGame,
      gameNumber: 1,
      phase: 'playing',
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 10_000,
      currentRoundNumber: 1,
      participantCount: 1,
      round,
    };
    mocks.game = playingGame;
    const view = render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const card = view.container.querySelector<HTMLElement>('[data-mini-game-surface-card]');
    const playHeader = view.container.querySelector<HTMLElement>('[data-mini-game-round-header]');
    const transition = view.container.querySelector<HTMLElement>('[data-game-surface-transition]');
    expect(card).not.toBeNull();
    expect(playHeader).not.toBeNull();
    expect(card).toContainElement(transition);

    mocks.game = {
      ...playingGame,
      phase: 'roundResults',
      phaseEndsAt: Date.now() + 4_000,
      roundResults: [],
    };
    view.rerender(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const scoreCard = view.container.querySelector<HTMLElement>('[data-mini-game-surface-card]');
    const scoreHeader = view.container.querySelector<HTMLElement>('[data-mini-game-round-header]');
    expect(scoreCard).toBe(card);
    expect(scoreHeader).not.toBeNull();
    expect(scoreHeader?.className).toBe(playHeader?.className);
    expect(scoreHeader).toHaveTextContent('Slice sense · Round 1 of 10 · Scores');
  });

  it('shows the random target and submits after every matching copy is clicked', async () => {
    const user = userEvent.setup();
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'playing',
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 10_000,
      currentRoundNumber: 1,
      participantCount: 1,
      round: {
        roundId: 'round-emoji',
        roundNumber: 1,
        miniGame: baseGame.miniGames[1],
        selectionStartedAt: Date.now() - 3_200,
        playStartsAt: Date.now(),
        playEndsAt: Date.now() + 10_000,
        lineTarget: null,
        targetEmoji: '🐸',
        targetCount: 2,
        emojiItems: [
          { id: 'wrong', emoji: '🍊', color: 'orange', x: 0.2, y: 0.2, rotation: 0 },
          { id: 'target-1', emoji: '🐸', color: 'green', x: 0.5, y: 0.4, rotation: 4 },
          { id: 'other', emoji: '🫐', color: 'blue', x: 0.75, y: 0.65, rotation: -4 },
          { id: 'target-2', emoji: '🐸', color: 'green', x: 0.3, y: 0.8, rotation: 2 },
        ],
      },
      currentResult: {
        memberId: 'member-1',
        displayName: 'Igor',
        status: 'waiting',
        score: 0,
        timeMs: null,
        straightness: null,
        correctClicks: 0,
        wrongClicks: 0,
        isCurrentPlayer: true,
        isActive: true,
      },
    };

    render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(screen.getByRole('timer', { name: /Time remaining: \d+ seconds/ }).getAttribute('style')).toContain(
      '--countdown-progress:'
    );
    expect(screen.getByLabelText('Target emoji 🐸')).toBeInTheDocument();
    expect(screen.getByText('Find this emoji:')).toBeInTheDocument();
    expect(screen.getByText('0 of 2 found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '🍊 emoji 1' }));
    await user.click(screen.getByRole('button', { name: '🐸 emoji 2' }));
    expect(mocks.mutation).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '🐸 emoji 4' }));

    await waitFor(() =>
      expect(mocks.mutation).toHaveBeenCalledWith({
        roomId: 'room-1',
        sessionToken: guest.sessionToken,
        clickedIds: ['wrong', 'target-1', 'target-2'],
      })
    );
  });

  it('renders the percentage dial and submits the selected estimate', async () => {
    const user = userEvent.setup();
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'playing',
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 10_000,
      currentRoundNumber: 1,
      participantCount: 1,
      round: {
        roundId: 'round-percentage',
        roundNumber: 1,
        miniGame: baseGame.miniGames[2],
        selectionStartedAt: Date.now() - 3_200,
        playStartsAt: Date.now(),
        playEndsAt: Date.now() + 10_000,
        lineTarget: null,
        emojiItems: [],
        targetEmoji: null,
        targetCount: 0,
        percentageTargetColor: 'coral',
        percentageSegments: [
          { color: 'coral', percentage: 42 },
          { color: 'gold', percentage: 28 },
          { color: 'mint', percentage: 30 },
        ],
        batteryPercentage: null,
        circleTarget: null,
        distancePlaces: null,
        mapTargetName: null,
        mapAnswerPoint: null,
        numericAnswer: null,
      },
      currentResult: {
        memberId: 'member-1',
        displayName: 'Igor',
        status: 'waiting',
        score: 0,
        timeMs: null,
        straightness: null,
        correctClicks: 0,
        wrongClicks: 0,
        metric: null,
        numericGuess: null,
        isCurrentPlayer: true,
        isActive: true,
      },
    };
    render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByRole('img', { name: 'A three-color pie chart' })).toBeInTheDocument();
    const estimate = screen.getByLabelText('Your estimate');
    expect(estimate).toHaveAttribute('type', 'number');
    expect(estimate).toHaveAttribute('max', '100');
    expect(estimate).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Lock it in' })).toBeDisabled();
    fireEvent.change(estimate, { target: { value: '42' } });
    await user.click(screen.getByRole('button', { name: 'Lock it in' }));
    expect(mocks.mutation).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: guest.sessionToken,
      guess: 42,
    });
  });
});
