# Community game backend isolation

Community games use one local Convex Component per game. A component is the
closest Convex equivalent to a small app inside this deployment: it has its own
schema, tables, generated API, functions, scheduler, and execution environment.
It cannot read or mutate the parent app's tables unless the parent explicitly
passes data or a function handle across the boundary.

That is a better boundary than a second Convex deployment for this project.
Rooms and membership updates can remain in the same ACID transaction as a call
into a component, while a separate deployment would require duplicated identity,
cross-deployment networking, reconciliation, and eventual-consistency handling.

Components do not replace authorization or source review. Browser calls must go
through a parent-app wrapper that calls `requireRoomMember`; never expose room
credentials or broad parent function handles to component code.

See `template/README.md` for the copy-and-register workflow.
