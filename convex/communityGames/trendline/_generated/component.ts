/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    game: {
      abortStart: FunctionReference<
        "mutation",
        "internal",
        { preparationId: string; roomId: string },
        null,
        Name
      >;
      advanceAfterReveal: FunctionReference<
        "mutation",
        "internal",
        {
          gameNumber: number;
          nextStartsAt: number;
          now: number;
          roomId: string;
          roundNumber: number;
        },
        | { kind: "ignored" }
        | { kind: "complete" }
        | { kind: "countdown"; roundNumber: number },
        Name
      >;
      beginDrawing: FunctionReference<
        "mutation",
        "internal",
        {
          gameNumber: number;
          now: number;
          phaseEndsAt: number;
          roomId: string;
          roundNumber: number;
        },
        boolean,
        Name
      >;
      closeRound: FunctionReference<
        "mutation",
        "internal",
        {
          gameNumber: number;
          now: number;
          phaseEndsAt: number;
          roomId: string;
          roundNumber: number;
        },
        boolean,
        Name
      >;
      commitStart: FunctionReference<
        "mutation",
        "internal",
        {
          gameNumber: number;
          now: number;
          participants: Array<{ displayName: string; memberId: string }>;
          preparationId: string;
          roomId: string;
          rounds: Array<{
            axisMax: number;
            axisMin: number;
            category: string;
            countryCode: string;
            countryName: string;
            endYear: number;
            indicatorCode: string;
            indicatorName: string;
            licenseName: string;
            retrievedAt: number;
            sourceKey: string;
            sourceName: string;
            sourceOrganization: string;
            sourceUrl: string;
            startYear: number;
            unitLabel: string;
            valueDecimals: number;
            values: Array<number>;
          }>;
          startsAt: number;
        },
        boolean,
        Name
      >;
      enrollMember: FunctionReference<
        "mutation",
        "internal",
        {
          member: { displayName: string; memberId: string };
          now: number;
          roomId: string;
        },
        boolean,
        Name
      >;
      getBotContext: FunctionReference<
        "query",
        "internal",
        { botId: string; roomId: string },
        null | {
          actualValues: Array<number> | null;
          phase:
            | "lobby"
            | "preparing"
            | "countdown"
            | "drawing"
            | "reveal"
            | "complete";
          phaseEndsAt: number | null;
          phaseStartedAt: number | null;
          plan: null | {
            plannedRoundId: string | null;
            submitAt: number;
            submitted: boolean;
          };
          roundId: string | null;
        },
        Name
      >;
      getGameView: FunctionReference<
        "query",
        "internal",
        { memberId: string; roomId: string },
        null | {
          currentRoundNumber: number;
          gameNumber: number;
          leaderboard: Array<{
            bestRoundPoints: number;
            displayName: string;
            memberId: string;
            pointsGained: number | null;
            roundsSubmitted: number;
            totalPoints: number;
          }>;
          phase:
            | "lobby"
            | "preparing"
            | "countdown"
            | "drawing"
            | "reveal"
            | "complete";
          phaseEndsAt: number | null;
          phaseStartedAt: number | null;
          playerPrediction: {
            meanAbsoluteError: number | null;
            pointsAwarded: number | null;
            shapeAccuracy: number | null;
            usedHint: boolean;
            values: Array<number>;
          } | null;
          round: {
            actualValues: Array<number> | null;
            axisMax: number;
            axisMin: number;
            category: string;
            countryCode: string;
            countryName: string;
            crowdMedianValues: Array<number> | null;
            endYear: number;
            firstValue: number;
            hintedEndValue: number | null;
            indicatorCode: string;
            indicatorName: string;
            roundId: string;
            roundNumber: number;
            source: null | {
              licenseName: string;
              name: string;
              organization: string;
              retrievedAt: number;
              url: string;
            };
            startYear: number;
            submittedCount: number;
            unitLabel: string;
            valueDecimals: number;
          } | null;
          totalRounds: number;
        },
        Name
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { roomId: string },
        null | {
          currentRoundNumber: number;
          gameNumber: number;
          phase:
            | "lobby"
            | "preparing"
            | "countdown"
            | "drawing"
            | "reveal"
            | "complete";
          phaseEndsAt: number | null;
          phaseStartedAt: number | null;
          totalRounds: number;
        },
        Name
      >;
      initialize: FunctionReference<
        "mutation",
        "internal",
        { roomId: string },
        null,
        Name
      >;
      listCachedRounds: FunctionReference<
        "query",
        "internal",
        {},
        Array<{
          axisMax: number;
          axisMin: number;
          category: string;
          countryCode: string;
          countryName: string;
          endYear: number;
          indicatorCode: string;
          indicatorName: string;
          licenseName: string;
          retrievedAt: number;
          sourceKey: string;
          sourceName: string;
          sourceOrganization: string;
          sourceUrl: string;
          startYear: number;
          unitLabel: string;
          valueDecimals: number;
          values: Array<number>;
        }>,
        Name
      >;
      prepare: FunctionReference<
        "mutation",
        "internal",
        { roomId: string },
        null,
        Name
      >;
      reserveStart: FunctionReference<
        "mutation",
        "internal",
        { now: number; preparationId: string; roomId: string },
        | { gameNumber: number; kind: "reserved" }
        | { kind: "in_progress" }
        | { kind: "complete" }
        | { kind: "missing" },
        Name
      >;
      revealHint: FunctionReference<
        "mutation",
        "internal",
        { memberId: string; now: number; roomId: string; roundId: string },
        | { endValue: number; kind: "revealed" }
        | { kind: "closed" }
        | { kind: "not_running" },
        Name
      >;
      setBotPlan: FunctionReference<
        "mutation",
        "internal",
        {
          botId: string;
          plannedRoundId: string | null;
          roomId: string;
          submitAt: number;
          submitted: boolean;
        },
        null,
        Name
      >;
      submitPrediction: FunctionReference<
        "mutation",
        "internal",
        {
          eligibleMemberIds: Array<string>;
          memberId: string;
          now: number;
          roomId: string;
          roundId: string;
          values: Array<number>;
        },
        | {
            allLockedIn: boolean;
            gameNumber: number;
            kind: "accepted";
            roundNumber: number;
          }
        | { kind: "existing" }
        | { kind: "not_running" }
        | { kind: "closed" },
        Name
      >;
    };
  };
