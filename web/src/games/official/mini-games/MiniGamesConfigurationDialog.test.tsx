import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MiniGamesConfigurationDialog from './MiniGamesConfigurationDialog';

describe('MiniGamesConfigurationDialog', () => {
  it('updates the full-game duration when the round count changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <MiniGamesConfigurationDialog
        configuration={{
          roundCount: 10,
          roundOptions: [
            { roundCount: 10, estimatedDurationMs: 172_000 },
            { roundCount: 15, estimatedDurationMs: 258_000 },
            { roundCount: 20, estimatedDurationMs: 344_000 },
            { roundCount: 25, estimatedDurationMs: 430_000 },
          ],
        }}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getAllByText(/3 min/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '20 mini-games, about 5½ min' }));
    expect(screen.getAllByText(/5½ min/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Save setup' }));
    expect(onSave).toHaveBeenCalledWith(20);
  });
});
