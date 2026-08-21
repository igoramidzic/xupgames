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
import type * as cursorPresence from "../cursorPresence.js";
import type * as domain from "../domain.js";
import type * as drawing from "../drawing.js";
import type * as games from "../games.js";
import type * as migrations from "../migrations.js";
import type * as passwords from "../passwords.js";
import type * as playtestAdapters_drawing from "../playtestAdapters/drawing.js";
import type * as playtestAdapters_index from "../playtestAdapters/index.js";
import type * as playtestAdapters_trivia from "../playtestAdapters/trivia.js";
import type * as playtests from "../playtests.js";
import type * as roomMembers from "../roomMembers.js";
import type * as roomPresence from "../roomPresence.js";
import type * as rooms from "../rooms.js";
import type * as trivia from "../trivia.js";
import type * as triviaEngine from "../triviaEngine.js";
import type * as triviaQuestions from "../triviaQuestions.js";
import type * as triviaScoring from "../triviaScoring.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  "__mocks__/_generated/api": typeof __mocks____generated_api;
  "__mocks__/_generated/server": typeof __mocks____generated_server;
  cursorPresence: typeof cursorPresence;
  domain: typeof domain;
  drawing: typeof drawing;
  games: typeof games;
  migrations: typeof migrations;
  passwords: typeof passwords;
  "playtestAdapters/drawing": typeof playtestAdapters_drawing;
  "playtestAdapters/index": typeof playtestAdapters_index;
  "playtestAdapters/trivia": typeof playtestAdapters_trivia;
  playtests: typeof playtests;
  roomMembers: typeof roomMembers;
  roomPresence: typeof roomPresence;
  rooms: typeof rooms;
  trivia: typeof trivia;
  triviaEngine: typeof triviaEngine;
  triviaQuestions: typeof triviaQuestions;
  triviaScoring: typeof triviaScoring;
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
};
