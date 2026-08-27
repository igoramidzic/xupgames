import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  estimatedDurationMs: 212_000,
  configuration: {
    roundCount: 10,
    roundOptions: [
      { roundCount: 10, estimatedDurationMs: 212_000 },
      { roundCount: 15, estimatedDurationMs: 318_000 },
      { roundCount: 20, estimatedDurationMs: 424_000 },
      { roundCount: 25, estimatedDurationMs: 530_000 },
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
    { id: 'flashbackTiles', title: 'Flashback Tiles', eyebrow: 'Visual memory', instructions: 'Remember it.' },
    { id: 'copycatSequence', title: 'Copycat Sequence', eyebrow: 'Pattern recall', instructions: 'Repeat it.' },
    { id: 'crowdCount', title: 'Crowd Count', eyebrow: 'Keep count', instructions: 'Count them.' },
    { id: 'dropZone', title: 'Drop Zone', eyebrow: 'Perfect timing', instructions: 'Drop it.' },
    { id: 'shadowMatch', title: 'Shadow Match', eyebrow: 'Shape finder', instructions: 'Match it.' },
    { id: 'flagFrenzy', title: 'Flag Frenzy', eyebrow: 'Quick match', instructions: 'Match it.' },
    { id: 'brakeCheck', title: 'Brake Check', eyebrow: 'Hold and release', instructions: 'Stop it.' },
    { id: 'signalSnap', title: 'Signal Snap', eyebrow: 'Reaction test', instructions: 'Tap it.' },
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
    expect(screen.getByRole('region', { name: 'Mini Game Mix game configuration' })).toHaveTextContent('About 3½ min');
    expect(screen.getByRole('button', { name: 'Start the mix' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Mini Game Mix game configuration' })).toContainElement(
      screen.getByRole('button', { name: 'Configure' })
    );
    expect(screen.getByRole('region', { name: 'Mini Game Mix game configuration' })).toHaveTextContent(
      '13 challenges in rotation'
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
    expect(screen.getAllByText('Find this emoji').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(view.container.querySelector('[data-roulette-track="true"]')).toHaveStyle({
        transition: 'transform 2400ms cubic-bezier(.42,0,.18,1) 420ms',
      })
    );
  });

  it('shows the visual round replay with a three-second countdown before round winners', () => {
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'roundResults',
      currentRoundNumber: 1,
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 8_000,
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
          submission: {
            kind: 'straightLine',
            points: [
              { x: 0.1, y: 0.2 },
              { x: 0.5, y: 0.55 },
              { x: 0.9, y: 0.8 },
            ],
          },
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
    expect(screen.getByText('Steady hand · Round 1 of 10 · Replay')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Round replay' })).toHaveTextContent('Here’s how it lined up');
    expect(screen.getByRole('img', { name: 'Your line and the direct path' })).toBeInTheDocument();
    expect(screen.queryByText('100% straight')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Round scores' })).not.toBeInTheDocument();
    expect(screen.queryByText('+920')).not.toBeInTheDocument();
    const timer = screen.getByRole('timer', { name: /Round replay: 3 seconds/ });
    expect(timer).toHaveClass('rounded-full');
    expect(timer.getAttribute('style')).toContain('--countdown-progress:');
    expect(screen.queryByRole('heading', { name: 'Top players this game' })).not.toBeInTheDocument();
  });

  it('replaces the inline full standings with the top three players after the answer reveal', () => {
    const now = Date.now();
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'roundResults',
      currentRoundNumber: 1,
      phaseStartedAt: now - 3_500,
      phaseEndsAt: now + 4_500,
      round: {
        roundId: 'round-percentage-results',
        roundNumber: 1,
        miniGame: baseGame.miniGames[2],
        selectionStartedAt: now - 13_200,
        playStartsAt: now - 10_000,
        playEndsAt: now,
        lineTarget: null,
        emojiItems: [],
        targetEmoji: null,
        targetCount: 0,
        percentageTargetColor: 'coral',
        percentageSegments: [],
        batteryPercentage: null,
        circleTarget: null,
        distancePlaces: null,
        mapTargetName: null,
        mapAnswerPoint: null,
        numericAnswer: 42,
        challengePayload: null,
      },
      roundResults: [
        {
          memberId: 'member-2',
          displayName: 'Maya',
          status: 'finished',
          score: 980,
          timeMs: 2_000,
          straightness: null,
          correctClicks: 0,
          wrongClicks: 0,
          metric: 0,
          numericGuess: 42,
          challengeResult: null,
          isCurrentPlayer: false,
          isActive: true,
        },
        {
          memberId: 'member-1',
          displayName: 'Igor',
          status: 'finished',
          score: 870,
          timeMs: 2_400,
          straightness: null,
          correctClicks: 0,
          wrongClicks: 0,
          metric: 3,
          numericGuess: 39,
          challengeResult: null,
          isCurrentPlayer: true,
          isActive: true,
        },
        {
          memberId: 'member-3',
          displayName: 'Theo',
          status: 'finished',
          score: 650,
          timeMs: 3_000,
          straightness: null,
          correctClicks: 0,
          wrongClicks: 0,
          metric: 8,
          numericGuess: 50,
          challengeResult: null,
          isCurrentPlayer: false,
          isActive: true,
        },
        {
          memberId: 'member-4',
          displayName: 'Lin',
          status: 'finished',
          score: 400,
          timeMs: 4_000,
          straightness: null,
          correctClicks: 0,
          wrongClicks: 0,
          metric: 15,
          numericGuess: 57,
          challengeResult: null,
          isCurrentPlayer: false,
          isActive: true,
        },
      ],
      standings: [
        { ...baseGame.standings[0], rank: 1, totalScore: 870, roundsFinished: 1 },
        {
          ...baseGame.standings[0],
          memberId: 'member-2',
          displayName: 'Maya',
          rank: 2,
          totalScore: 980,
          roundsFinished: 1,
          isCurrentPlayer: false,
        },
        {
          ...baseGame.standings[0],
          memberId: 'member-3',
          displayName: 'Theo',
          rank: 3,
          totalScore: 650,
          roundsFinished: 1,
          isCurrentPlayer: false,
        },
        {
          ...baseGame.standings[0],
          memberId: 'member-4',
          displayName: 'Lin',
          rank: 4,
          totalScore: 400,
          roundsFinished: 1,
          isCurrentPlayer: false,
        },
      ],
    };

    render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const podium = screen.getByRole('list', { name: 'Top players this round' });
    expect(screen.getByRole('heading', { name: 'Top players this game' })).toBeInTheDocument();
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3);
    expect(within(podium).getByText('Maya')).toBeInTheDocument();
    expect(within(podium).queryByText('Lin')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Round scores' })).not.toBeInTheDocument();
    expect(screen.getByRole('timer', { name: /Next spin: 5 seconds/ })).toBeInTheDocument();
  });

  it('reopens Flashback Tiles with correct tiles green and incorrect picks red', () => {
    const now = Date.now();
    const currentResult = {
      memberId: 'member-1',
      displayName: 'Igor',
      status: 'finished',
      score: 700,
      timeMs: 3_000,
      straightness: null,
      correctClicks: 2,
      wrongClicks: 1,
      metric: null,
      numericGuess: null,
      challengeResult: { kind: 'flashbackTiles', correct: 2, wrong: 1, missed: 1 },
      submission: { kind: 'flashbackTiles', selectedTileIds: [0, 1, 4] },
      isCurrentPlayer: true,
      isActive: true,
    };
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'roundResults',
      currentRoundNumber: 1,
      phaseStartedAt: now,
      phaseEndsAt: now + 8_000,
      round: {
        roundId: 'round-flashback',
        roundNumber: 1,
        miniGame: baseGame.miniGames[5],
        selectionStartedAt: now - 13_200,
        playStartsAt: now - 10_000,
        playEndsAt: now,
        lineTarget: null,
        emojiItems: [],
        targetEmoji: null,
        targetCount: 0,
        percentageTargetColor: null,
        percentageSegments: [],
        batteryPercentage: null,
        circleTarget: null,
        distancePlaces: null,
        mapTargetName: null,
        mapAnswerPoint: null,
        numericAnswer: null,
        challengePayload: {
          kind: 'flashbackTiles',
          gridSize: 5,
          targetTileIds: [0, 2, 4],
          revealDurationMs: 1_650,
        },
      },
      currentResult,
      roundResults: [currentResult],
    };

    const view = render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const tile = (tileId: number) => view.container.querySelector(`[data-tile-id="${tileId}"]`);
    expect(screen.getByRole('img', { name: 'Revealed Flashback Tiles board' })).toBeInTheDocument();
    expect(tile(0)).toHaveAttribute('data-feedback', 'correct');
    expect(tile(0)).toHaveAttribute('data-selected', 'true');
    expect(tile(1)).toHaveAttribute('data-feedback', 'wrong');
    expect(tile(2)).toHaveAttribute('data-feedback', 'correct');
    expect(tile(2)).toHaveAttribute('data-selected', 'false');
    expect(tile(3)).toHaveAttribute('data-feedback', 'neutral');
    expect(screen.queryByText('1 · 3 · 5')).not.toBeInTheDocument();
  });

  it('shows Signal Snap as tap timing without calling any tap correct', () => {
    const now = Date.now();
    const currentResult = {
      memberId: 'member-1',
      displayName: 'Igor',
      status: 'finished',
      score: 850,
      timeMs: 8_000,
      straightness: null,
      correctClicks: 0,
      wrongClicks: 0,
      metric: null,
      numericGuess: null,
      challengeResult: { kind: 'signalSnap', medianMs: 240, falseStarts: 0 },
      submission: { kind: 'signalSnap', responseOffsetsMs: [1_590, 4_420, 7_260] },
      isCurrentPlayer: true,
      isActive: true,
    };
    mocks.game = {
      ...baseGame,
      gameNumber: 1,
      phase: 'roundResults',
      currentRoundNumber: 1,
      phaseStartedAt: now,
      phaseEndsAt: now + 8_000,
      round: {
        roundId: 'round-signal',
        roundNumber: 1,
        miniGame: baseGame.miniGames[12],
        selectionStartedAt: now - 13_200,
        playStartsAt: now - 10_000,
        playEndsAt: now,
        lineTarget: null,
        emojiItems: [],
        targetEmoji: null,
        targetCount: 0,
        percentageTargetColor: null,
        percentageSegments: [],
        batteryPercentage: null,
        circleTarget: null,
        distancePlaces: null,
        mapTargetName: null,
        mapAnswerPoint: null,
        numericAnswer: null,
        challengePayload: { kind: 'signalSnap', cueOffsetsMs: [1_350, 4_180, 7_020] },
      },
      currentResult,
      roundResults: [currentResult],
    };

    render(
      <MemoryRouter>
        <MiniGamesRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Here’s your tap timing' })).toBeInTheDocument();
    expect(screen.getByText('There is no correct tap—only your reaction time after each cue.')).toBeInTheDocument();
    expect(screen.queryByText('The correct answer was')).not.toBeInTheDocument();
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
      phaseStartedAt: Date.now() - 3_500,
      phaseEndsAt: Date.now() + 4_500,
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
    expect(scoreHeader).toHaveTextContent('Slice sense · Round 1 of 10 · Round winners');
  });

  it('holds pre-round sidebar scores in fixed lanes, then animates into the final order', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() }) as unknown as Animation);
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const top = Number(this.dataset.displayPosition ?? 0) * 100;
      return {
        x: 0,
        y: top,
        top,
        right: 300,
        bottom: top + 80,
        left: 0,
        width: 300,
        height: 80,
        toJSON: () => ({}),
      };
    });
    try {
      const now = Date.now();
      const round = {
        roundId: 'round-sidebar',
        roundNumber: 2,
        miniGame: baseGame.miniGames[2],
        selectionStartedAt: now - 5_000,
        playStartsAt: now - 2_000,
        playEndsAt: now + 8_000,
        lineTarget: null,
        emojiItems: [],
        targetEmoji: null,
        targetCount: 0,
        percentageTargetColor: 'coral',
        percentageSegments: [],
        batteryPercentage: null,
        circleTarget: null,
        distancePlaces: null,
        mapTargetName: null,
        mapAnswerPoint: null,
        numericAnswer: null,
        challengePayload: null,
      };
      const igorResult = {
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
        challengeResult: null,
        isCurrentPlayer: true,
        isActive: true,
      };
      const mayaResult = {
        ...igorResult,
        memberId: 'member-2',
        displayName: 'Maya',
        status: 'finished',
        score: 500,
        timeMs: 2_000,
        metric: 0,
        numericGuess: 42,
        isCurrentPlayer: false,
      };
      const theoResult = {
        ...igorResult,
        memberId: 'member-3',
        displayName: 'Theo',
        isCurrentPlayer: false,
      };
      mocks.game = {
        ...baseGame,
        gameNumber: 1,
        phase: 'playing',
        phaseStartedAt: now - 2_000,
        phaseEndsAt: now + 8_000,
        currentRoundNumber: 2,
        participantCount: 3,
        finishedCount: 1,
        round,
        currentResult: igorResult,
        roundResults: [igorResult, mayaResult, theoResult],
        standings: [
          {
            ...baseGame.standings[0],
            memberId: 'member-2',
            displayName: 'Maya',
            rank: 1,
            totalScore: 1_400,
            roundsFinished: 2,
            isCurrentPlayer: false,
          },
          { ...baseGame.standings[0], rank: 2, totalScore: 1_000, roundsFinished: 1 },
          {
            ...baseGame.standings[0],
            memberId: 'member-3',
            displayName: 'Theo',
            rank: 3,
            totalScore: 800,
            roundsFinished: 1,
            isCurrentPlayer: false,
          },
        ],
      };
      const view = render(
        <MemoryRouter>
          <MiniGamesRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );
      const sidebarRows = () =>
        within(screen.getByRole('list', { name: 'Player standings' }))
          .getAllByRole('listitem')
          .map((item) => item.textContent);

      expect(sidebarRows()).toEqual([
        expect.stringContaining('Igor'),
        expect.stringContaining('Maya'),
        expect.stringContaining('Theo'),
      ]);
      const mayaLiveRow = within(screen.getByRole('list', { name: 'Player standings' }))
        .getByText('Maya')
        .closest('li');
      expect(mayaLiveRow).toHaveTextContent('900');
      expect(mayaLiveRow).toHaveTextContent('1 rounds scored');
      expect(mayaLiveRow).toHaveAttribute('data-display-rank', '2');
      expect(mayaLiveRow).toHaveAttribute('data-authoritative-rank', '1');

      mocks.game = {
        ...(mocks.game as typeof baseGame),
        phase: 'roundResults',
        phaseStartedAt: now,
        phaseEndsAt: now + 8_000,
        currentResult: { ...igorResult, status: 'timedOut' },
        roundResults: [mayaResult, { ...igorResult, status: 'timedOut' }, { ...theoResult, status: 'timedOut' }],
        round: { ...round, numericAnswer: 42 },
      };
      view.rerender(
        <MemoryRouter>
          <MiniGamesRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );

      expect(sidebarRows()).toEqual([
        expect.stringContaining('Maya'),
        expect.stringContaining('Igor'),
        expect.stringContaining('Theo'),
      ]);
      expect(animate).toHaveBeenCalledTimes(2);
      expect(animate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ transform: expect.stringContaining('translate3d') }),
          { transform: 'translate3d(0, 0, 0)' },
        ]),
        { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    } finally {
      rectSpy.mockRestore();
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'animate');
      }
    }
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
    expect(estimate).toHaveFocus();
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
