# Convex backend guide

Read `_generated/ai/guidelines.md` and `schema.ts` completely before changing
backend code. Run Convex codegen/typecheck and the repository test suite before
finishing.

## Architecture boundaries

- `rooms`, `roomGames`, `roomMembers`, guest identity, access control, presence,
  and next-game voting are shared platform infrastructure. Keep them
  game-neutral.
- `rooms.gameType` is the routing boundary. A room points to exactly one
  implementation; game-specific state must not be stored on `rooms`.
- `gameRegistry.ts` owns the source-controlled implementation/catalog manifests;
  `games.ts` exposes the public `games.listAvailable` catalog query. Runtime metadata lives in the
  `gameDefinitions` table. Every game needs a name, description, author, source
  (`official` or `community`), enabled state, and sort order.
- `gameRouter.ts` is the only platform switch over game lifecycle adapters. Do
  not scatter new `gameType` switches through room, membership, or presence
  modules.
- Official game adapters and backend-only helpers belong in
  `officialGames/<gameType>/`. Existing public API modules can remain at the
  Convex root for client compatibility, but new implementation logic should be
  kept behind that adapter boundary.
- Community game state and behavior belong in one local Convex Component per
  game under `communityGames/<gameType>/`. Mount it in `convex.config.ts`.
  Component functions are not called by browsers; app-side public wrappers
  authorize with `requireRoomMember` and call the component through
  `components.<gameType>`.

## Adding a game

1. Choose a stable lower-camel-case `gameType`. Never rename a shipped value;
   it is stored in rooms, game history, votes, and playtests.
2. Add the value to `GAME_TYPES` and `gameTypeValidator`, then add its full
   manifest to `GAME_DEFINITIONS` in `gameRegistry.ts`.
3. For an official game, put state tables in `schema.ts` and lifecycle code in
   `officialGames/<gameType>/`. For a community game, copy the template in
   `communityGames/template/`, give the component its own schema, and mount it.
4. Register initialization, reset, membership, completion, and playtest hooks
   in the central routers. Unsupported hooks must fail clearly; never silently
   run a different game's behavior.
5. Expose only small app-side queries/mutations. Validate the session and active
   membership with `requireRoomMember`, require ownership where appropriate,
   confirm `room.gameType`, and pass only the minimum identifiers/data across a
   component boundary. Never pass raw session tokens into components.
6. Add bounded, indexed reads, validators (including returns), and tests for
   authorization, wrong-game routing, capacity, lifecycle, and retries.
7. Run `pnpm exec convex codegen --typecheck enable`, `pnpm exec tsc --noEmit
   -p convex/tsconfig.json`, `pnpm test:ci`, and `git diff --check`.
8. After deploy, run the idempotent catalog sync:
   `pnpm exec convex run games:syncCatalog`.

## Community component rules

- A component owns only its game's operational state. It must not duplicate
  rooms, members, identity, passwords, presence, catalog metadata, or voting.
- Store parent app IDs as validated strings inside a component. Convex table IDs
  do not retain their `Id<...>` type across component boundaries.
- Components cannot read app tables. Preserve that isolation: do not pass
  function handles that provide broad database access.
- Public component functions are internal to the parent app. Still validate all
  component arguments and returns; the app wrapper remains responsible for
  authentication and authorization.
- Component mutations can participate transactionally in an app mutation. Keep
  related room lifecycle and component state changes in the same top-level
  mutation so they commit or roll back together.
- Do not put generic JSON blobs or `v.any()` state in a shared community table.
  Each game should have a typed schema it can evolve without touching another
  game.
- A component is data/function isolation, not a substitute for code review.
  Reject untrusted network access, secrets, or broad function handles during
  review.
