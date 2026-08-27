import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NewMiniGameChallenge from './NewMiniGameChallenges';

const playStartsAt = 10_000;

function round(id: string, challengePayload: unknown) {
  return {
    roundId: `round-${id}`,
    roundNumber: 1,
    miniGame: { id, title: id, eyebrow: 'Test', instructions: 'Play.' },
    selectionStartedAt: 6_800,
    playStartsAt,
    playEndsAt: 20_000,
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
    challengePayload,
  };
}

describe('new Mini Game Mix challenges', () => {
  it.each([
    [
      'flashbackTiles',
      { kind: 'flashbackTiles', gridSize: 5, targetTileIds: [0, 2, 4, 8, 12], revealDurationMs: 1_650 },
      12_000,
      'Five by five memory tile board',
    ],
    [
      'copycatSequence',
      { kind: 'copycatSequence', sequence: [0, 1, 2, 3, 0], playbackStepMs: 460 },
      13_000,
      'Triangle pad',
    ],
    [
      'crowdCount',
      { kind: 'crowdCount', characters: [], answerOptions: [8, 9, 10, 11] },
      17_000,
      'Crowd count answers',
    ],
    [
      'dropZone',
      { kind: 'dropZone', targetCenter: 0.5, targetWidth: 0.16, cycleDurationsMs: [1_900, 1_500, 1_150] },
      12_000,
      'Release package 1 of 3',
    ],
    [
      'shadowMatch',
      { kind: 'shadowMatch', cards: [{ targetShape: 'star', options: ['star', 'moon', 'heart', 'bolt'] }] },
      12_000,
      'star object',
    ],
    ['flagFrenzy', { kind: 'flagFrenzy', signals: [0, 1, 2, 3], signalDurationMs: 820 }, 12_000, 'Triangle signal pad'],
    [
      'brakeCheck',
      { kind: 'brakeCheck', targets: [0.7, 0.8], fillDurationMs: 2_200 },
      12_000,
      'Hold to accelerate · release to brake',
    ],
    ['signalSnap', { kind: 'signalSnap', cueOffsetsMs: [1_500, 4_500, 7_500] }, 12_000, 'Signal changed. Tap now.'],
  ])('renders the %s apparatus', (id, payload, now, accessibleName) => {
    const view = render(
      <NewMiniGameChallenge round={round(id, payload) as never} now={now} disabled={false} onSubmit={vi.fn()} />
    );
    expect(screen.getByLabelText(accessibleName)).toBeInTheDocument();
    view.unmount();
  });

  it('submits the recalled tile set after the reveal', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <NewMiniGameChallenge
        round={
          round('flashbackTiles', {
            kind: 'flashbackTiles',
            gridSize: 5,
            targetTileIds: [0, 2, 4, 8, 12],
            revealDurationMs: 1_650,
          }) as never
        }
        now={12_000}
        disabled={false}
        onSubmit={onSubmit}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Tile 1' }));
    await user.click(screen.getByRole('button', { name: 'Tile 3' }));
    await user.click(screen.getByRole('button', { name: 'Lock pattern' }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'flashbackTiles', selectedTileIds: [0, 2] });
  });

  it('submits the full signal sequence', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <NewMiniGameChallenge
        round={round('flagFrenzy', { kind: 'flagFrenzy', signals: [0, 1, 2, 3], signalDurationMs: 820 }) as never}
        now={12_000}
        disabled={false}
        onSubmit={onSubmit}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Triangle signal pad' }));
    await user.click(screen.getByRole('button', { name: 'Circle signal pad' }));
    await user.click(screen.getByRole('button', { name: 'Square signal pad' }));
    await user.click(screen.getByRole('button', { name: 'Diamond signal pad' }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'flagFrenzy', pressedPads: [0, 1, 2, 3] });
  });
});
