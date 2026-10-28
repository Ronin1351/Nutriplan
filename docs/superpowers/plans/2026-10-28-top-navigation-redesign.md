# Top Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable orbital menu with a static, responsive top button navigation.

**Architecture:** Keep `OrbitalSection` and the existing `OrbitalNav` component contract so `App` needs no routing changes. Replace the component markup with a semantic navigation row and replace orbital CSS with static responsive styles.

**Tech Stack:** React, TypeScript, Vite, existing CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-28-top-navigation-redesign-design.md`

## Global Constraints

- Keep the existing five destinations and their current routing behavior.
- Remove 3D transforms, orbital positioning, swipe handling, and continuous motion from primary navigation.
- Add no dependencies and change no feature functionality outside navigation.
- Use horizontal overflow on narrow screens instead of wrapping or shrinking labels until they become unusable.

## Review Focus

- Clicking each destination changes the active section; cover with the existing navigation interaction test.
- The active destination is announced with `aria-current="page"`; add an assertion to the navigation test.
- Arrow keys remain usable; preserve or test native focus/keyboard behavior without pointer gesture code.
- Narrow layouts do not create a second fixed/floating layer that blocks content; verify with the browser at a narrow viewport.
- No orbital animation or transform attributes remain; assert the static navigation contract in the component test.

---

### Task 1: Convert the navigation component to a static top button row

**Files:**
- Modify: `src/app/navigation/OrbitalNav.tsx`
- Test: `src/app/navigation/OrbitalNav.test.tsx`

**Interfaces:**
- Consumes: existing `activeSection: OrbitalSection` and `onChange(section: OrbitalSection)` props.
- Produces: a `nav` labeled `Primary navigation` containing one native button per destination, with `aria-current="page"` only on the active button.

- [ ] **Step 1: Update the component test** to expect `Primary navigation`, five labeled buttons, active-page semantics, and no `data-orbiting`/`data-orbit-motion` attributes.
- [ ] **Step 2: Run the focused test** with `npm test -- --run src/app/navigation/OrbitalNav.test.tsx` and confirm the new assertions fail against the orbital markup.
- [ ] **Step 3: Replace the orbital markup and pointer gesture handlers** with a static heading plus button row. Keep the destination list and `OrbitalSection` type; remove `useRef`, pointer handlers, angle/depth styles, orbit controls, and 3D elements.
- [ ] **Step 4: Run the focused test** and confirm all navigation assertions pass.

### Task 2: Replace orbital styles with responsive top-navigation styles

**Files:**
- Modify: `src/styles/index.css`

**Interfaces:**
- Consumes: the static classes emitted by `OrbitalNav`.
- Produces: readable desktop navigation and a horizontally scrollable narrow-screen navigation row with no movement or overlay behavior.

- [ ] **Step 1: Remove orbital stage, node, orbit, control, transform, and keyframe rules** that only support the old menu.
- [ ] **Step 2: Add static styles** for the navigation heading, row, buttons, symbol, hover, focus-visible, and active states using existing design tokens.
- [ ] **Step 3: Add the narrow-screen rule** with horizontal scrolling, preserved button minimum sizes, and hidden scrollbar treatment only if it does not reduce usability.
- [ ] **Step 4: Run `npm run typecheck` and `npm run build`** and confirm both pass.

### Task 3: Verify the real browser interaction

**Files:**
- No source changes expected.

- [ ] **Step 1: Open `http://127.0.0.1:5173/` in the in-app browser** and verify the static top row is visible without orbital motion.
- [ ] **Step 2: Click Recipes, Plan, Import, Shopping, and Pantry** and confirm each workspace changes without remount flicker or blocked clicks.
- [ ] **Step 3: Check a narrow viewport** and confirm the navigation remains clickable and does not cover the bottom workspace.
- [ ] **Step 4: Run `npm test -- --run`** and confirm the complete suite passes.
