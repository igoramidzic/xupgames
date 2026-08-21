# Community game template

This template is intentionally not mounted or compiled. To create a game:

1. Copy this directory to `../<gameType>/` (lower camel case).
2. Rename each `*.example` file by removing `.example`.
3. Replace `communityGameTemplate` with the stable game type and replace the
   sample state/actions with a typed game model.
4. Import the component config in `../../convex.config.ts` and mount it with
   `app.use(component, { name: '<gameType>' })`.
5. Run `pnpm exec convex dev --once` (or normal `pnpm dev:convex`) to generate
   the component's `_generated/` directory.
6. Add the game type, validator literal, author/description/source manifest, and
   central lifecycle adapter as described in `../../AGENTS.md`.
7. Add parent-app wrapper functions outside this component directory. Those
   wrappers authorize through `roomAccess.requireRoomMember`, then call
   `components.<gameType>.game.<function>` with only safe string IDs/data.
8. Add tests for both the component API and parent authorization boundary.

Do not keep the template's generic `ready` model as a real game. Its purpose is
to demonstrate component syntax and the isolation boundary only.
