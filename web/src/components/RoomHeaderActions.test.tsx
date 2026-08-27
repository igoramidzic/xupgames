import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RoomHeaderActions from './RoomHeaderActions';

describe('RoomHeaderActions', () => {
  it('keeps leave available to the owner alongside close while the room is open', () => {
    render(
      <RoomHeaderActions
        isOwner
        isClosed={false}
        pendingAction={null}
        onRequestLeave={vi.fn()}
        onRequestClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Leave room' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Close room' })).toBeEnabled();
  });

  it('removes the close action after closing but keeps leave available', () => {
    render(
      <RoomHeaderActions isOwner isClosed pendingAction={null} onRequestLeave={vi.fn()} onRequestClose={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Leave room' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Close room' })).not.toBeInTheDocument();
  });

  it('only exposes leave to a non-owner', () => {
    render(
      <RoomHeaderActions
        isOwner={false}
        isClosed={false}
        pendingAction={null}
        onRequestLeave={vi.fn()}
        onRequestClose={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Leave room' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Close room' })).not.toBeInTheDocument();
  });
});
