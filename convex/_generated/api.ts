/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as __mocks____generated_api from "../__mocks__/_generated/api.js";
import type * as __mocks____generated_server from "../__mocks__/_generated/server.js";
import type * as communityGameAdapters_trendline from "../communityGameAdapters/trendline.js";
import type * as cursorPresence from "../cursorPresence.js";
import type * as domain from "../domain.js";
import type * as doodleDash from "../doodleDash.js";
import type * as doodleDashEngine from "../doodleDashEngine.js";
import type * as doodleDashScoring from "../doodleDashScoring.js";
import type * as doodleDashWords from "../doodleDashWords.js";
import type * as gameRegistry from "../gameRegistry.js";
import type * as gameRouter from "../gameRouter.js";
import type * as games from "../games.js";
import type * as migrations from "../migrations.js";
import type * as miniGames from "../miniGames.js";
import type * as nextGameVoting from "../nextGameVoting.js";
import type * as officialGames_doodleDash_lifecycle from "../officialGames/doodleDash/lifecycle.js";
import type * as officialGames_miniGames_challengeSubmissions from "../officialGames/miniGames/challengeSubmissions.js";
import type * as officialGames_miniGames_game from "../officialGames/miniGames/game.js";
import type * as officialGames_miniGames_games_batteryPercentage_index from "../officialGames/miniGames/games/batteryPercentage/index.js";
import type * as officialGames_miniGames_games_circleCenter_index from "../officialGames/miniGames/games/circleCenter/index.js";
import type * as officialGames_miniGames_games_circleCenter_submission from "../officialGames/miniGames/games/circleCenter/submission.js";
import type * as officialGames_miniGames_games_guessDistance_index from "../officialGames/miniGames/games/guessDistance/index.js";
import type * as officialGames_miniGames_games_guessPercentage_index from "../officialGames/miniGames/games/guessPercentage/index.js";
import type * as officialGames_miniGames_games_newChallenges from "../officialGames/miniGames/games/newChallenges.js";
import type * as officialGames_miniGames_games_orangeEmojis_index from "../officialGames/miniGames/games/orangeEmojis/index.js";
import type * as officialGames_miniGames_games_orangeEmojis_submission from "../officialGames/miniGames/games/orangeEmojis/submission.js";
import type * as officialGames_miniGames_games_pointOnMap_index from "../officialGames/miniGames/games/pointOnMap/index.js";
import type * as officialGames_miniGames_games_pointOnMap_submission from "../officialGames/miniGames/games/pointOnMap/submission.js";
import type * as officialGames_miniGames_games_straightLine_index from "../officialGames/miniGames/games/straightLine/index.js";
import type * as officialGames_miniGames_games_straightLine_submission from "../officialGames/miniGames/games/straightLine/submission.js";
import type * as officialGames_miniGames_lifecycle from "../officialGames/miniGames/lifecycle.js";
import type * as officialGames_miniGames_registry from "../officialGames/miniGames/registry.js";
import type * as officialGames_miniGames_results from "../officialGames/miniGames/results.js";
import type * as officialGames_miniGames_rounds from "../officialGames/miniGames/rounds.js";
import type * as officialGames_miniGames_shared from "../officialGames/miniGames/shared.js";
import type * as officialGames_miniGames_state from "../officialGames/miniGames/state.js";
import type * as officialGames_miniGames_submissions from "../officialGames/miniGames/submissions.js";
import type * as officialGames_miniGames_validators from "../officialGames/miniGames/validators.js";
import type * as officialGames_miniGames_view from "../officialGames/miniGames/view.js";
import type * as officialGames_promptArcade_engine from "../officialGames/promptArcade/engine.js";
import type * as officialGames_promptArcade_game from "../officialGames/promptArcade/game.js";
import type * as officialGames_promptArcade_generation from "../officialGames/promptArcade/generation.js";
import type * as officialGames_promptArcade_lifecycle from "../officialGames/promptArcade/lifecycle.js";
import type * as officialGames_promptArcade_providerRetry from "../officialGames/promptArcade/providerRetry.js";
import type * as officialGames_promptArcade_rounds from "../officialGames/promptArcade/rounds.js";
import type * as officialGames_promptArcade_state from "../officialGames/promptArcade/state.js";
import type * as officialGames_promptArcade_validators from "../officialGames/promptArcade/validators.js";
import type * as officialGames_promptArcade_view from "../officialGames/promptArcade/view.js";
import type * as officialGames_trivia_lifecycle from "../officialGames/trivia/lifecycle.js";
import type * as officialGames_typeRacer_lifecycle from "../officialGames/typeRacer/lifecycle.js";
import type * as passwords from "../passwords.js";
import type * as playtestAdapters_doodleDash from "../playtestAdapters/doodleDash.js";
import type * as playtestAdapters_index from "../playtestAdapters/index.js";
import type * as playtestAdapters_promptArcade from "../playtestAdapters/promptArcade.js";
import type * as playtestAdapters_trendline from "../playtestAdapters/trendline.js";
import type * as playtestAdapters_trivia from "../playtestAdapters/trivia.js";
import type * as playtestAdapters_typeRacer from "../playtestAdapters/typeRacer.js";
import type * as playtestLifecycle from "../playtestLifecycle.js";
import type * as playtests from "../playtests.js";
import type * as promptArcade from "../promptArcade.js";
import type * as promptArcadeActions from "../promptArcadeActions.js";
import type * as roomAccess from "../roomAccess.js";
import type * as roomGames from "../roomGames.js";
import type * as roomMembers from "../roomMembers.js";
import type * as roomPresence from "../roomPresence.js";
import type * as rooms from "../rooms.js";
import type * as trendline from "../trendline.js";
import type * as trendlineWorldBank from "../trendlineWorldBank.js";
import type * as trivia from "../trivia.js";
import type * as triviaEngine from "../triviaEngine.js";
import type * as triviaQuestions from "../triviaQuestions.js";
import type * as triviaScoring from "../triviaScoring.js";
import type * as typeRacer from "../typeRacer.js";
import type * as typeRacerPassages from "../typeRacerPassages.js";
import type * as typeRacerScoring from "../typeRacerScoring.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  "__mocks__/_generated/api": typeof __mocks____generated_api;
  "__mocks__/_generated/server": typeof __mocks____generated_server;
  "communityGameAdapters/trendline": typeof communityGameAdapters_trendline;
  cursorPresence: typeof cursorPresence;
  domain: typeof domain;
  doodleDash: typeof doodleDash;
  doodleDashEngine: typeof doodleDashEngine;
  doodleDashScoring: typeof doodleDashScoring;
  doodleDashWords: typeof doodleDashWords;
  gameRegistry: typeof gameRegistry;
  gameRouter: typeof gameRouter;
  games: typeof games;
  migrations: typeof migrations;
  miniGames: typeof miniGames;
  nextGameVoting: typeof nextGameVoting;
  "officialGames/doodleDash/lifecycle": typeof officialGames_doodleDash_lifecycle;
  "officialGames/miniGames/challengeSubmissions": typeof officialGames_miniGames_challengeSubmissions;
  "officialGames/miniGames/game": typeof officialGames_miniGames_game;
  "officialGames/miniGames/games/batteryPercentage/index": typeof officialGames_miniGames_games_batteryPercentage_index;
  "officialGames/miniGames/games/circleCenter/index": typeof officialGames_miniGames_games_circleCenter_index;
  "officialGames/miniGames/games/circleCenter/submission": typeof officialGames_miniGames_games_circleCenter_submission;
  "officialGames/miniGames/games/guessDistance/index": typeof officialGames_miniGames_games_guessDistance_index;
  "officialGames/miniGames/games/guessPercentage/index": typeof officialGames_miniGames_games_guessPercentage_index;
  "officialGames/miniGames/games/newChallenges": typeof officialGames_miniGames_games_newChallenges;
  "officialGames/miniGames/games/orangeEmojis/index": typeof officialGames_miniGames_games_orangeEmojis_index;
  "officialGames/miniGames/games/orangeEmojis/submission": typeof officialGames_miniGames_games_orangeEmojis_submission;
  "officialGames/miniGames/games/pointOnMap/index": typeof officialGames_miniGames_games_pointOnMap_index;
  "officialGames/miniGames/games/pointOnMap/submission": typeof officialGames_miniGames_games_pointOnMap_submission;
  "officialGames/miniGames/games/straightLine/index": typeof officialGames_miniGames_games_straightLine_index;
  "officialGames/miniGames/games/straightLine/submission": typeof officialGames_miniGames_games_straightLine_submission;
  "officialGames/miniGames/lifecycle": typeof officialGames_miniGames_lifecycle;
  "officialGames/miniGames/registry": typeof officialGames_miniGames_registry;
  "officialGames/miniGames/results": typeof officialGames_miniGames_results;
  "officialGames/miniGames/rounds": typeof officialGames_miniGames_rounds;
  "officialGames/miniGames/shared": typeof officialGames_miniGames_shared;
  "officialGames/miniGames/state": typeof officialGames_miniGames_state;
  "officialGames/miniGames/submissions": typeof officialGames_miniGames_submissions;
  "officialGames/miniGames/validators": typeof officialGames_miniGames_validators;
  "officialGames/miniGames/view": typeof officialGames_miniGames_view;
  "officialGames/promptArcade/engine": typeof officialGames_promptArcade_engine;
  "officialGames/promptArcade/game": typeof officialGames_promptArcade_game;
  "officialGames/promptArcade/generation": typeof officialGames_promptArcade_generation;
  "officialGames/promptArcade/lifecycle": typeof officialGames_promptArcade_lifecycle;
  "officialGames/promptArcade/providerRetry": typeof officialGames_promptArcade_providerRetry;
  "officialGames/promptArcade/rounds": typeof officialGames_promptArcade_rounds;
  "officialGames/promptArcade/state": typeof officialGames_promptArcade_state;
  "officialGames/promptArcade/validators": typeof officialGames_promptArcade_validators;
  "officialGames/promptArcade/view": typeof officialGames_promptArcade_view;
  "officialGames/trivia/lifecycle": typeof officialGames_trivia_lifecycle;
  "officialGames/typeRacer/lifecycle": typeof officialGames_typeRacer_lifecycle;
  passwords: typeof passwords;
  "playtestAdapters/doodleDash": typeof playtestAdapters_doodleDash;
  "playtestAdapters/index": typeof playtestAdapters_index;
  "playtestAdapters/promptArcade": typeof playtestAdapters_promptArcade;
  "playtestAdapters/trendline": typeof playtestAdapters_trendline;
  "playtestAdapters/trivia": typeof playtestAdapters_trivia;
  "playtestAdapters/typeRacer": typeof playtestAdapters_typeRacer;
  playtestLifecycle: typeof playtestLifecycle;
  playtests: typeof playtests;
  promptArcade: typeof promptArcade;
  promptArcadeActions: typeof promptArcadeActions;
  roomAccess: typeof roomAccess;
  roomGames: typeof roomGames;
  roomMembers: typeof roomMembers;
  roomPresence: typeof roomPresence;
  rooms: typeof rooms;
  trendline: typeof trendline;
  trendlineWorldBank: typeof trendlineWorldBank;
  trivia: typeof trivia;
  triviaEngine: typeof triviaEngine;
  triviaQuestions: typeof triviaQuestions;
  triviaScoring: typeof triviaScoring;
  typeRacer: typeof typeRacer;
  typeRacerPassages: typeof typeRacerPassages;
  typeRacerScoring: typeof typeRacerScoring;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  trendline: import("../communityGames/trendline/_generated/component.js").ComponentApi<"trendline">;
};
