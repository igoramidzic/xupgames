import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runGameBotTick: vi.fn(),
  updateRoomUser: vi.fn(),
}));

vi.mock('./playtestAdapters', () => ({
  initializeGameBot: vi.fn(),
  runGameBotTick: mocks.runGameBotTick,
  stopGameBot: vi.fn(),
}));

vi.mock('@convex-dev/presence', () => ({
  Presence: class {
    heartbeat = vi.fn();
    listRoom = vi.fn();
    removeRoomUser = vi.fn();
    updateRoomUser = mocks.updateRoomUser;
  },
}));

import { tick } from './playtests';

const tickHandler = (
  tick as unknown as {
    handler: (ctx: unknown, args: { runId: unknown }) => Promise<null>;
  }
).handler;

describe('playtest persistence', () => {
  beforeEach(() => {
    mocks.runGameBotTick.mockReset();
    mocks.runGameBotTick.mockResolvedValue({ cursor: { x: 0.4, y: 0.6 } });
    mocks.updateRoomUser.mockReset();
    mocks.updateRoomUser.mockResolvedValue(null);
  });

  it('keeps ticking seated bots after the current game completes', async () => {
    const run = {
      _id: 'run-1',
      roomId: 'room-1',
      gameType: 'doodleDash',
      status: 'running',
      isActive: true,
      provisionedBotCount: 1,
      tickCursor: 1,
      lastTickAt: Number.MAX_SAFE_INTEGER,
    };
    const room = {
      _id: 'room-1',
      gameType: 'doodleDash',
      currentGameId: 'room-game-1',
      status: 'open',
    };
    const bot = {
      _id: 'bot-1',
      runId: 'run-1',
      roomId: 'room-1',
      memberId: 'member-1',
      botNumber: 1,
      displayName: 'Bot 01',
      isActive: true,
      lastPresenceHeartbeatAt: Date.now(),
    };
    let botQueryCount = 0;
    const patch = vi.fn(async () => null);
    const runAfter = vi.fn(async () => 'scheduled-1');
    const get = vi.fn(async (table: string) => {
      if (table === 'playtestRuns') return run;
      if (table === 'rooms') return room;
      if (table === 'roomGames') return { _id: 'room-game-1', roomId: 'room-1', status: 'complete' };
      return null;
    });
    const ctx = {
      db: {
        get,
        patch,
        query: vi.fn((table: string) => {
          if (table !== 'playtestBots') throw new Error(`Unexpected table: ${table}`);
          botQueryCount += 1;
          return {
            withIndex: vi.fn(() => ({
              take: vi.fn(async () => (botQueryCount === 1 ? [bot] : [])),
            })),
          };
        }),
      },
      scheduler: { runAfter },
    };

    await tickHandler(ctx, { runId: 'run-1' });

    expect(get).not.toHaveBeenCalledWith('roomGames', 'room-game-1');
    expect(mocks.runGameBotTick).toHaveBeenCalledWith(ctx, room, bot);
    expect(mocks.updateRoomUser).toHaveBeenCalledWith(ctx, 'room-1', 'member-1', {
      x: 0.4,
      y: 0.6,
      displayName: 'Bot 01',
    });
    expect(patch).toHaveBeenCalledWith('playtestRuns', 'run-1', expect.objectContaining({ tickCursor: 1 }));
    expect(runAfter).toHaveBeenCalledWith(75, 'internal.playtests.tick', { runId: 'run-1' });
  });
});
