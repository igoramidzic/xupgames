import { v } from 'convex/values';

/**
 * The games currently supported by the platform.
 *
 * Add new games here so shared room infrastructure can identify and route to
 * them without absorbing game-specific state.
 */
export const gameTypeValidator = v.union(v.literal('drawing'), v.literal('trivia'), v.literal('typeRacer'));
