import { render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('uses the shared pressed movement and shadow release', () => {
    render(<Button variant="brand">Create a room</Button>);

    expect(screen.getByRole('button', { name: 'Create a room' })).toHaveClass(
      'active:translate-y-[3px]',
      'active:shadow-none!'
    );
  });

  it('applies the same pressed interaction to button-like links', () => {
    render(
      <MemoryRouter>
        <Button asChild variant="paper">
          <Link to="/admin/ABCDEFGH">Playtest</Link>
        </Button>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Playtest' })).toHaveClass(
      'active:translate-y-[3px]',
      'active:shadow-none!'
    );
  });

  it('keeps game-specific depth while resting and uses the shared pressed state', () => {
    render(<Button variant="trivia-primary">Start the game</Button>);

    expect(screen.getByRole('button', { name: 'Start the game' })).toHaveClass(
      'enabled:hover:shadow-[7px_7px_0_#10213d]',
      'active:translate-y-[3px]',
      'active:shadow-none!'
    );
  });
});
