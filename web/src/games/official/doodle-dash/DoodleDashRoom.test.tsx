import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DoodleDashRoom from './DoodleDashRoom';

const mocks = vi.hoisted(() => ({
  game: null as Record<string, unknown> | null,
  mutationIndex: 0,
  queryCalls: [] as unknown[][],
  queryIndex: 0,
  startGame: vi.fn(),
  chooseWord: vi.fn(),
  submitGuess: vi.fn(),
  appendStroke: vi.fn(),
  streamStrokeChunk: vi.fn(),
  undoStroke: vi.fn(),
  redoStroke: vi.fn(),
  clearCanvas: vi.fn(),
  configureGame: vi.fn(),
  leaveRoom: vi.fn(),
  closeRoom: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => {
    mocks.queryCalls.push(args);
    const result = mocks.queryIndex % 2 === 0 ? mocks.game : [];
    mocks.queryIndex += 1;
    return result;
  },
  useMutation: () => {
    const mutations = [
      mocks.startGame,
      mocks.chooseWord,
      mocks.submitGuess,
      mocks.appendStroke,
      mocks.streamStrokeChunk,
      mocks.undoStroke,
      mocks.redoStroke,
      mocks.clearCanvas,
      mocks.configureGame,
      mocks.leaveRoom,
      mocks.closeRoom,
    ];
    const mutation = mutations[mocks.mutationIndex % mutations.length];
    mocks.mutationIndex += 1;
    return mutation;
  },
}));

vi.mock('@/lib/useRoomPresence', () => ({
  useRoomPresence: () => ({
    onlineByMemberId: new Map([
      ['member-1', true],
      ['member-2', true],
    ]),
  }),
}));

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
    results: React.ReactNode | ((props: { playIntro: boolean }) => React.ReactNode);
  }) => (showResults ? (typeof results === 'function' ? results({ playIntro: false }) : results) : children),
}));

vi.mock('@/components/PostGameBoard', () => ({
  default: () => <section aria-label="Next game voting">Post-game voting</section>,
  PostGamePodium: () => null,
}));

vi.mock('./DoodleDashCanvas', () => ({
  default: ({ canDraw }: { canDraw: boolean; showTools: boolean }) => (
    <div role="img" aria-label="Current drawing">
      {canDraw ? 'Canvas enabled' : 'Canvas watching'}
    </div>
  ),
}));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Ada' };
const session = {
  kind: 'session' as const,
  roomId: 'room-1',
  code: 'ABCDEFGH',
  gameType: 'doodleDash' as const,
  currentGameId: 'room-game-1',
  status: 'open' as const,
  activeMemberCount: 2,
  maxPlayers: 50,
  isOwner: true,
  ownershipVersion: 0,
  ownershipReason: 'created' as const,
  currentMember: { memberId: 'member-1', displayName: 'Ada', isActive: true, joinedAt: 1, leftAt: null },
  members: [
    { memberId: 'member-1', displayName: 'Ada', isOwner: true, isActive: true, joinedAt: 1, leftAt: null },
    { memberId: 'member-2', displayName: 'Theo', isOwner: false, isActive: true, joinedAt: 2, leftAt: null },
  ],
};

const configuration = {
  categories: ['Animals', 'Food'],
  roundCount: 2,
  drawDurationMs: 45_000,
  availableCategories: [
    { category: 'Animals', wordCount: 20 },
    { category: 'Food', wordCount: 20 },
  ],
  roundOptions: [1, 2, 3],
  drawDurationOptionsMs: [30_000, 45_000, 60_000],
  estimatedMinutes: 4,
};

function leaderboard() {
  return [
    {
      rank: 1,
      memberId: 'member-1',
      displayName: 'Ada',
      totalPoints: 900,
      guessPoints: 900,
      drawPoints: 0,
      wordsGuessed: 1,
      drawingTurns: 0,
      correctGuessers: 0,
      pointsGained: null,
      isCurrentPlayer: true,
      isActive: true,
      isDrawer: false,
      hasGuessedCurrentWord: false,
    },
    {
      rank: 2,
      memberId: 'member-2',
      displayName: 'Theo',
      totalPoints: 300,
      guessPoints: 0,
      drawPoints: 300,
      wordsGuessed: 0,
      drawingTurns: 1,
      correctGuessers: 1,
      pointsGained: null,
      isCurrentPlayer: false,
      isActive: true,
      isDrawer: true,
      hasGuessedCurrentWord: false,
    },
  ];
}

