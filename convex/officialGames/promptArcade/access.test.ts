import { ConvexError } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';
import { startPromptArcadeGame, startPromptArcadePlaylist } from './game';
import { syncPromptArcadeMembership } from './lifecycle';

const SESSION_TOKEN = 'a'.repeat(32);

function accessContext({
  gameType = 'promptArcade',
  guest = { _id: 'guest-1' },
  membership = {
    _id: 'member-1',
    guestId: 'guest-1',
    displayName: 'Igor',
    isActive: true,
    memberKind: 'player',
  },
  ownerGuestId = 'guest-1',
}: {
  gameType?: string;
  guest?: Record<string, unknown> | null;
  membership?: Record<string, unknown> | null;
  ownerGuestId?: string;
} = {}) {
  const room = {
    _id: 'room-1',
    gameType,
    status: 'open',
    ownerGuestId,
  };
  const index = { eq: vi.fn(() => index) };
  return {
    db: {
      get: vi.fn(async (table: string) => (table === 'rooms' ? room : null)),
      query: vi.fn((table: string) => ({
        withIndex: vi.fn((_name: string, configure: (query: typeof index) => unknown) => {
          configure(index);
          return {
            unique: vi.fn(async () =>
              table === 'guestSessions' ? guest : table === 'roomMembers' ? membership : null
            ),
          };
        }),
      })),
    },
  };
}

async function expectErrorCode(operation: Promise<unknown>, code: string) {
  try {
    await operation;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<{ code: string }>).data.code).toBe(code);
  }
}

describe('Prompt Arcade access', () => {
  it('rejects wrong-game, inactive, and playtest-bot access', async () => {
    await expectErrorCode(
      startPromptArcadeGame(accessContext({ gameType: 'miniGames' }) as never, {
        roomId: 'room-1' as never,
        sessionToken: SESSION_TOKEN,
      }),
      'WRONG_GAME_TYPE'
    );
    await expectErrorCode(
      startPromptArcadeGame(
        accessContext({
          membership: {
            _id: 'member-1',
            guestId: 'guest-1',
            displayName: 'Igor',
            isActive: false,
            memberKind: 'player',
          },
        }) as never,
        { roomId: 'room-1' as never, sessionToken: SESSION_TOKEN }
      ),
      'MEMBER_INACTIVE'
    );
    await expectErrorCode(
      startPromptArcadeGame(
        accessContext({
          membership: {
            _id: 'member-1',
            guestId: 'guest-1',
            displayName: 'Bot',
            isActive: true,
            memberKind: 'playtestBot',
          },
        }) as never,
        { roomId: 'room-1' as never, sessionToken: SESSION_TOKEN }
      ),
      'ROOM_ACTION_NOT_ELIGIBLE'
    );
  });

  it('enforces owner-only start and playlist controls', async () => {
    const ctx = accessContext({ ownerGuestId: 'guest-owner' });
    await expectErrorCode(
      startPromptArcadeGame(ctx as never, { roomId: 'room-1' as never, sessionToken: SESSION_TOKEN }),
      'NOT_ROOM_OWNER'
    );
    await expectErrorCode(
      startPromptArcadePlaylist(ctx as never, { roomId: 'room-1' as never, sessionToken: SESSION_TOKEN }),
      'NOT_ROOM_OWNER'
    );
  });

  it('does not enroll a 31st prompt author', async () => {
    const entries = Array.from({ length: 30 }, (_, order) => ({
      _id: `entry-${order}`,
      order,
    }));
    const index = { eq: vi.fn(() => index) };
    const insert = vi.fn(async () => 'unused-id');
    const ctx = {
      db: {
        get: vi.fn(async (table: string) =>
          table === 'roomMembers'
            ? { _id: 'member-31', isActive: true, memberKind: 'player', displayName: 'Thirty One' }
            : null
        ),
        query: vi.fn((table: string) => ({
          withIndex: vi.fn((name: string, configure: (query: typeof index) => unknown) => {
            configure(index);
            return {
              unique: vi.fn(async () =>
                table === 'promptArcadeGameStates'
                  ? { gameNumber: 1, phase: 'prompting', playlistStarted: false }
                  : null
              ),
              take: vi.fn(async () => (name === 'by_roomId_and_gameNumber' ? entries : [])),
            };
          }),
        })),
        insert,
        patch: vi.fn(async () => undefined),
      },
    };

    await syncPromptArcadeMembership(
      ctx as never,
      'room-1' as never,
      { _id: 'member-31' as never, displayName: 'Thirty One' },
      Date.now()
    );
    expect(insert).not.toHaveBeenCalled();
  });
});
