# Orbital Kitchen Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nutriplan’s conventional navigation shell with an accessible, mobile-first Orbital Kitchen interface while preserving all existing product behavior.

**Architecture:** Add a reusable `OrbitalNav` module at the app-navigation seam. Keep the existing feature views and data source/cache interfaces intact; `App` owns the active destination and passes it to the orbital navigation. CSS positions the orbit with transforms and responsive rules, while semantic buttons, keyboard controls, and reduced-motion styles provide non-gesture alternatives.

**Tech Stack:** React, TypeScript, Vite, CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-28-orbital-kitchen-design.md`

## Global Constraints

- Use the existing React + TypeScript + Vite stack.
- Preserve recipes, pantry, meal planner, shopping list, recipe import/parsing, local-first cache, offline fallback, theme, and currency settings.
- Keep ratings, admin approval, bookmarklets, and multi-device sync deferred.
- Keep the orbit usable at 390px wide with no horizontal overflow.
- Support tap/click, keyboard arrows, and explicit previous/next controls.
- Respect reduced-motion preferences.
- Do not add a large icon dependency; use existing icon support or accessible inline SVG.
- Run `npm test`, `npm run typecheck`, and `npm run build` before handoff.

## Review Focus

- Selecting every destination must render the correct existing feature view — test in `src/app/App.test.tsx`.
- Arrow-key and previous/next navigation must wrap predictably without changing the data source — test in `src/app/navigation/OrbitalNav.test.tsx`.
- Orbit layout must not overflow a 390px viewport — test through responsive class assertions and verify with the browser at mobile width.
- Reduced-motion users must not receive continuous orbit animation — test the `motion-safe`/`motion-reduce` class contract in `OrbitalNav.test.tsx`.
- Import must remain reachable as a first-class destination and preserve the current import preview/save flow — test in `src/features/recipes/RecipeImportPanel.test.tsx` or the existing app test seam.

---

### Task 1: Create the Orbital Navigation Module

**Files:**
- Create: `src/app/navigation/OrbitalNav.tsx`
- Create: `src/app/navigation/OrbitalNav.test.tsx`
- Modify: `src/app/navigation/MobileNav.tsx` only if needed to preserve a compatibility export during migration

**Interfaces:**
- Consumes: `AppSection` from `src/app/navigation/MobileNav.tsx`; `activeSection: AppSection`; `onChange: (section: AppSection) => void`.
- Produces: `OrbitalNavProps = { activeSection: OrbitalSection; onChange: (section: OrbitalSection) => void }`, where `OrbitalSection = 'recipes' | 'pantry' | 'planner' | 'shopping' | 'import'`.

- [ ] **Step 1: Write failing tests** for rendering all five labeled destinations, marking the selected node, invoking `onChange` from a node click, exposing previous/next controls, and exposing an accessible label for the orbit.
- [ ] **Step 2: Run `npm test -- src/app/navigation/OrbitalNav.test.tsx`** and confirm the new tests fail because the module does not exist.
- [ ] **Step 3: Implement `OrbitalNav`** with a fixed hub, ordered destination metadata, semantic buttons, explicit previous/next controls, and deterministic active-node positioning classes. Keep the interface independent of feature data.
- [ ] **Step 4: Add keyboard behavior**: ArrowRight advances to the next destination, ArrowLeft moves to the previous destination, and the destination order wraps.
- [ ] **Step 5: Add reduced-motion behavior** through class names and CSS hooks rather than continuous JavaScript animation.
- [ ] **Step 6: Run the focused test and confirm it passes.**

### Task 2: Integrate the Orbital Shell Without Changing Feature Behavior

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/navigation/MobileNav.tsx` if compatibility cleanup is required
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `OrbitalNav` from Task 1; existing `RecipesView`, `PantryView`, `MealPlannerView`, `ShoppingListView`, and `RecipeImportPanel` seams.
- Produces: `App` routes `recipes`, `pantry`, `planner`, `shopping`, and `import` selections while retaining existing data-source, cache, and settings behavior.

- [ ] **Step 1: Extend app tests** to assert that selecting Recipes, Pantry, Plan, Shopping, and Import updates the selected destination and shows the matching view.
- [ ] **Step 2: Run the focused app tests** and confirm the new integration assertions fail.
- [ ] **Step 3: Replace the current primary navigation render** with `OrbitalNav`; retain `AppSection` state and add the `import` destination without changing repository or cache calls.
- [ ] **Step 4: Route Import** to the existing recipe import panel and preserve editable preview and save behavior.
- [ ] **Step 5: Run `npm test -- src/app/App.test.tsx`** and confirm all app tests pass.

### Task 3: Implement the Orbital Visual System and Responsive Layout

**Files:**
- Modify: `src/styles/index.css`
- Modify: `src/app/App.tsx` only for approved semantic wrappers or state labels
- Modify: `src/features/recipes/RecipeImportPanel.tsx` only if needed to expose the existing import flow as a standalone destination

**Interfaces:**
- Consumes: Task 1’s stable class hooks and Task 2’s selected destination state.
- Produces: visual tokens and responsive styles for the Orbital Kitchen shell and existing feature views.

- [ ] **Step 1: Add visual regression-oriented DOM assertions** for the orbital shell, selected state, connection status, and no-horizontal-overflow class contract.
- [ ] **Step 2: Implement design tokens** for graphite surfaces, lime active state, cyan/violet secondary accents, readable text, touch-target sizing, safe-area padding, and focus rings.
- [ ] **Step 3: Implement the orbit layout** with CSS transforms/positioning, central hub styling, active-node emphasis, explicit controls, and responsive mobile/desktop arrangements.
- [ ] **Step 4: Style the selected content workspace** so existing recipes, pantry, planner, shopping, and import screens visually belong to the Orbital shell without rewriting their domain logic.
- [ ] **Step 5: Add `prefers-reduced-motion` rules** that remove continuous orbit motion and keep only an immediate or short state transition.
- [ ] **Step 6: Run focused tests and inspect the app at 390px and desktop widths.**

### Task 4: Verify Behavior and Production Output

**Files:**
- Modify: `docs/REACT-MIGRATION-PLAN.md` only if the completed slice needs status notes
- No production code changes unless verification finds a defect

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: verified test/build results and a clean implementation handoff.

- [ ] **Step 1: Run `npm test`** and confirm all existing and new tests pass.
- [ ] **Step 2: Run `npm run typecheck`** and confirm no TypeScript errors.
- [ ] **Step 3: Run `npm run build`** and confirm Vite produces a production bundle.
- [ ] **Step 4: Use the browser at a mobile viewport** to verify no horizontal overflow, orbit selection, import access, and one existing feature flow.
- [ ] **Step 5: Review the diff/status** and ensure no temporary screenshots, generated QA artifacts, or unrelated changes were added.
- [ ] **Step 6: Report the files changed, verification results, and any remaining limitations.

