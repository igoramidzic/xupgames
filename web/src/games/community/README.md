# Community game UI

Create one folder per game here. Keep the game room, picker preview, tests, hooks,
and game-only styles together, then make only two shared registrations:

1. Add the icon, accent, and preview to `../registry.tsx`.
2. Add the room component to `../GameRoom.tsx`.

The game's name, description, author, source badge, enabled state, and ordering
come from the Convex game catalog. Follow `../../../../docs/games/create-a-game.mdx`
for the complete backend, database, web, test, and catalog checklist.
