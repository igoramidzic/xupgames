import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GameSurfaceTransition, { GAME_SURFACE_FADE_OUT_MS } from './GameSurfaceTransition';

afterEach(() => {
  vi.useRealTimers();
});

describe('GameSurfaceTransition', () => {
  it('holds and fades the outgoing game before showing results', () => {
    vi.useFakeTimers();
    const view = render(
      <GameSurfaceTransition
        showResults={false}
        results={({ playIntro }) => <div>{playIntro ? 'Fresh round over' : 'Restored round over'}</div>}
      >
        <div>Last question</div>
      </GameSurfaceTransition>
    );

    view.rerender(
      <GameSurfaceTransition
        showResults
        results={({ playIntro }) => <div>{playIntro ? 'Fresh round over' : 'Restored round over'}</div>}
      >
        {null}
      </GameSurfaceTransition>
    );

    expect(screen.getByText('Last question')).toBeInTheDocument();
    expect(screen.queryByText(/round over/)).not.toBeInTheDocument();
    expect(screen.getByText('Last question').parentElement).toHaveAttribute('data-transition', 'game-out');

    act(() => vi.advanceTimersByTime(GAME_SURFACE_FADE_OUT_MS));

    expect(screen.queryByText('Last question')).not.toBeInTheDocument();
    expect(screen.getByText('Fresh round over')).toBeInTheDocument();
  });

  it('shows restored results immediately without replaying their intro', () => {
    render(
      <GameSurfaceTransition
        showResults
        results={({ playIntro }) => <div>{playIntro ? 'Fresh round over' : 'Restored round over'}</div>}
      >
        <div>Last question</div>
      </GameSurfaceTransition>
    );

    expect(screen.getByText('Restored round over')).toBeInTheDocument();
    expect(screen.queryByText('Last question')).not.toBeInTheDocument();
  });
});
