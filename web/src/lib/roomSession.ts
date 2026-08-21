import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;
type RoomMember = ActiveSession['members'][number];
type LegacyRoomMember = Omit<RoomMember, 'isActive' | 'leftAt'>;

export function getRoomMembers(session: ActiveSession): RoomMember[] {
  const compatibleSession = session as ActiveSession & {
    members?: RoomMember[];
    activeMembers?: LegacyRoomMember[];
  };

  if (compatibleSession.members) {
    return compatibleSession.members;
  }

  return (compatibleSession.activeMembers ?? []).map((member) => ({
    ...member,
    isActive: true,
    leftAt: null,
  }));
}
