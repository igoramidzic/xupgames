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
`.env.local`; the Vite config reads that root URL automatically.

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
`web/.env.example` to `web/.env.local` and set `VITE_CONVEX_URL`. Backend secrets
belong in Convex deployment environment variables, never in a Vite variable.

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
