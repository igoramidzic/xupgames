import { v } from 'convex/values';

export const GAME_TYPES = ['doodleDash', 'miniGames', 'promptArcade', 'trivia', 'typeRacer', 'trendline'] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const gameTypeValidator = v.union(
  v.literal('doodleDash'),
  v.literal('miniGames'),
  v.literal('promptArcade'),
  v.literal('trivia'),
  v.literal('typeRacer'),
  v.literal('trendline')
);
export const gameSourceValidator = v.union(v.literal('official'), v.literal('community'));
export type GameSource = 'official' | 'community';

export type StaticGameDefinition = {
  gameType: GameType;
  name: string;
  description: string;
  authorName: string;
  authorUrl: string | null;
  source: GameSource;
  isEnabled: boolean;
  sortOrder: number;
};

/**
 * Source-controlled manifests are the implementation registry and safe rollout
 * fallback. The database is the runtime catalog used by clients.
 *
 * Adding a game requires a manifest here and a game adapter. Community game
 * state belongs in a local Convex component under `communityGames/`; do not put
 * it in the shared platform schema.
 */
export const GAME_DEFINITIONS = [
  {
    gameType: 'doodleDash',
    name: 'Doodle Dash',
    description: 'Take turns drawing secret words while everyone races to guess them.',
    authorName: 'Xup Games',
    authorUrl: null,
    source: 'official',
    isEnabled: true,
    sortOrder: 5,
  },
  {
    gameType: 'typeRacer',
    name: 'Type Racer',
    description: 'Race friends through the same passage with live progress, speed, and accuracy.',
    authorName: 'Xup Games',
    authorUrl: null,
    source: 'official',
    isEnabled: true,
    sortOrder: 10,
  },
  {
    gameType: 'miniGames',
    name: 'Mini Game Mix',
    description: 'Spin through a rapid playlist of tiny skill challenges and build the highest score.',
    authorName: 'Xup Games',
    authorUrl: null,
    source: 'official',
    isEnabled: true,
    sortOrder: 15,
  },
  {
    gameType: 'trivia',
    name: 'Trivia',
    description: 'A fast ten-question trivia sprint for the whole room.',
    authorName: 'Xup Games',
    authorUrl: null,
    source: 'official',
    isEnabled: true,
    sortOrder: 20,
  },
  {
    gameType: 'promptArcade',
    name: 'Prompt Arcade',
    description: 'Invent a tiny game, watch it materialize, then race through every player-made challenge.',
    authorName: 'Xup Games',
    authorUrl: null,
    source: 'official',
    isEnabled: true,
    sortOrder: 25,
  },
  {
    gameType: 'trendline',
    name: 'Trendline',
    description: 'Draw the shape of real-world data, then see how closely your prediction follows history.',
    authorName: 'Igor Amidzic',
    authorUrl: null,
    source: 'community',
    isEnabled: true,
    sortOrder: 30,
  },
] as const satisfies readonly StaticGameDefinition[];
