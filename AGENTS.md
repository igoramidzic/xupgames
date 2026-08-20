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

Xup Games is a platform for multiple games. Drawing is only the first game.

- Keep shared infrastructure such as rooms, memberships, identity, access, and presence game-neutral.
- Put game-specific state and behavior in game-specific tables and modules linked back to the shared room.
- Design infrastructure and new cross-cutting features to support every game. Only specialize for one game when the task explicitly targets that game.
- Treat `gameType` as the routing boundary between shared room infrastructure and each game's implementation.
