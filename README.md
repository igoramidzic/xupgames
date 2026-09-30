# Xup Games

Xup Games is an open-source multiplayer game platform. One player creates a
room, shares the link, and up to 50 people can play without accounts or installs.

The monorepo contains:

- `web/` — the React, Vite, Tailwind CSS, and shadcn/ui game client
- `convex/` — realtime rooms, access, game catalog, official games, and isolated community game components
- `site/` — the Astro marketing and blog site
- `docs/` — the Mintlify contributor documentation

## Requirements

- Node.js 24 (`.nvmrc`)
- pnpm 10
- A free Convex account, or the local anonymous Convex deployment offered by the CLI

## First-time setup

```bash
git clone <your-fork-url>
cd xupgames
corepack enable
pnpm install
pnpm setup:convex
```

`pnpm setup:convex` pushes the backend once and synchronizes the official and
community game catalog into the database. The first run prompts you to sign in
and create or select a Convex project, or to use a local anonymous deployment.
It writes the development deployment name and URL to the ignored root
`.env.local`. The web app defaults to Xup Games' development backend; to use
your own deployment, set its URL as `VITE_CONVEX_URL` in
`web/.env.development.local`.

If you already have a deployment, the setup command reuses it. To deliberately
choose another project, follow the [Convex project configuration guide](https://docs.convex.dev/cli/overview)
before rerunning setup.

Start the app:

```bash
pnpm dev
```

Open the Vite URL printed by the `web` process (normally
`http://localhost:5173`). For a manual two-terminal workflow, run
`pnpm dev:convex` and `pnpm dev:web` separately.

If you need to point only the web client at an existing deployment, copy
`web/.env.example` to `web/.env.development.local` and set `VITE_CONVEX_URL`. Backend secrets
belong in Convex deployment environment variables, never in a Vite variable.

Prompt Arcade also needs two Convex deployment environment variables before it
can generate player-authored games:

```bash
pnpm exec convex env set OPENAI_API_KEY '<your-api-key>'
pnpm exec convex env set OPENAI_PROMPT_ARCADE_MODEL '<responses-api-model-id>'
```

The model must support strict Structured Outputs in the OpenAI Responses API.
Neither value is sent to the browser or embedded in generated game code.

## Cloudflare Workers deployment

The game client is hosted on the existing Cloudflare Worker **`xupgames`**.
The root `wrangler.jsonc` serves `web/dist` as static assets and falls back to
`index.html` for browser navigation, so shared room links work on direct visits
and refreshes. Convex remains the realtime backend; no Worker script is needed.

In the `xupgames` Worker's **Settings → Build**, connect this repository and use:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (`/`) |
| Build command | `pnpm build:web` |
| Deploy command | `pnpm exec wrangler deploy` |
| Non-production branch deploy command (if enabled) | `pnpm exec wrangler versions upload` |
| Build variable `NODE_VERSION` | `24` |

The repository pins pnpm through `packageManager`. The public backend URLs are
configured in code: `web/.env.production` selects `peaceful-chicken-822` for
`pnpm build:web`, and `web/.env.development` selects `merry-albatross-626` for
`pnpm dev:web`. Use `pnpm build:web:preview` to build a preview against the
development backend. A normal build always uses production mode, even on a
non-production Git branch.

No Cloudflare `VITE_CONVEX_URL` build variable is required. An existing build
variable overrides these files, so remove it to use the checked-in defaults.
Vite embeds the URL during the build; Worker runtime variables cannot change it.
Keep backend secrets in Convex, never in `VITE_*` variables.

The production Convex deployment is `peaceful-chicken-822`; development uses
`merry-albatross-626`. Configure `OPENAI_API_KEY` and
`OPENAI_PROMPT_ARCADE_MODEL` separately in each deployment to use Prompt Arcade.

To deploy from your machine, authenticate once:

```bash
pnpm exec wrangler login
pnpm deploy:web
```

To validate the upload without publishing, run `pnpm build:web` followed by
`pnpm exec wrangler deploy --dry-run`. To check Cloudflare routing locally, run
`pnpm preview:cloudflare` after building, then open a room URL directly.

Custom domains remain configured on the existing Worker in Cloudflare. Backend
releases still use the separate **Deploy Convex to Production** GitHub workflow.
The Astro marketing site under `site/` is a separate build and is not included
in this Worker.

See Cloudflare's [static SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
and [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## How games are organized

Shared infrastructure owns rooms, guest identity, memberships, passwords,
presence, voting, and playtests. `gameType` is the only routing boundary into a
game implementation.

- Official backend adapters: `convex/officialGames/<gameType>/`
- Community backends: one local Convex Component per game in `convex/communityGames/<gameType>/`
- Official web games: `web/src/games/official/<game-slug>/`
- Community web games: `web/src/games/community/<game-slug>/`

Community components have their own schema, tables, functions, scheduler, and
storage boundary. Parent-app wrappers authenticate the room member before
passing minimal data into a component. See [Game architecture](docs/games/architecture.mdx)
and [Create a game](docs/games/create-a-game.mdx) before starting a contribution.

## Useful commands

```bash
pnpm dev                 # web + Convex watch mode
pnpm dev:web             # web only
pnpm dev:convex          # Convex only
pnpm setup:convex        # one-time push + idempotent catalog sync
pnpm dev:site            # Astro site
pnpm dev:docs            # Mintlify docs

pnpm check               # Biome formatting and lint
pnpm test:ci             # unit/integration tests once
pnpm build:web           # typecheck and build the web app
pnpm build:site          # build the marketing site
```

Run `pnpm check`, `pnpm test:ci`, and `pnpm build:web` before opening a pull
request. Backend contributors should also run
`pnpm exec convex codegen --typecheck enable` against their development
deployment.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). AI coding agents must also follow
the nearest `AGENTS.md`; the files under `convex/` and `web/` define the game
isolation, authorization, folder, visual-language, and verification contracts.
