import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TriviaRoom from './TriviaRoom';

const mocks = vi.hoisted(() => ({
  game: null as unknown,
  startGame: vi.fn(),
  submitAnswer: vi.fn(),
  leaveRoom: vi.fn(),
  closeRoom: vi.fn(),
  mutationIndex: 0,
}));

vi.mock('convex/react', () => ({
  useMutation: () => {
    const mutations = [mocks.startGame, mocks.submitAnswer, mocks.leaveRoom, mocks.closeRoom];
    const mutation = mutations[mocks.mutationIndex % mutations.length];
    mocks.mutationIndex += 1;
    return mutation;
  },
  useQuery: () => mocks.game,
}));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Ada' };
const session = {
  kind: 'session' as const,
  roomId: 'room-id' as never,
  code: 'ABCDEFGH',
  gameType: 'trivia' as const,
  status: 'open' as const,
  activeMemberCount: 2,
  maxPlayers: 50,
  isOwner: true,
  currentMember: {
    memberId: 'member-ada' as never,
    displayName: 'Ada',
    isActive: true,
    joinedAt: 1,
    leftAt: null,
  },
  activeMembers: [
    { memberId: 'member-ada' as never, displayName: 'Ada', isOwner: true, joinedAt: 1 },
    { memberId: 'member-grace' as never, displayName: 'Grace', isOwner: false, joinedAt: 2 },
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
    },
  ];
}

describe('TriviaRoom', () => {
  beforeEach(() => {
    mocks.mutationIndex = 0;
    mocks.startGame.mockReset();
    mocks.submitAnswer.mockReset();
    mocks.leaveRoom.mockReset();
    mocks.closeRoom.mockReset();
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
    };
    mocks.startGame.mockResolvedValue({ gameNumber: 1 });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TriviaRoom guest={guest} session={session} />
      </MemoryRouter>
    );
    expect(screen.getByText(/launch questions/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Playtest' })).toHaveAttribute('href', '/admin/ABCDEFGH');
    await user.click(screen.getByRole('button', { name: 'Start the game' }));

    await waitFor(() =>
      expect(mocks.startGame).toHaveBeenCalledWith({ roomId: 'room-id', sessionToken: guest.sessionToken })
    );
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
    const timerRing = document.querySelector<SVGPathElement>('.trivia-question-timer-ring path');
    expect(timerRing).toHaveAttribute('pathLength', '100');
    expect(timerRing?.getAttribute('d')).not.toMatch(/[zZ]/);
    expect(timerRing?.style.strokeDashoffset).not.toBe('');
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

  it('fades only after the next question arrives and swaps while fully hidden', () => {
    vi.useFakeTimers();
    try {
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

      expect(document.querySelector('.trivia-question-content')).toHaveAttribute('data-transition', 'visible');

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

      expect(screen.getByText('Outgoing question')).toBeInTheDocument();
      expect(screen.queryByText('Incoming question')).not.toBeInTheDocument();
      expect(document.querySelector('.trivia-question-content')).toHaveAttribute('data-transition', 'out');

      act(() => vi.advanceTimersByTime(140));
      expect(screen.getByText('Incoming question')).toBeInTheDocument();
      expect(document.querySelector('.trivia-question-content')).toHaveAttribute('data-transition', 'in');

      act(() => vi.advanceTimersByTime(40));
      expect(document.querySelector('.trivia-question-content')).toHaveAttribute('data-transition', 'visible');
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
    const answerFills = document.querySelectorAll<HTMLElement>('.trivia-answer-result > span');
    expect(answerFills[1]?.style.getPropertyValue('--answer-share')).toBe('50%');
    expect(answerFills[2]?.style.getPropertyValue('--answer-share')).toBe('50%');
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
