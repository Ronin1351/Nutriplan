# Top Navigation Redesign

## Intent

Replace the unstable orbital navigation with normal, dependable top buttons so the personal kitchen app is easy to understand and click on desktop and mobile.

## Goals

- Keep the existing five destinations and their current routing behavior.
- Remove 3D transforms, orbital positioning, swipe handling, and continuous motion from primary navigation.
- Provide an obvious active state and keyboard-accessible buttons.
- Preserve the existing dark/futuristic visual language through restrained borders, accent color, and readable labels.
- Make the navigation fit narrow screens without overlapping or blocking content.

## Non-goals

- No new navigation destinations.
- No new dependency or routing system.
- No changes to recipe, pantry, planner, shopping, or OCR functionality.
- No floating or animated navigation.

## Approach

The selected approach is a simple top tab bar: the brand remains in the header, and a horizontal navigation row sits below it. Each destination is a normal button with a symbol and label; the active destination receives the accent treatment. On narrow screens the row scrolls horizontally rather than shrinking labels or wrapping into an unreliable layout.

The existing `OrbitalSection` type and `onChange` contract remain in place so `App` behavior and tests stay stable. `OrbitalNav` becomes a compatibility-named, static top navigation component; its public component name can remain unchanged for now to avoid an unnecessary cross-file rename.

## Acceptance criteria

- Navigation renders as a normal top button row with no orbit stage or animation attributes.
- Clicking each button changes the active workspace.
- Arrow-key navigation remains available through roving focus or native button focus.
- The active button is announced with `aria-current="page"`.
- Desktop and narrow viewport layouts remain readable and clickable.
- Existing tests, typecheck, and production build pass.
