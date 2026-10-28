# Orbital Kitchen Frontend Design

## Intent

Give Nutriplan a distinctive futuristic mobile-first interface centered on a rotating feature menu. The experience should feel like a personal nutrition command center while remaining quick, readable, and practical for one person using it every day.

## Goals

- Replace the current conventional navigation presentation with a central Nutriplan hub and orbiting feature nodes.
- Make Recipes, Pantry, Plan, Shopping, and Import discoverable as direct orbit destinations.
- Expand the selected destination into the primary workspace below the orbit.
- Preserve all existing functionality: recipe CRUD, favorites, pantry CRUD and notes, meal planning, shopping derivation, URL recipe import/parsing, local-first caching, offline fallback, theme, and currency settings.
- Keep the interaction usable on small touch screens and desktop widths.
- Provide keyboard and screen-reader alternatives to the rotating interaction.

## Non-goals

- Do not add ratings, admin approval workflows, bookmarklets, or multi-device sync.
- Do not replace the existing data source, cache, recipe parser, or domain models.
- Do not make the orbit the only way to navigate.
- Do not add decorative animation that delays or obscures primary actions.

## Anti-goals

- No generic bottom-tab-only dashboard.
- No dense dashboard full of unrelated metrics.
- No excessive neon, glassmorphism, or motion that reduces readability.
- No gesture-only controls or inaccessible rotating controls.

## Approved direction

The approved visual direction is Orbital Kitchen:

- Deep graphite background with electric-lime selected states.
- Cyan, violet, and amber secondary accents for distinct destinations.
- A fixed central hub with a subtle nutrition/leaf mark.
- Five orbit nodes: Recipes, Pantry, Plan, Shopping, and Import.
- The active node is larger/brighter and is clearly connected to the content workspace.
- The selected feature expands into a readable panel or view below the orbit.
- The primary mobile action remains a large touch target, such as Add meal or Import recipe.

## Interaction model

The orbit is a navigation module with a small interface: the active destination, an ordered list of destinations, and a selection callback. Users can select a node by tapping/clicking, use left/right controls to rotate, or use keyboard arrow keys. The content view remains directly addressable through semantic buttons and labels. Reduced-motion preferences disable continuous animation and use a short state transition.

On mobile, the orbit occupies the upper portion of the screen and the selected content begins immediately below it. On wider screens, the orbit and content may sit in a two-column layout while keeping the hub-to-content relationship intact.

## Implementation calls

- Use the existing React + TypeScript + Vite stack.
- Create a reusable `OrbitalNav` module rather than embedding navigation logic in each feature view.
- Keep feature views as the existing deep seams: Recipes, Pantry, Meal Planner, Shopping List, and Recipe Import.
- Keep persistence and remote/local adapters unchanged except where the new Import destination needs to open the existing import flow.
- Use CSS transforms and stateful positioning for the orbit; avoid a canvas dependency.
- Use existing icon support or inline accessible SVG rather than adding a large icon dependency.
- Add component and interaction tests for selection, keyboard navigation, reduced motion, and preservation of route/view content.

## Acceptance criteria

- All five destinations are visible and understandable without interacting first.
- Selecting each destination updates the selected state and renders the matching existing feature view.
- Tap/click, keyboard, and explicit previous/next controls all work.
- The orbit remains usable at 390px wide with no horizontal overflow.
- The interface has visible focus states and meaningful accessible labels.
- `npm test`, `npm run typecheck`, and `npm run build` pass.
- Existing recipe import, offline cache, pantry, meal planning, and shopping behavior still pass their tests.
