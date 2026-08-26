import { Migrations } from '@convex-dev/migrations';
import { components } from './_generated/api';
import schema from './schema';

export const migrations = new Migrations(components.migrations, { schema });

export const initializeRoomGameLifecycle = migrations.define({
  table: 'rooms',
  migrateOne: async (ctx, room) => {
    const roomPatch: {
      currentGameId?: (typeof room)['currentGameId'];
      ownershipVersion?: number;
      ownershipReason?: 'created' | 'transferred' | 'claimed';
      ownerChangedAt?: number;
    } = {};

    if (room.ownershipVersion === undefined) {
      roomPatch.ownershipVersion = 0;
      roomPatch.ownershipReason = 'created';
      roomPatch.ownerChangedAt = room.createdAt;
    }

    if (room.currentGameId === undefined && room.gameType !== undefined) {
      let status: 'lobby' | 'active' | 'complete';
      switch (room.gameType) {
        case 'doodleDash': {
          // Doodle Dash was introduced after this migration, so there is no
          // legacy active state to recover.
          status = 'lobby';
          break;
        }
        case 'miniGames': {
          // Mini Game Mix was introduced after this migration, so there is no
          // legacy active state to recover.
          status = 'lobby';
          break;
        }
        case 'trivia': {
          const state = await ctx.db
            .query('triviaGameStates')
            .withIndex('by_roomId', (index) => index.eq('roomId', room._id))
            .unique();
          status = state?.phase === 'complete' ? 'complete' : state?.phase === 'lobby' ? 'lobby' : 'active';
          break;
        }
        case 'typeRacer': {
          const state = await ctx.db
            .query('typeRacerGameStates')
            .withIndex('by_roomId', (index) => index.eq('roomId', room._id))
            .unique();
          status = state?.phase === 'complete' ? 'complete' : state?.phase === 'lobby' ? 'lobby' : 'active';
          break;
        }
        case 'trendline': {
          // Trendline was introduced after this migration; no legacy rooms can
          // have an active component state to recover.
          status = 'lobby';
          break;
        }
      }
      roomPatch.currentGameId = await ctx.db.insert('roomGames', {
        roomId: room._id,
        gameType: room.gameType,
        sequence: 1,
        status,
        createdAt: room.createdAt,
        startedAt: status === 'lobby' ? null : room.createdAt,
        completedAt: status === 'complete' ? Date.now() : null,
      });
    }

    if (Object.keys(roomPatch).length > 0) {
      await ctx.db.patch('rooms', room._id, roomPatch);
    }
  },
});

export const backfillRoomMemberKinds = migrations.define({
  table: 'roomMembers',
  migrateOne: async (ctx, member) => {
    if (member.memberKind !== undefined) {
      return;
    }
    const playtestBot = await ctx.db
      .query('playtestBots')
      .withIndex('by_memberId', (index) => index.eq('memberId', member._id))
      .first();
    await ctx.db.patch('roomMembers', member._id, {
      memberKind: playtestBot === null ? 'player' : 'playtestBot',
    });
  },
});
