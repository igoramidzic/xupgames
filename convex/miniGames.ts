import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { configureGameHandler, startGameHandler } from './officialGames/miniGames/game';
import { submitCircleCenterHandler } from './officialGames/miniGames/games/circleCenter/submission';
import { submitOrangeEmojisHandler } from './officialGames/miniGames/games/orangeEmojis/submission';
// Legacy scoring path for a map round that was already in progress when the challenge was retired.
import { submitMapPointHandler } from './officialGames/miniGames/games/pointOnMap/submission';
import { submitStraightLineHandler } from './officialGames/miniGames/games/straightLine/submission';
import { advanceRoundHandler, beginRoundHandler, finalizeRoundHandler } from './officialGames/miniGames/rounds';
import { submitEstimateHandler } from './officialGames/miniGames/submissions';
import { gameViewValidator, miniGameIdValidator, pointValidator } from './officialGames/miniGames/validators';
import { getGameHandler } from './officialGames/miniGames/view';

export const getGame = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: gameViewValidator,
  handler: getGameHandler,
});

export const configureGame = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), roundCount: v.number() },
  returns: v.null(),
  handler: configureGameHandler,
});

export const startGame = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.object({ gameNumber: v.number(), roundNumber: v.number(), miniGameId: miniGameIdValidator }),
  handler: startGameHandler,
});

export const submitStraightLine = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    points: v.array(pointValidator),
  },
  returns: v.object({ score: v.number(), straightness: v.number(), timeMs: v.number() }),
  handler: submitStraightLineHandler,
});

export const submitOrangeEmojis = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), clickedIds: v.array(v.string()) },
  returns: v.object({ score: v.number(), accuracy: v.number(), timeMs: v.number() }),
  handler: submitOrangeEmojisHandler,
});

export const submitEstimate = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), guess: v.number() },
  returns: v.object({ score: v.number(), error: v.number(), timeMs: v.number() }),
  handler: submitEstimateHandler,
});

export const submitCircleCenter = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), point: pointValidator },
  returns: v.object({ score: v.number(), error: v.number(), timeMs: v.number() }),
  handler: submitCircleCenterHandler,
});

export const submitMapPoint = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), point: pointValidator },
  returns: v.object({ score: v.number(), errorKm: v.number(), timeMs: v.number() }),
  handler: submitMapPointHandler,
});

const roundScheduleArgs = {
  stateId: v.id('miniGamesGameStates'),
  gameNumber: v.number(),
  roundNumber: v.number(),
};

export const beginRound = internalMutation({
  args: roundScheduleArgs,
  returns: v.null(),
  handler: beginRoundHandler,
});

export const finalizeRound = internalMutation({
  args: roundScheduleArgs,
  returns: v.null(),
  handler: finalizeRoundHandler,
});

export const advanceRound = internalMutation({
  args: roundScheduleArgs,
  returns: v.null(),
  handler: advanceRoundHandler,
});
