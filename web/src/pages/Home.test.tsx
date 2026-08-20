import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from './Home';

describe('Home', () => {
  it('renders the public game platform home', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'Xup Games' })).toBeInTheDocument();
    expect(screen.getByText('Multiplayer games are coming soon.')).toBeInTheDocument();
  });
});
