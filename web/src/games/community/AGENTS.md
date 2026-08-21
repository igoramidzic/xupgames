# Community web games

Keep each contribution inside `community/<game-slug>/` except for its two narrow registrations in `../registry.tsx` and `../GameRoom.tsx`.

- Colocate the room component, picker preview, tests, hooks, and game-only CSS.
- Do not import another game's module or change shared room behavior to satisfy one game. Propose a game-neutral contract when shared infrastructure truly needs a capability.
- Match the Xup visual language and accessibility rules in `web/AGENTS.md`. A community game may have its own accent and character without replacing platform navigation, member controls, dialogs, voting, results, or badges.
- The catalog manifest must use `source: 'community'` and include the contributor's author name plus an optional public URL. UI reads those fields from Convex.
- Add a room-routing test, picker/source-badge test, interaction tests, and a 320px responsive check before enabling the game.
