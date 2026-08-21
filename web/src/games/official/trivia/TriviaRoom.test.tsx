import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TriviaRoom from './TriviaRoom';

const mocks = vi.hoisted(() => ({
  game: null as unknown,
  startGame: vi.fn(),
  submitAnswer: vi.fn(),
  configureGame: vi.fn(),
  leaveRoom: vi.fn(),
  closeRoom: vi.fn(),
  mutationIndex: 0,
  onlineByMemberId: new Map<string, boolean>(),
}));

vi.mock('convex/react', () => ({
  useMutation: () => {
    const mutations = [mocks.startGame, mocks.submitAnswer, mocks.configureGame, mocks.leaveRoom, mocks.closeRoom];
    const mutation = mutations[mocks.mutationIndex % mutations.length];
    mocks.mutationIndex += 1;
    return mutation;
  },
  useQuery: () => mocks.game,
}));

vi.mock('@/lib/useRoomPresence', () => ({
  useRoomPresence: () => ({ onlineByMemberId: mocks.onlineByMemberId }),
}));

vi.mock('@/components/PostGameBoard', () => ({
  default: ({ title }: { title: string }) => (
    <section>
      <h1>{title}</h1>
      <div>Next game ballot</div>
    </section>
  ),
  PostGamePodium: () => <ol aria-label="Final podium" />,
}));

vi.mock('@/components/GameModeControl', () => ({
  default: () => <button type="button">Change game</button>,
  GameModeContent: ({ children }: { children: React.ReactNode }) => children,
}));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Ada' };
const session = {
  kind: 'session' as const,
  roomId: 'room-id' as never,
  code: 'ABCDEFGH',
  gameType: 'trivia' as const,
  currentGameId: 'room-game-id' as never,
  status: 'open' as const,
  activeMemberCount: 2,
  maxPlayers: 50,
  isOwner: true,
  ownershipVersion: 0,
  ownershipReason: 'created' as const,
  currentMember: {
    memberId: 'member-ada' as never,
    displayName: 'Ada',
    isActive: true,
    joinedAt: 1,
    leftAt: null,
  },
  members: [
    { memberId: 'member-ada' as never, displayName: 'Ada', isOwner: true, isActive: true, joinedAt: 1, leftAt: null },
    {
      memberId: 'member-grace' as never,
      displayName: 'Grace',
      isOwner: false,
      isActive: true,
      joinedAt: 2,
      leftAt: null,
    },
  ],
};

function leaderboard() {
  return [
    {
      rank: 1,
      memberId: 'member-ada',
      displayName: 'Ada',
      totalPoints: 0,
      correctAnswers: 0,
      answersSubmitted: 0,
      bestStreak: 0,
      isCurrentPlayer: true,
      isActive: true,
    },
    {
      rank: 2,
      memberId: 'member-grace',
      displayName: 'Grace',
      totalPoints: 0,
      correctAnswers: 0,
      answersSubmitted: 0,
      bestStreak: 0,
      isCurrentPlayer: false,
      isActive: true,
    },
  ];
}

function triviaConfiguration() {
  return {
    categories: ['Science', 'History', 'Geography', 'Arts & Literature', 'Technology', 'Nature', 'Games & Culture'],
    roundCount: 10,
    availableCategories: [
      'Science',
      'History',
      'Geography',
      'Arts & Literature',
      'Technology',
      'Nature',
      'Games & Culture',
    ],
    categoryQuestionCounts: [
      { category: 'Science', count: 20 },
      { category: 'History', count: 15 },
      { category: 'Geography', count: 15 },
      { category: 'Arts & Literature', count: 15 },
      { category: 'Technology', count: 19 },
      { category: 'Nature', count: 10 },
      { category: 'Games & Culture', count: 20 },
    ],
    roundOptions: [
      { roundCount: 5, estimatedMinutes: 2 },
      { roundCount: 10, estimatedMinutes: 4 },
      { roundCount: 15, estimatedMinutes: 6 },
      { roundCount: 20, estimatedMinutes: 8 },
    ],
    estimatedMinutes: 4,
  };
}

