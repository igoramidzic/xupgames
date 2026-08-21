import { describe, expect, it } from 'vitest';
import { getRoomMembers } from './roomSession';

const sessionBase = {
  kind: 'session' as const,
  roomId: 'room-id',
  code: 'ABCDEFGH',
  gameType: 'trivia' as const,
  status: 'open' as const,
  activeMemberCount: 1,
  maxPlayers: 50,
  isOwner: true,
  currentMember: {
    memberId: 'member-id',
    displayName: 'Ada',
    isActive: true,
    joinedAt: 1,
    leftAt: null,
  },
};

describe('getRoomMembers', () => {
  it('uses the current members response', () => {
    const members = [
      { memberId: 'member-id', displayName: 'Ada', isOwner: true, isActive: true, joinedAt: 1, leftAt: null },
    ];

    expect(getRoomMembers({ ...sessionBase, members } as never)).toBe(members);
  });

  it('normalizes the legacy activeMembers response during deployment rollouts', () => {
    expect(
      getRoomMembers({
        ...sessionBase,
        activeMembers: [{ memberId: 'member-id', displayName: 'Ada', isOwner: true, joinedAt: 1 }],
      } as never)
    ).toEqual([
      {
        memberId: 'member-id',
        displayName: 'Ada',
        isOwner: true,
        isActive: true,
        joinedAt: 1,
        leftAt: null,
      },
    ]);
  });
});
