# Contributing to Xup Games

Thanks for helping make multiplayer games easier to build and share.

1. Complete the first-time setup in [README.md](README.md).
2. Create a focused branch from `main`.
3. Read the nearest `AGENTS.md` before changing backend or web code.
4. For a new game, follow [Create a game](docs/games/create-a-game.mdx) from top to bottom.
5. Add tests with the implementation and keep shared room infrastructure game-neutral.
6. Run the repository quality gate before opening a pull request:

```bash
pnpm check
pnpm test:ci
pnpm build:web
git diff --check
```

Convex changes also require generated types and a development deployment check:

```bash
pnpm exec convex codegen --typecheck enable
pnpm exec tsc --noEmit -p convex/tsconfig.json
```

Do not include `.env.local`, deployment keys, session tokens, room passwords, or
other secrets in commits. Community game code is isolated with a Convex
Component, but it is still reviewed like any other code that runs in the Xup
Games deployment.
