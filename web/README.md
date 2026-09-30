# Web

The React and TypeScript frontend is built with Vite.

Production hosting uses the Cloudflare Worker `xupgames`, configured by the root
`wrangler.jsonc`. See [deployment setup](../README.md#cloudflare-workers-deployment)
for build variables, deployment commands, and direct room-link routing.

Complete the repository-level [first-time setup](../README.md#first-time-setup)
before running the web app by itself. `web/.env.development` selects the shared
development Convex backend, and `web/.env.production` selects production.
For your own development deployment, set `VITE_CONVEX_URL` in
`web/.env.development.local`. A shell/build environment `VITE_CONVEX_URL`
overrides all files. Use `pnpm build:web:preview` for a build against development.

Run it from the repository root:

```bash
pnpm dev:web
```

Formatting and linting are configured with Biome at the workspace root. Run the full quality gate with:

```bash
pnpm check
```

To apply formatting and safe fixes, run:

```bash
pnpm check:write
```

Game UI belongs under `src/games/official/` or `src/games/community/`. Read
[`web/AGENTS.md`](AGENTS.md) and the [game contributor guide](../docs/games/create-a-game.mdx)
before registering a new game.