function activeRound(overrides: Record<string, unknown> = {}) {
  return {
    gameNumber: 1,
    phase: 'drawing',
    currentTurnNumber: 1,
    totalTurns: 4,
    phaseStartedAt: Date.now(),
    phaseEndsAt: Date.now() + 45_000,
    isParticipant: true,
    canGuess: true,
    round: {
      roundId: 'round-1',
      turnNumber: 1,
      roundNumber: 1,
      totalTurns: 4,
      drawerMemberId: 'member-2',
      drawerDisplayName: 'Theo',
      isDrawer: false,
      wordOptions: [],
      word: null,
      category: 'Animals',
      hint: '_ _ _ A _ _ _',
      wordLengths: [7],
      correctGuessCount: 0,
      eligibleGuesserCount: 1,
      canUndo: false,
      canRedo: false,
      strokes: [],
      messages: [],
    },
    leaderboard: leaderboard(),
    configuration,
    ...overrides,
  };
}

describe('DoodleDashRoom', () => {
  beforeEach(() => {
    mocks.mutationIndex = 0;
    mocks.queryCalls = [];
    mocks.queryIndex = 0;
    for (const mock of [
      mocks.startGame,
      mocks.chooseWord,
      mocks.submitGuess,
      mocks.appendStroke,
      mocks.streamStrokeChunk,
      mocks.undoStroke,
      mocks.redoStroke,
      mocks.clearCanvas,
      mocks.configureGame,
      mocks.leaveRoom,
      mocks.closeRoom,
    ]) {
      mock.mockReset();
    }
    mocks.startGame.mockResolvedValue({ gameNumber: 1 });
    mocks.chooseWord.mockResolvedValue(null);
  });

  it('starts from an owner lobby with the selected configuration visible', async () => {
    mocks.game = {
      gameNumber: 0,
      phase: 'lobby',
      currentTurnNumber: 0,
      totalTurns: 0,
      phaseStartedAt: null,
      phaseEndsAt: null,
      isParticipant: true,
      canGuess: false,
      round: null,
      leaderboard: leaderboard(),
      configuration,
    };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    const setup = screen.getByRole('region', { name: 'Doodle Dash game configuration' });
    const players = screen.getByRole('complementary', { name: 'Players in the room' });
    expect(screen.getByRole('main')).toHaveClass('max-w-345');
    expect(screen.getByRole('main').firstElementChild).toHaveClass('grid-cols-[minmax(0,1fr)_300px]', 'gap-4.5');
    expect(players).toHaveClass('max-h-[clamp(640px,calc(100dvh-112px),768px)]');
    expect(within(setup).getByText('2 rounds each')).toBeInTheDocument();
    expect(setup).toHaveTextContent('45s drawing');
    expect(setup).toHaveTextContent('About 4 min for 2 players');
    expect(within(players).getByText('Ada (you)')).toBeInTheDocument();
    expect(within(players).getByText('Theo')).toBeInTheDocument();
    expect(within(players).getByText('Ready to play')).toBeInTheDocument();
    expect(screen.queryByText('Choose from three private words in 8 seconds.')).not.toBeInTheDocument();
    expect(mocks.queryCalls[1]?.[1]).toBe('skip');
    await user.click(screen.getByRole('button', { name: 'Start Doodle Dash' }));
    expect(mocks.startGame).toHaveBeenCalledWith({ roomId: 'room-1', sessionToken: guest.sessionToken });
  });

  it('keeps the room players beside post-game voting', () => {
    mocks.game = activeRound({ phase: 'complete', round: null, canGuess: false });
    render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(screen.getByRole('region', { name: 'Next game voting' })).toBeInTheDocument();
    const players = screen.getByRole('complementary', { name: 'Players in the room' });
    expect(within(players).getByText('Ada (you)')).toBeInTheDocument();
    expect(within(players).getByText('Theo')).toBeInTheDocument();
    expect(within(players).getByText('Ready to vote')).toBeInTheDocument();
  });

  it('updates the lobby-time estimate while configuration changes', async () => {
    mocks.game = {
      gameNumber: 0,
      phase: 'lobby',
      currentTurnNumber: 0,
      totalTurns: 0,
      phaseStartedAt: null,
      phaseEndsAt: null,
      isParticipant: true,
      canGuess: false,
      round: null,
      leaderboard: leaderboard(),
      configuration,
    };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    await user.click(screen.getByRole('button', { name: '3 rounds per player' }));
    await user.click(screen.getByRole('button', { name: '60 seconds to draw' }));
    expect(screen.getByRole('dialog', { name: 'Configure Doodle Dash' })).toHaveTextContent(
      'With 2 players, this setup is about 8 minutes'
    );
  });

  it('shows word options only to the drawer and locks their selection', async () => {
    mocks.game = activeRound({
      phase: 'choosing',
      phaseEndsAt: Date.now() + 8_000,
      canGuess: false,
      round: {
        ...activeRound().round,
        drawerMemberId: 'member-1',
        drawerDisplayName: 'Ada',
        isDrawer: true,
        wordOptions: [
          { optionIndex: 0, word: 'giraffe', category: 'Animals' },
          { optionIndex: 1, word: 'popcorn', category: 'Food' },
          { optionIndex: 2, word: 'camera', category: 'Objects' },
        ],
        hint: null,
        wordLengths: [],
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    const timer = screen.getByRole('timer', { name: 'Time left to choose' });
    expect(timer).toHaveTextContent(/Pick in0[78]s/u);
    expect(timer).not.toHaveTextContent('.');
    expect(screen.queryByText('Time left')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /giraffe/i }));
    expect(mocks.chooseWord).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: guest.sessionToken,
      optionIndex: 0,
    });
  });

  it('subscribes to live stroke chunks only for spectators during drawing', () => {
    mocks.game = activeRound();
    const { unmount } = render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(mocks.queryCalls[1]?.[1]).toEqual({ roomId: 'room-1', sessionToken: guest.sessionToken });

    unmount();
    mocks.queryCalls = [];
    mocks.queryIndex = 0;
    mocks.mutationIndex = 0;
    mocks.game = activeRound({
      canGuess: false,
      round: {
        ...activeRound().round,
        drawerMemberId: 'member-1',
        drawerDisplayName: 'Ada',
        isDrawer: true,
      },
    });
    render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(mocks.queryCalls[1]?.[1]).toBe('skip');
  });

  it('uses content-sized cards and fills the revealed word into the status header', () => {
    mocks.game = activeRound({
      phase: 'reveal',
      canGuess: false,
      round: {
        ...activeRound().round,
        word: 'giraffe',
        hint: null,
        correctGuessCount: 1,
      },
    });
    const { container } = render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const centerStack = container.querySelector('[data-slot="doodle-dash-center-stack"]');
    const statusCard = screen.getByRole('region', { name: 'Round status' });
    const canvas = screen.getByRole('img', { name: 'Current drawing' });
    const standingsCard = screen.getByText('Standings').closest('aside');
    const guessesCard = screen.getByText('Guesses').closest('aside');
    const activeBoard = standingsCard?.parentElement;

    expect(activeBoard).toHaveClass('grid-cols-[300px_minmax(430px,1fr)_300px]');
    expect(centerStack).toHaveClass('grid', 'gap-3');
    expect(centerStack).not.toHaveClass('overflow-hidden', 'bg-[#fffdf7]');
    expect(statusCard.parentElement).toBe(centerStack);
    expect(statusCard).toHaveTextContent('GIRAFFE');
    expect(screen.queryByRole('region', { name: 'Revealed word' })).not.toBeInTheDocument();
    expect(canvas.parentElement?.parentElement).toBe(centerStack);
    expect(standingsCard).toHaveClass('self-start', 'h-[calc(100dvh-104px)]', 'max-[1120px]:h-auto');
    expect(guessesCard).toHaveClass('self-start', 'h-[calc(100dvh-104px)]');
    expect(screen.getByRole('link', { name: 'Playtest' })).toHaveAttribute('href', '/admin/ABCDEFGH');
  });

  it('shows public guesses, hides correct text, and surfaces close feedback only to its author', async () => {
    mocks.submitGuess.mockResolvedValue({ kind: 'close', pointsAwarded: 0 });
    mocks.game = activeRound({
      round: {
        ...activeRound().round,
        messages: [
          {
            messageId: 'message-1',
            memberId: 'member-2',
            displayName: 'Theo',
            kind: 'guess',
            text: 'horse',
            isClose: false,
            isCurrentPlayer: false,
            createdAt: 1,
          },
          {
            messageId: 'message-2',
            memberId: 'member-1',
            displayName: 'Ada',
            kind: 'guess',
            text: 'girafe',
            isClose: true,
            isCurrentPlayer: true,
            createdAt: 2,
          },
          {
            messageId: 'message-3',
            memberId: 'member-2',
            displayName: 'Theo',
            kind: 'correct',
            text: null,
            isClose: false,
            isCurrentPlayer: false,
            createdAt: 3,
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    expect(screen.getByText('horse')).toBeInTheDocument();
    expect(screen.getByText('You’re very close!')).toBeInTheDocument();
    expect(screen.getByText('Theo got the answer!')).toBeInTheDocument();
    expect(screen.queryByText('giraffe')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Your guess'), 'girafe');
    await user.click(screen.getByRole('button', { name: 'Send guess' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Very close'));
    expect(mocks.submitGuess).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: guest.sessionToken,
      guess: 'girafe',
    });
  });

  it('scrolls the room feed to the exact bottom when a message arrives', () => {
    mocks.game = activeRound();
    const room = (
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    const { rerender } = render(room);
    const messageLog = screen.getByRole('log', { name: 'Room guesses' });
    Object.defineProperty(messageLog, 'scrollHeight', { configurable: true, value: 640 });
    messageLog.scrollTop = 100;

    mocks.game = activeRound({
      round: {
        ...activeRound().round,
        messages: [
          {
            messageId: 'message-1',
            memberId: 'member-1',
            displayName: 'Ada',
            kind: 'guess',
            text: 'horse',
            isClose: false,
            isCurrentPlayer: true,
            createdAt: 1,
          },
        ],
      },
    });
    rerender(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(messageLog.scrollTop).toBe(640);
  });

  it('keeps the guess field enabled while a guess is being submitted', async () => {
    let finishSubmission: ((result: { kind: 'guess'; pointsAwarded: number }) => void) | undefined;
    mocks.submitGuess.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSubmission = resolve;
        })
    );
    mocks.game = activeRound();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const input = screen.getByLabelText('Your guess');
    await user.type(input, 'horse');
    await user.click(screen.getByRole('button', { name: 'Send guess' }));

    expect(input).toBeEnabled();
    await user.type(input, 'giraffe');
    expect(input).toHaveValue('giraffe');

    finishSubmission?.({ kind: 'guess', pointsAwarded: 0 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send guess' })).toBeEnabled());
    expect(input).toHaveValue('giraffe');
  });

  it('focuses the guess field and keeps the first key after guessing reopens', async () => {
    mocks.game = activeRound({ phase: 'reveal', canGuess: false });
    const user = userEvent.setup();
    const room = (
      <MemoryRouter>
        <DoodleDashRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    const { rerender } = render(room);
    expect(screen.getByLabelText('Your guess')).toBeDisabled();

    mocks.game = activeRound();
    rerender(room);
    const input = screen.getByLabelText('Your guess');
    await waitFor(() => expect(input).toBeEnabled());
    input.blur();

    await user.keyboard('g');

    expect(input).toHaveFocus();
    expect(input).toHaveValue('g');
  });
});
