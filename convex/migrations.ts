import { Migrations } from '@convex-dev/migrations';
import { components } from './_generated/api';
import schema from './schema';

export const migrations = new Migrations(components.migrations, { schema });

export const moveDrawingStateOutOfRooms = migrations.define({
  table: 'rooms',
  migrateOne: async (ctx, room) => {
    const existingState = await ctx.db
      .query('drawingGameStates')
      .withIndex('by_roomId', (index) => index.eq('roomId', room._id))
      .unique();

    if (existingState === null) {
      const newestStroke = await ctx.db
        .query('drawingStrokes')
        .withIndex('by_roomId_and_sequence', (index) => index.eq('roomId', room._id))
        .order('desc')
        .first();
      await ctx.db.insert('drawingGameStates', {
        roomId: room._id,
        nextStrokeSequence: (newestStroke?.sequence ?? 0) + 1,
      });
    }
  },
});

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

    if (room.currentGameId === undefined) {
      let status: 'lobby' | 'active' | 'complete';
      switch (room.gameType) {
        case 'drawing': {
          const state = await ctx.db
            .query('drawingGameStates')
            .withIndex('by_roomId', (index) => index.eq('roomId', room._id))
            .unique();
          status = state?.phase === 'complete' ? 'complete' : 'active';
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

export const backfillDrawingGameLifecycle = migrations.define({
  table: 'drawingGameStates',
  migrateOne: async (ctx, state) => {
    if (state.firstStrokeSequence !== undefined && state.phase !== undefined) {
      return;
    }
    const room = await ctx.db.get('rooms', state.roomId);
    const roomGame = room?.currentGameId ? await ctx.db.get('roomGames', room.currentGameId) : null;
    await ctx.db.patch('drawingGameStates', state._id, {
      firstStrokeSequence: state.firstStrokeSequence ?? 1,
      phase: state.phase ?? (roomGame?.status === 'complete' ? 'complete' : 'active'),
    });
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
