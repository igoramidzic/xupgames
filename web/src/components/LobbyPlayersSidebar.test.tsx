import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LobbyPlayersSidebar from './LobbyPlayersSidebar';

describe('LobbyPlayersSidebar', () => {
  it('shows room membership and presence states with the shared invite action', async () => {
    const onInvite = vi.fn();
    const user = userEvent.setup();
    render(
      <LobbyPlayersSidebar
        members={
          [
            { memberId: 'member-1', displayName: 'Ada', isOwner: true, isActive: true, joinedAt: 1, leftAt: null },
            { memberId: 'member-2', displayName: 'Theo', isOwner: false, isActive: true, joinedAt: 2, leftAt: null },
            { memberId: 'member-3', displayName: 'Mina', isOwner: false, isActive: false, joinedAt: 3, leftAt: 4 },
          ] as never
        }
        activeMemberCount={2}
        currentMemberId="member-1"
        onlineByMemberId={
          new Map([
            ['member-1', true],
            ['member-2', false],
          ])
        }
        copied={false}
        onInvite={onInvite}
      />
    );

    const sidebar = screen.getByRole('complementary', { name: 'Players in the room' });
    expect(within(sidebar).getByText('Ada (you)')).toBeInTheDocument();
    expect(within(sidebar).getByText('Room owner')).toBeInTheDocument();
    expect(within(sidebar).getByText('Disconnected')).toBeInTheDocument();
    expect(within(sidebar).getByText('Left')).toBeInTheDocument();
    await user.click(within(sidebar).getByRole('button', { name: 'Invite more players' }));
    expect(onInvite).toHaveBeenCalledOnce();
  });

  it('keeps the shared structure while accepting a game-specific panel palette', () => {
    render(
      <LobbyPlayersSidebar
        members={
          [
            { memberId: 'member-1', displayName: 'Ada', isOwner: true, isActive: true, joinedAt: 1, leftAt: null },
          ] as never
        }
        activeMemberCount={1}
        currentMemberId="member-1"
        onlineByMemberId={new Map([['member-1', true]])}
        copied={false}
        onInvite={vi.fn()}
        theme={{ background: '#123456', text: '#ffffff' }}
      />
    );

    const sidebar = screen.getByRole('complementary', { name: 'Players in the room' });
    expect(sidebar.style.getPropertyValue('--lobby-sidebar-background')).toBe('#123456');
    expect(sidebar.style.getPropertyValue('--lobby-sidebar-text')).toBe('#ffffff');
    expect(within(sidebar).getByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Invite more players' })).toHaveClass(
      'enabled:hover:text-[var(--lobby-sidebar-invite-text)]',
      'enabled:hover:bg-[var(--lobby-sidebar-invite-hover-background)]'
    );
  });
});
