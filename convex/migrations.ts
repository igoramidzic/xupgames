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
