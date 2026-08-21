# Web frontend organization

These instructions apply to everything under `web/` and supplement the repository-level `AGENTS.md`.

## Styling ownership

- Use Tailwind CSS utility classes directly on JSX elements for component-scoped styling. This includes typography, layout, spacing, sizing, colors, borders, responsive behavior, and interaction states.
- Keep `src/index.css` limited to application-wide concerns: framework imports, font-face declarations, shared theme tokens, resets/base styles, and truly global behavior. Do not add page-specific or component-specific selectors there.
- Treat existing component selectors in `src/index.css` as legacy. When changing a component, migrate the styles you touch to Tailwind instead of adding more component rules to the global file.
- If a design cannot reasonably be expressed with Tailwind—for example, complex keyframes, pseudo-elements, advanced rendering behavior, or third-party internals—create a CSS file beside the owning component, import it from that component, and scope every selector under that component's root class. A component CSS file must not style another component.
- Use inline `style` props only for values that are genuinely calculated at runtime and cannot be represented by static Tailwind classes.
- Use the existing `cn`/class-variant tooling for conditional or variant-heavy class lists instead of building class strings ad hoc.

## Typography

- Apply font family, size, weight, line height, and letter spacing with Tailwind classes on the element that owns the text.
- Define shared font families and design tokens once through the Tailwind theme/global token layer; do not recreate font declarations in individual component CSS files.
- When the same semantic typography treatment is reused across components, extract a small typed React component or class-variant rather than introducing a global CSS selector.
- Preserve a deliberate hierarchy: primary content should be clearly larger than supporting labels and metadata, and important scores or game state should remain easy to scan.

## Component structure

- Pages should coordinate routing, data loading, and page-level state. Extract substantial visual sections and interaction flows into focused components.
- Give each extracted component one clear responsibility and keep its state, tests, and any unavoidable CSS colocated with it.
- Split a component when a section has its own behavior, can be named as a distinct UI concept, is reused, or makes the parent difficult to scan. Do not split markup into components that have no meaningful responsibility of their own.
- Keep shared room chrome and multiplayer UI game-neutral. Put game-specific components in their respective game areas, with `gameType` remaining the boundary between shared room infrastructure and game implementations.
- Put reusable low-level primitives in `src/components/ui/`. Do not place page-specific or game-specific behavior in that directory.
- Prefer one primary exported component per file. Small private helpers may stay with their owner when extracting them would make navigation harder.

## Game organization

- `src/games/GameRoom.tsx` is the only route from shared room infrastructure into a game room. Add a game there instead of adding `gameType` switches to pages or shared room components.
- `src/games/registry.tsx` owns code-side presentation: icon, accent/tint, preview, and the supported web `gameType` union. Human-facing name, description, author, source, enabled state, and ordering come from `api.games.listAvailable`; do not duplicate them in UI constants.
- Official game UI belongs in `src/games/official/<game-slug>/`. Community game UI belongs in `src/games/community/<game-slug>/`. Keep the room, preview, tests, and unavoidable component CSS together.
- Keep `src/components/` for game-neutral multiplayer surfaces such as voting and post-game flow. A shared component may consume catalog metadata but must not import game-specific state or behavior.
- Game picker and next-game choices show no source or author metadata for official entries. Community entries show `Community game` and the catalog author; do not attribute official games in these surfaces.
- Let game descriptions wrap in full in the game picker. Keep voting options compact by omitting descriptions and showing only the action name, allowed community metadata, and vote count.
- Never render a catalog entry that has no registered web presentation and room route. A game remains disabled until the complete vertical slice exists.

## Xup visual language

- Community games should feel authored, but they still belong inside Xup Games. Preserve the existing brand shell: warm off-white/cool paper surfaces, deep navy text and outlines, confident display typography, compact metadata, irregular rounded geometry, and restrained hard-shadow accents.
- A game may introduce a focused accent palette and game-appropriate typography for its play surface. Keep global navigation, room identity, member controls, dialogs, voting, result surfaces, focus states, and source badges visually consistent with official games.
- Match the density and craft of Trivia and Type Racer. Avoid generic dashboard cards, default browser controls, unexplained gradients, or a disconnected visual system.
- Treat responsive behavior as part of the theme. Game controls must remain usable at 320px, important state must stay visible without horizontal scrolling, and motion must respect reduced-motion preferences.
- Reuse the shared button/dialog/alert primitives and semantic tokens before inventing new chrome. Keep text contrast, keyboard focus, labels, and target sizes at WCAG 2.1 AA quality.

## Change discipline

- New components must follow these rules immediately.
- Refactors should be incremental: migrate the component being changed and avoid unrelated repository-wide rewrites unless the task explicitly calls for one.
- Before finishing a styling change, verify the relevant responsive states and run the focused tests, formatting/lint checks, and build appropriate to the change.
