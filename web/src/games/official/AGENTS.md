# Official web games

Official games are maintained as part of Xup Games.

- Keep every game's room, preview, tests, hooks, and any game-only CSS in one `official/<game-slug>/` directory.
- Register the game once in `../../registry.tsx` and route it once in `../../GameRoom.tsx`.
- Use shared room, voting, results, presence, and UI primitives instead of copying them into a game.
- Preserve the Xup visual language in `web/AGENTS.md`; a distinct play surface is welcome, but platform chrome must remain recognizable.
- Consume name, description, author, source, enabled state, and ordering from the Convex catalog. Do not hardcode those fields in the game UI.
