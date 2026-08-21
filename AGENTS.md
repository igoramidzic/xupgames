<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Multi-game architecture

Xup Games is a platform for multiple games.

- Keep shared infrastructure such as rooms, memberships, identity, access, and presence game-neutral.
- Put game-specific state and behavior in game-specific tables and modules linked back to the shared room.
- Design infrastructure and new cross-cutting features to support every game. Only specialize for one game when the task explicitly targets that game.
- Treat `gameType` as the routing boundary between shared room infrastructure and each game's implementation.
- Never add a game-specific field to `rooms`, `roomMembers`, guest identity, passwords, presence, or next-game voting. Extend a game adapter instead.

## Official and community games

- Official games are maintained with Xup Games. Their backend lifecycle adapters live in `convex/officialGames/<gameType>/`, and their web UI lives in `web/src/games/official/<game-slug>/`.
- Community games are independently attributed contributions. Each backend lives in its own local Convex Component under `convex/communityGames/<gameType>/`, and each web UI lives under `web/src/games/community/<game-slug>/`.
- A local Convex Component is the required boundary for community game state. It cannot read parent-app tables or another component's tables unless the parent explicitly passes data through a narrow function API.
- Component isolation does not remove the need for review. Do not pass broad function handles, raw session tokens, secrets, or unrelated room/member data into community components.
- Shared app wrappers own authorization. They validate the guest session, active room membership, owner-only actions, and the room's `gameType` before calling a game component.
- `convex/gameRegistry.ts` owns the source-controlled manifest, `convex/games.ts` owns the catalog API/sync, and `gameDefinitions` owns the runtime database catalog. Every game records its name, description, author name/URL, source (`official` or `community`), enabled state, and sort order.
- Keep routing centralized: backend lifecycle routing belongs in `convex/gameRouter.ts`; web room routing belongs in `web/src/games/GameRoom.tsx`; web presentation metadata belongs in `web/src/games/registry.tsx`.

## Adding a game

Read `docs/games/create-a-game.mdx` before editing. A complete game contribution includes:

1. A stable `gameType`, catalog manifest, and runtime catalog sync.
2. Isolated backend state plus lifecycle and authorization adapters.
3. A colocated web room, preview, presentation registration, and source/author display.
4. Tests for wrong-game access, membership/owner authorization, lifecycle reset, UI routing, and the responsive game picker.
5. Updated contributor docs if the extension contract changes.

Do not mark a game enabled until its backend adapter, web room route, presentation, metadata, and tests all ship together.
