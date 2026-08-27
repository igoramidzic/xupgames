import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import InitialGameLobby from './InitialGameLobby';

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
}));

vi.mock('@/lib/roomSession', () => ({
  getRoomMembers: () => [],
}));

vi.mock('@/lib/useRoomPresence', () => ({
  useRoomPresence: () => ({ onlineByMemberId: new Map() }),
}));

vi.mock('./LobbyPlayersSidebar', () => ({ default: () => <aside>Players</aside> }));
vi.mock('./NextGameVoting', () => ({ default: () => <div>First game voting</div> }));
vi.mock('./RoomHeaderActions', () => ({ default: () => <div>Room actions</div> }));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Ada' };

function renderLobby(isOwner: boolean) {
  const session = {
    roomId: 'room-1',
    code: 'ABCDEFGH',
    status: 'open',
    isOwner,
    activeMemberCount: 2,
    currentMember: { memberId: 'member-1' },
  };

  return render(
    <MemoryRouter>
      <InitialGameLobby guest={guest} session={session as never} />
    </MemoryRouter>
  );
}

describe('InitialGameLobby', () => {
  it('shows the invitation card to the room owner', () => {
    renderLobby(true);

    expect(screen.getByRole('heading', { name: 'Invite everyone. Then pick together.' })).toBeInTheDocument();
  });

  it('hides the invitation card from non-owners', () => {
    renderLobby(false);

    expect(screen.queryByRole('heading', { name: 'Invite everyone. Then pick together.' })).not.toBeInTheDocument();
    expect(screen.getByText('First game voting')).toBeInTheDocument();
  });
});