describe('TriviaRoom', () => {
  beforeEach(() => {
    mocks.mutationIndex = 0;
    mocks.startGame.mockReset();
    mocks.submitAnswer.mockReset();
    mocks.configureGame.mockReset();
    mocks.leaveRoom.mockReset();
    mocks.closeRoom.mockReset();
    mocks.onlineByMemberId.clear();
  });

  it('lets the owner start a ten-question game from the lobby', async () => {
    mocks.game = {
      gameNumber: 0,
      phase: 'lobby',
      currentQuestionNumber: 0,
      totalQuestions: 10,
      phaseStartedAt: null,
      phaseEndsAt: null,
      round: null,
      playerAnswer: null,
      leaderboard: leaderboard(),
      configuration: triviaConfiguration(),
    };
    mocks.startGame.mockResolvedValue({ gameNumber: 1 });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );
    expect(screen.getByRole('banner')).toHaveClass('grid-cols-[auto_minmax(0,1fr)_auto]', 'gap-3');
    expect(screen.getByText(/players ready/)).toHaveTextContent('2 players ready');
    expect(screen.queryByText('10 QUESTIONS · 15 SECONDS EACH')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Trivia rules and game configuration' })).toHaveTextContent(
      '10 rounds · About 4 min · All categories'
    );
    expect(screen.getByRole('link', { name: 'Playtest' })).toHaveAttribute('href', '/admin/ABCDEFGH');
    expect(screen.getByRole('button', { name: 'Copy room link' })).toHaveClass(
      'max-[760px]:w-fit',
      'justify-self-center'
    );
    await user.click(screen.getByRole('button', { name: 'Start the game' }));

    await waitFor(() =>
      expect(mocks.startGame).toHaveBeenCalledWith({ roomId: 'room-id', sessionToken: guest.sessionToken })
    );
  });

  it('lets only the owner configure categories and rounds', async () => {
    mocks.game = {
      gameNumber: 0,
      phase: 'lobby',
      currentQuestionNumber: 0,
      totalQuestions: 10,
      phaseStartedAt: null,
      phaseEndsAt: null,
      round: null,
      playerAnswer: null,
      leaderboard: leaderboard(),
      configuration: triviaConfiguration(),
    };
    mocks.configureGame.mockResolvedValue(null);
    const user = userEvent.setup();

    const view = render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByRole('dialog', { name: 'Configure trivia' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'History' }));
    expect(screen.getByRole('button', { name: '15 rounds, about 6 minutes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '15 rounds, about 6 minutes' }));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(mocks.configureGame).toHaveBeenCalledWith({
        roomId: 'room-id',
        sessionToken: guest.sessionToken,
        categories: ['Science', 'Geography', 'Arts & Literature', 'Technology', 'Nature', 'Games & Culture'],
        roundCount: 15,
      })
    );

    view.rerender(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={{ ...session, isOwner: false }} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
  });

  it('locks one answer for the active question', async () => {
    mocks.game = {
      gameNumber: 1,
      phase: 'question',
      currentQuestionNumber: 3,
      totalQuestions: 10,
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 15_000,
      round: {
        roundId: 'round-id',
        questionNumber: 3,
        category: 'Science',
        difficulty: 'hard',
        prompt: 'Which element has atomic number 74?',
        options: ['Tantalum', 'Tungsten', 'Rhenium', 'Osmium'],
        answer: null,
        correctOptionIndex: null,
        answeredCount: 1,
        optionAnswerCounts: null,
      },
      playerAnswer: null,
      leaderboard: leaderboard(),
    };
    mocks.submitAnswer.mockResolvedValue({ pointsAwarded: 900, responseTimeMs: 3_000 });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );
    const timer = screen.getByRole('timer', { name: /seconds left to answer/ });
    expect(timer).toHaveAttribute('data-phase', 'question');
    expect(timer.closest('.trivia-question-content')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Which element has atomic number 74?' })).toHaveClass(
      'font-sans',
      'leading-[1.08]',
      'tracking-[-0.025em]'
    );
    expect(document.querySelector('.trivia-question-timer-ring')).not.toBeInTheDocument();
    const standings = screen.getByRole('list', { name: 'Player standings' });
    expect(standings.closest('[data-slot="scroll-area-viewport"]')).toHaveClass('scroll-fade');
    const guidance = document.querySelector<HTMLElement>('.trivia-question-guidance');
    expect(guidance).toHaveTextContent(
      'Correct answers earn 500–1,000 points. The faster they land, the more they’re worth.'
    );
    expect(screen.getByRole('complementary')).not.toContainElement(guidance);
    await user.click(screen.getByRole('button', { name: /B\s*Tungsten/ }));

    await waitFor(() =>
      expect(mocks.submitAnswer).toHaveBeenCalledWith({
        roomId: 'room-id',
        sessionToken: guest.sessionToken,
        selectedOptionIndex: 1,
      })
    );
    expect(screen.getByRole('button', { name: /A\s*Tantalum/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /B\s*Tungsten/ })).toBeDisabled();
    for (const answer of document.querySelectorAll('[data-variant="answer"]')) {
      expect(answer).toHaveClass('disabled:opacity-100');
    }
  });

  it('does not count the open question in the score denominator', () => {
    const questionGame = {
      gameNumber: 1,
      phase: 'question',
      currentQuestionNumber: 4,
      totalQuestions: 10,
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 15_000,
      round: {
        roundId: 'round-id',
        questionNumber: 4,
        category: 'History',
        difficulty: 'hard',
        prompt: 'Which treaty ended the War of the Spanish Succession?',
        options: ['Treaty of Utrecht', 'Treaty of Paris', 'Treaty of Tordesillas', 'Treaty of Westphalia'],
        answer: null,
        correctOptionIndex: null,
        answeredCount: 0,
        optionAnswerCounts: null,
      },
      playerAnswer: null,
      leaderboard: leaderboard().map((entry) =>
        entry.isCurrentPlayer ? { ...entry, correctAnswers: 2, answersSubmitted: 3, totalPoints: 2_400 } : entry
      ),
    };
    mocks.game = questionGame;

    const view = render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    expect(screen.getByText('2/3 correct')).toBeInTheDocument();
    expect(screen.queryByText('2/4 correct')).not.toBeInTheDocument();

    mocks.game = {
      ...questionGame,
      phase: 'reveal',
      phaseEndsAt: Date.now() + 7_000,
      round: {
        ...questionGame.round,
        answer: 'Treaty of Utrecht',
        correctOptionIndex: 0,
        optionAnswerCounts: [1, 0, 0, 0],
      },
    };
    view.rerender(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    expect(screen.getByText('2/4 correct')).toBeInTheDocument();
    const timer = screen.getByRole('timer', { name: 'Next question in 7 seconds' });
    expect(timer).toBeInTheDocument();
    expect(timer.closest('.trivia-question-card')).not.toBeNull();
    expect(document.querySelector('.trivia-question-stage')).toHaveAttribute('data-answer-result', 'incorrect');
  });

  it('swaps to the next question without fading the answers', () => {
    const revealGame = {
      gameNumber: 1,
      phase: 'reveal',
      currentQuestionNumber: 1,
      totalQuestions: 10,
      phaseStartedAt: Date.now() - 7_000,
      phaseEndsAt: Date.now(),
      round: {
        roundId: 'round-one',
        questionNumber: 1,
        category: 'Science',
        difficulty: 'hard',
        prompt: 'Outgoing question',
        options: ['One', 'Two', 'Three', 'Four'],
        answer: 'One',
        correctOptionIndex: 0,
        answeredCount: 2,
        optionAnswerCounts: [1, 0, 1, 0],
      },
      playerAnswer: null,
      leaderboard: leaderboard(),
    };
    mocks.game = revealGame;

    const view = render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    mocks.game = {
      ...revealGame,
      phase: 'question',
      currentQuestionNumber: 2,
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 15_000,
      round: {
        ...revealGame.round,
        roundId: 'round-two',
        questionNumber: 2,
        prompt: 'Incoming question',
        answer: null,
        correctOptionIndex: null,
        answeredCount: 0,
        optionAnswerCounts: null,
      },
    };
    view.rerender(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Outgoing question')).not.toBeInTheDocument();
    expect(screen.getByText('Incoming question')).toBeInTheDocument();
    const questionContent = document.querySelector('.trivia-question-content');
    expect(questionContent).not.toHaveAttribute('data-transition');
    expect(questionContent).not.toHaveClass('transition-opacity');
    expect(screen.getByRole('timer')).toHaveAttribute('data-phase', 'question');
  });

  it('fades the final question before showing the round-over board', () => {
    vi.useFakeTimers();
    try {
      const finalQuestion = {
        gameNumber: 1,
        phase: 'reveal',
        currentQuestionNumber: 10,
        totalQuestions: 10,
        phaseStartedAt: Date.now() - 7_000,
        phaseEndsAt: Date.now(),
        round: {
          roundId: 'round-ten',
          questionNumber: 10,
          category: 'Science',
          difficulty: 'hard',
          prompt: 'The final question',
          options: ['One', 'Two', 'Three', 'Four'],
          answer: 'One',
          correctOptionIndex: 0,
          answeredCount: 2,
          optionAnswerCounts: [1, 0, 1, 0],
        },
        playerAnswer: null,
        leaderboard: leaderboard(),
      };
      mocks.game = finalQuestion;
      const view = render(
        <MemoryRouter>
          <TriviaRoom guest={guest} session={session} />
        </MemoryRouter>
      );

      mocks.game = {
        ...finalQuestion,
        phase: 'complete',
        phaseEndsAt: null,
        round: null,
      };
      view.rerender(
        <MemoryRouter>
          <TriviaRoom guest={guest} session={session} />
        </MemoryRouter>
      );

      expect(screen.getByText('The final question')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Ada takes it.' })).not.toBeInTheDocument();
      expect(screen.getByText('The final question').closest('[data-transition="game-out"]')).not.toBeNull();

      act(() => vi.advanceTimersByTime(280));

      expect(screen.queryByText('The final question')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Ada takes it.' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows points gained beside each correct player only during the reveal', () => {
    mocks.game = {
      gameNumber: 1,
      phase: 'reveal',
      currentQuestionNumber: 1,
      totalQuestions: 10,
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 7_000,
      round: {
        roundId: 'round-id',
        questionNumber: 1,
        category: 'Science',
        difficulty: 'hard',
        prompt: 'Which element has atomic number 74?',
        options: ['Tantalum', 'Tungsten', 'Rhenium', 'Osmium'],
        answer: 'Tungsten',
        correctOptionIndex: 1,
        answeredCount: 2,
        optionAnswerCounts: [0, 1, 1, 0],
      },
      playerAnswer: {
        selectedOptionIndex: 1,
        pointsAwarded: 875,
        responseTimeMs: 3_750,
        isCorrect: true,
      },
      leaderboard: leaderboard().map((entry) => ({
        ...entry,
        totalPoints: entry.isCurrentPlayer ? 875 : 0,
        pointsGained: entry.isCurrentPlayer ? 875 : null,
      })),
    };

    render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    const standings = within(screen.getByRole('list', { name: 'Player standings' }));
    expect(standings.getByText('+875 points')).toBeInTheDocument();
    expect(standings.getAllByText(/\+.*points/)).toHaveLength(1);
    const correctAnswer = screen.getByRole('button', { name: /B\s*Tungsten/ });
    expect(correctAnswer).toHaveAttribute('data-selected', 'false');
    expect(correctAnswer).toHaveAttribute('data-correct', 'true');
    expect(correctAnswer).toHaveClass('data-[correct=true]:bg-[#e3f8ef]');
    const answerFills = document.querySelectorAll<HTMLElement>('.trivia-answer-result > span');
    expect(answerFills[1]?.style.getPropertyValue('--answer-share')).toBe('50%');
    expect(answerFills[2]?.style.getPropertyValue('--answer-share')).toBe('50%');
  });

  it('labels disconnected players without removing their score', () => {
    mocks.onlineByMemberId.set('member-grace', false);
    mocks.game = {
      gameNumber: 1,
      phase: 'complete',
      currentQuestionNumber: 10,
      totalQuestions: 10,
      phaseStartedAt: Date.now(),
      phaseEndsAt: null,
      round: null,
      playerAnswer: null,
      leaderboard: leaderboard().map((entry) =>
        entry.memberId === 'member-grace' ? { ...entry, totalPoints: 1_250 } : entry
      ),
    };

    const view = render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    const standings = within(screen.getByRole('list', { name: 'Player standings' }));
    expect(standings.getByText('Disconnected')).toBeInTheDocument();
    expect(standings.getByText('1,250')).toBeInTheDocument();

    mocks.onlineByMemberId.set('member-grace', true);
    view.rerender(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );
    expect(standings.queryByText('Disconnected')).not.toBeInTheDocument();
    const graceRow = standings.getByText('Grace').closest('li');
    expect(graceRow).not.toBeNull();
    expect(within(graceRow as HTMLElement).getByText('0 right')).toBeInTheDocument();
  });

  it('keeps a player who left in the standings but excludes them from winning', () => {
    mocks.game = {
      gameNumber: 1,
      phase: 'complete',
      currentQuestionNumber: 10,
      totalQuestions: 10,
      phaseStartedAt: Date.now(),
      phaseEndsAt: null,
      round: null,
      playerAnswer: null,
      leaderboard: [
        { ...leaderboard()[1], rank: 1, totalPoints: 2_000, isActive: false },
        { ...leaderboard()[0], rank: 2, totalPoints: 1_000 },
      ],
    };

    render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Ada takes it.' })).toBeInTheDocument();
    const standings = within(screen.getByRole('list', { name: 'Player standings' }));
    expect(standings.getByText('Left')).toBeInTheDocument();
    expect(standings.getByText('2,000')).toBeInTheDocument();
    expect(standings.getByText('Grace').closest('li')).toHaveClass('opacity-45');
  });

  it('animates players into their newly ranked positions', () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }) as unknown as Animation);
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const top = Number(this.dataset.rank ?? 0) * 54;
      return {
        x: 0,
        y: top,
        top,
        right: 200,
        bottom: top + 48,
        left: 0,
        width: 200,
        height: 48,
        toJSON: () => ({}),
      };
    });
    try {
      const initialLeaderboard = leaderboard();
      const initialGame = {
        gameNumber: 1,
        phase: 'complete',
        currentQuestionNumber: 10,
        totalQuestions: 10,
        phaseStartedAt: Date.now(),
        phaseEndsAt: null,
        round: null,
        playerAnswer: null,
        leaderboard: initialLeaderboard,
      };
      mocks.game = initialGame;

      const view = render(
        <MemoryRouter>
          <TriviaRoom guest={guest} session={session} />
        </MemoryRouter>
      );
      mocks.game = {
        ...initialGame,
        leaderboard: [
          { ...initialLeaderboard[1], rank: 1, totalPoints: 900 },
          { ...initialLeaderboard[0], rank: 2, totalPoints: 700 },
        ],
      };
      view.rerender(
        <MemoryRouter>
          <TriviaRoom guest={guest} session={session} />
        </MemoryRouter>
      );

      expect(animate).toHaveBeenCalledTimes(2);
    } finally {
      rectSpy.mockRestore();
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'animate');
      }
    }
  });
});
