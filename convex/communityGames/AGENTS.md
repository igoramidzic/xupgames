# Community games

Every community game is a local Convex Component. Start from `template/README.md`
and keep all game-specific schema/functions inside the component directory.

- Do not import the parent app's `_generated/server`, schema, data model, or
  tables. Use the component's own generated files.
- Component-facing `roomId` and `memberId` values are strings. The app wrapper
  validates the real IDs and authorization before calling the component.
- Never accept guest session tokens, room passwords, or parent-app function
  handles in a component.
- Declare argument and return validators for every component function.
- Use typed state tables and indexes; no `v.any()`, unbounded arrays, filters, or
  unbounded collects.
- Keep browser-facing queries and mutations outside the component. They must use
  `requireRoomMember`, verify the expected `gameType`, and expose only safe
  views/actions.
- Mount the component in the root `convex.config.ts`, add its catalog manifest,
  and register its narrow bridge in `gameRouter.ts`.
- Add component tests and app-wrapper authorization/routing tests.
