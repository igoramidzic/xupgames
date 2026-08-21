# Official games

Official games are maintained with the platform and may use tables in the main
schema, but their operational state must remain game-specific and linked back to
the shared room by `roomId`.

- Put lifecycle helpers in `officialGames/<gameType>/` and register them once in
  `../../gameRouter.ts`.
- Keep public Convex endpoints thin: authorize through `roomAccess.ts`, confirm
  the room's `gameType`, then call game-specific helpers.
- Never add game-specific fields to `rooms`, `roomMembers`, presence, or voting.
- Use an indexed `roomId` lookup for singleton state and bounded reads for
  per-player/per-round records.
- Match the lifecycle contract: initialize, prepare/reset, active membership
  sync if needed, completion detection, and optional playtest hooks.
