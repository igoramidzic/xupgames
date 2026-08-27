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

  it('fades out and then fades in every keyed game surface change', () => {
    vi.useFakeTimers();
    const view = render(
      <GameSurfaceTransition showResults={false} surfaceKey="lobby" results={null}>
        <div>Start screen</div>
      </GameSurfaceTransition>
    );

    view.rerender(
      <GameSurfaceTransition showResults={false} surfaceKey="spinner:round-1" results={null}>
        <div>Spinner screen</div>
      </GameSurfaceTransition>
    );

    expect(screen.getByText('Start screen')).toBeInTheDocument();
    expect(screen.queryByText('Spinner screen')).not.toBeInTheDocument();
    expect(screen.getByText('Start screen').parentElement).toHaveAttribute('data-transition', 'surface-out');

    act(() => vi.advanceTimersByTime(GAME_SURFACE_FADE_OUT_MS));

    expect(screen.queryByText('Start screen')).not.toBeInTheDocument();
    expect(screen.getByText('Spinner screen')).toBeInTheDocument();
    expect(screen.getByText('Spinner screen').parentElement).toHaveAttribute('data-transition', 'surface-in');

    act(() => vi.advanceTimersByTime(20));

    expect(screen.getByText('Spinner screen').parentElement).toHaveAttribute('data-transition', 'surface');
  });

  it('keeps the outgoing surface mounted when its fade-out begins', () => {
    vi.useFakeTimers();
    const view = render(
      <GameSurfaceTransition showResults={false} surfaceKey="lobby" results={null}>
        <div>Start screen</div>
      </GameSurfaceTransition>
    );

    view.rerender(
      <GameSurfaceTransition showResults={false} surfaceKey="spinner:round-1" results={null}>
        <div>Spinner screen</div>
      </GameSurfaceTransition>
    );
    act(() => vi.advanceTimersByTime(GAME_SURFACE_FADE_OUT_MS + 20));

    const spinner = screen.getByText('Spinner screen');

    view.rerender(
      <GameSurfaceTransition showResults={false} surfaceKey="playing:round-1" results={null}>
        <div>Mini game screen</div>
      </GameSurfaceTransition>
    );

    expect(screen.getByText('Spinner screen')).toBe(spinner);
    expect(spinner.parentElement).toHaveAttribute('data-transition', 'surface-out');
    expect(screen.queryByText('Mini game screen')).not.toBeInTheDocument();
  });
});
