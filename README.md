# Xup Games

A multiplayer game platform monorepo with:

- **React** web app (`web/`) — Vite, React Router, shadcn/ui, and Tailwind CSS
- **Convex** backend (`convex/`) — realtime application data and functions
- **Astro** marketing + blog site (`site/`)
- **Mintlify** docs (`docs/`)

## Setup

```bash
pnpm install
```

Copy `web/.env.example` to `web/.env.local` and configure the Convex URL.

## Development

```bash
# Web app and Convex backend
pnpm dev

# Web app only
pnpm dev:web

# Astro site
pnpm dev:site

# Mintlify docs
pnpm dev:docs
```

## Build

```bash
pnpm build
pnpm build:site
```
