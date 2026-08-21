import { v } from 'convex/values';

export const GAME_TYPES = ['trivia', 'typeRacer'] as const;
export type GameType = (typeof GAME_TYPES)[number];

/**
 * The games currently supported by the platform.
 *
 * Add new games here so shared room infrastructure can identify and route to
 * them without absorbing game-specific state.
 */
export const gameTypeValidator = v.union(v.literal('trivia'), v.literal('typeRacer'));
