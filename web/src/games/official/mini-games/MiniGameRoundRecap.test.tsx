import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiniGameAnswerReveal } from './MiniGameRoundRecap';

describe('MiniGameAnswerReveal', () => {
  it('keeps the circle board visible with the exact center and player marker overlaid', () => {
    const view = render(
      <MiniGameAnswerReveal
        round={
          {
            miniGame: { id: 'circleCenter', title: 'Click the circle center' },
            circleTarget: {
              center: { x: 0.42, y: 0.58 },
              radius: 0.24,
              gapRotation: 18,
            },
          } as never
        }
        result={
          {
            submission: { kind: 'circleCenter', point: { x: 0.35, y: 0.63 } },
          } as never
        }
      />
    );

    expect(screen.getByRole('img', { name: 'Your marker and the exact circle center' })).toBeInTheDocument();
    const correctMarker = view.container.querySelector<HTMLElement>('[data-answer-marker="correct"]');
    const playerMarker = view.container.querySelector<HTMLElement>('[data-answer-marker="player"]');
    expect(Number.parseFloat(correctMarker?.style.left ?? '')).toBeCloseTo(42);
    expect(Number.parseFloat(correctMarker?.style.top ?? '')).toBeCloseTo(58);
    expect(Number.parseFloat(playerMarker?.style.left ?? '')).toBeCloseTo(35);
    expect(Number.parseFloat(playerMarker?.style.top ?? '')).toBeCloseTo(63);
    expect(screen.queryByText(/across|down/)).not.toBeInTheDocument();
  });
});
