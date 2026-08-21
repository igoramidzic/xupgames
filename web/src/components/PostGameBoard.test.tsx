import { act, render, screen } from '@testing-library/react';
import { Trophy } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PostGameBoard, {
  NEXT_GAME_BALLOT_DELAY_MS,
  PostGamePodium,
  WINNER_SPOTLIGHT_DURATION_MS,
} from './PostGameBoard';

vi.mock('@/components/NextGameVoting', () => ({
  default: () => <div>Loaded next-game ballot</div>,
}));

afterEach(() => {
  vi.useRealTimers();
});

describe('PostGameBoard', () => {
  it('spotlights the winner, then cross-fades a two-second countdown into the full ballot', () => {
    vi.useFakeTimers();
    render(
      <PostGameBoard
        eyebrow="Game 1 · Final"
        title="Ada wins."
        icon={Trophy}
        accent="#087fa7"
        accentTint="#ffda55"
        roomId={'room-1' as never}
        currentGameId={'room-game-1' as never}
        currentGameType="trivia"
        sessionToken={'a'.repeat(32)}
        isOwner
        isClosed={false}
        closedMessage="Room closed."
        playIntro
      />
    );

    const board = screen.getByRole('region', { name: 'Ada wins.' });
    const ballot = screen.getByText('Loaded next-game ballot').closest('[data-active]');
    const results = board.querySelector('[data-post-game-results]');
    const timer = board.querySelector('[data-countdown-card]');
    const progress = timer?.querySelector('[role="progressbar"]');
    expect(board).toHaveClass('items-start');
    expect(screen.getByText('Loaded next-game ballot')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Time until next-game voting opens' })).not.toBeInTheDocument();
    expect(timer).toHaveAttribute('data-visible', 'false');
    expect(timer).toHaveAttribute('aria-hidden', 'true');
    expect(ballot).toHaveAttribute('data-active', 'false');
    expect(ballot).toHaveAttribute('aria-hidden', 'true');
    expect(ballot).toHaveAttribute('inert');
    expect(results).toHaveAttribute('data-dimmed', 'false');

    act(() => vi.advanceTimersByTime(WINNER_SPOTLIGHT_DURATION_MS - 1));
    expect(timer).toHaveAttribute('data-visible', 'false');
    expect(ballot).toHaveAttribute('data-active', 'false');

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('Opens in 2s')).toBeInTheDocument();
    expect(progress).toHaveAttribute('aria-valuenow', '0');
    expect(progress).toHaveAttribute('aria-valuetext', '2 seconds remaining');
    expect(timer).toHaveAttribute('data-visible', 'true');
    expect(timer).toHaveAttribute('aria-hidden', 'false');

    act(() => vi.advanceTimersByTime(NEXT_GAME_BALLOT_DELAY_MS / 2));
    expect(screen.getByText('Opens in 1s')).toBeInTheDocument();
    expect(progress).toHaveAttribute('aria-valuenow', '50');
    expect(progress).toHaveAttribute('aria-valuetext', '1 second remaining');
    expect(ballot).toHaveAttribute('data-active', 'false');

    act(() => vi.advanceTimersByTime(NEXT_GAME_BALLOT_DELAY_MS / 2));
    expect(timer).toHaveAttribute('data-visible', 'false');
    expect(timer).toHaveAttribute('aria-hidden', 'true');
    expect(ballot).toHaveAttribute('data-active', 'true');
    expect(ballot).toHaveAttribute('aria-hidden', 'false');
    expect(ballot).not.toHaveAttribute('inert');
    expect(results).toHaveAttribute('data-dimmed', 'true');
  });

  it('shows the winner and ballot immediately when restored after completion', () => {
    render(
      <PostGameBoard
        eyebrow="Game 1 · Final"
        title="Ada wins."
        icon={Trophy}
        accent="#087fa7"
        accentTint="#ffda55"
        roomId={'room-1' as never}
        currentGameId={'room-game-1' as never}
        currentGameType="trivia"
        sessionToken={'a'.repeat(32)}
        isOwner
        isClosed={false}
        closedMessage="Room closed."
      />
    );

    const board = screen.getByRole('region', { name: 'Ada wins.' });
    const ballot = screen.getByText('Loaded next-game ballot').closest('[data-active]');
    const timer = board.querySelector('[data-countdown-card]');
    const results = board.querySelector('[data-post-game-results]');

    expect(ballot).toHaveAttribute('data-active', 'true');
    expect(ballot).toHaveAttribute('aria-hidden', 'false');
    expect(ballot).not.toHaveAttribute('inert');
    expect(timer).toHaveAttribute('data-visible', 'false');
    expect(results).toHaveAttribute('data-dimmed', 'true');
    expect(board).not.toHaveClass('motion-safe:animate-in');
  });

  it('renders at most the top three podium places', () => {
    render(
      <PostGamePodium
        label="Final podium"
        entries={[
          { id: 'one', place: 1, name: 'Ada', result: '72 WPM' },
          { id: 'two', place: 2, name: 'Grace', result: '68 WPM' },
          { id: 'three', place: 3, name: 'Linus', result: '61 WPM' },
          { id: 'four', place: 4, name: 'Edsger', result: '59 WPM' },
        ]}
      />
    );

    expect(screen.getByRole('list', { name: 'Final podium' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('Edsger')).not.toBeInTheDocument();
  });
});
