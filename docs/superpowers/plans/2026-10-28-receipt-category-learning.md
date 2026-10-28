# Receipt Category Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user categorize receipt items during review and remember those choices for future receipt imports.

**Architecture:** Add a small pure classifier module for built-in and learned rules, extend receipt draft items with a category, and persist learned rules inside the existing local snapshot/cache. The receipt review remains the single correction point; saving a receipt records the selected category and updates the local rule store.

**Tech Stack:** React, TypeScript, Vitest, existing local snapshot/cache and Supabase-backed data source.

**Spec:** `docs/superpowers/specs/2026-10-28-receipt-category-learning-design.md`

## Global Constraints

- Local device persistence is the source of truth for learned rules; multi-device synchronization remains deferred.
- Default category is `Uncategorized` when no rule matches.
- Category options are exactly: `Uncategorized`, `Produce`, `Meat`, `Poultry`, `Seafood`, `Dairy`, `Grains`, `Pantry`, `Beverages`, `Snacks`, and `Household`.
- Learned matching is an exact normalized full-name match and beats built-in token matches; learned phrases are unique keys.
- Manual user choices override automatic suggestions.
- Existing pantry categories must remain unchanged.

## Review Focus

- OCR names with punctuation, asterisks, or inconsistent spacing must match the same learned rule after normalization — classifier tests cover this.
- An unknown item must remain visibly `Uncategorized`, not silently receive a random category — classifier and review tests cover this.
- A learned specific rule must beat a broader built-in rule — precedence tests cover this.
- Reloading the app must retain learned rules — persistence tests cover this.
- Editing a category during review must pass the edited category to save — receipt review tests cover this.

---

### Task 1: Canonical category vocabulary and classifier

**Files:**
- Modify: `src/types/domain.ts`
- Create: `src/features/categories/categoryClassifier.ts`
- Test: `src/features/categories/categoryClassifier.test.ts`

**Interfaces:**
- `type PantryCategory` and `PANTRY_CATEGORIES` are canonical exports from `src/types/domain.ts`; the existing `PantryItem.category: string` remains string-compatible for legacy values.
- `interface CategoryRule { phrase: string; category: PantryCategory; updatedAt: number }`
- `normalizeCategoryText(value: string): string`
- `suggestCategory(itemName: string, rules: CategoryRule[]): PantryCategory`
- `isPantryCategory(value: string): value is PantryCategory`

- [ ] **Step 1: Verify the existing model** and record that no pantry category union/list exists; the existing `PantryItem.category: string` remains unchanged.
- [ ] **Step 2: Write failing tests** for built-in suggestions (`ONION` → `Produce`, `CHKN` → `Poultry`), unknown names → `Uncategorized`, punctuation/spacing normalization, whole-token matching (`HAM` must not classify `SHAMPOO`), and a saved exact learned rule overriding a built-in rule.
- [ ] **Step 3: Run the focused test and verify it fails** because the classifier module does not exist.
- [ ] **Step 4: Add the canonical type/list to `src/types/domain.ts` and implement the classifier** with a transparent built-in keyword table; normalize case, punctuation, repeated whitespace, and receipt prefixes such as `*`; compare keyword tokens against whitespace-split item-name tokens.
- [ ] **Step 5: Run the focused test and verify it passes.**
- [ ] **Step 6: Commit** `feat: add receipt category classifier`.

### Task 2: Persist learned category rules

**Files:**
- Modify: `src/app/dataSource.ts`
- Modify: `src/lib/storage/cache.ts` and its snapshot types, following the existing cache pattern
- Modify: `src/app/App.tsx`
- Test: `src/app/dataSource.test.ts` or the existing storage test location

**Interfaces:**
- `loadCategoryRules(): Promise<CategoryRule[]>`
- `saveCategoryRule(rule: CategoryRule): Promise<void>`
- Both local and Supabase-backed data sources read/write the same device-local cache snapshot. No Supabase table or network call is needed for rules.

- [ ] **Step 1: Write failing persistence tests** that save a rule, create a fresh local data-source instance, reload the snapshot, and retrieve the same rule; add a Supabase-backed data-source test with the network client mocked proving its rule methods still use the local cache.
- [ ] **Step 2: Run the focused tests and verify they fail** because the snapshot does not contain category rules and the data-source methods do not exist.
- [ ] **Step 3: Extend `CacheSnapshot` with `categoryRules`** and add `loadCategoryRules`/`saveCategoryRule` to both data sources. The Supabase-backed source must use the injected/default `AppCache` for these methods, not the network. Upsert by normalized `phrase`, update `updatedAt`, and ignore any rule whose category is `Uncategorized`.
- [ ] **Step 4: Run focused persistence tests and verify they pass.**
- [ ] **Step 5: Run existing storage/data-source tests and verify no regressions.**
- [ ] **Step 6: Commit** `feat: persist personal category rules locally`.

### Task 3: Apply category suggestions to receipt drafts

**Files:**
- Create: `src/features/categories/applyCategories.ts`
- Modify: `src/features/receipt/ImportHub.tsx`
- Modify: `src/features/receipt/ReceiptScanner.tsx`
- Test: `src/features/categories/applyCategories.test.ts`

**Interfaces:**
- `ReceiptDraftItem.category: PantryCategory`
- `applyCategories(draft: ReceiptDraft, rules: CategoryRule[]): ReceiptDraft`
- `ReceiptScanner` receives `categoryRules` and applies enrichment after OCR parsing; the OCR parser itself remains category-independent.

- [ ] **Step 1: Write failing tests** proving `applyCategories` adds built-in, learned, and `Uncategorized` categories without changing OCR quantities, unit prices, totals, or raw rows.
- [ ] **Step 2: Run the focused test and verify it fails** because the category field and enrichment function do not exist.
- [ ] **Step 3: Add `category` to receipt draft items and implement `applyCategories`** as a separate enrichment step after `parseReceiptRows`; pass rules from `App` through `ImportHub` to `ReceiptScanner`.
- [ ] **Step 4: Run focused category-enrichment tests and existing receipt parser tests and verify they pass.**
- [ ] **Step 5: Commit** `feat: classify receipt draft items`.

### Task 4: Category selector and learning on receipt save

**Files:**
- Modify: `src/features/receipt/ReceiptScanner.tsx`
- Modify: `src/features/receipt/ImportHub.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/index.css`
- Test: `src/features/receipt/ReceiptScanner.test.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Receipt review renders one category `<select>` per item with `aria-label="Category N"`.
- `onSave(draft)` receives the edited category values.
- Saving an item creates the pantry record with `category: item.category` and saves a normalized rule for the item name.

- [ ] **Step 1: Write failing UI tests** that render a receipt with an unknown item, assert `Uncategorized`, change the selector to `Produce`, and assert the save callback receives `Produce`.
- [ ] **Step 2: Run the UI tests and verify they fail** because the category control and draft field do not exist.
- [ ] **Step 3: Add the category column/select** to the review table, keep it readable on mobile, and show `Needs category` styling only for `Uncategorized` items.
- [ ] **Step 4: Wire review parsing to current rules** loaded by `App`/`ImportHub`, then save the user-selected category to pantry and update the local rule store only when the category is not `Uncategorized`.
- [ ] **Step 5: Run UI and app tests and verify they pass.**
- [ ] **Step 6: Commit** `feat: learn receipt item categories from review`.

### Task 5: End-to-end verification

**Files:**
- Modify: relevant tests only if a discovered regression requires coverage
- Modify: `docs/superpowers/specs/2026-10-28-receipt-category-learning-design.md` only if behavior needs clarification

- [ ] **Step 1: Run the full test suite** with `npm test` and confirm all tests pass.
- [ ] **Step 2: Run `npm run typecheck`** and confirm no TypeScript errors.
- [ ] **Step 3: Run `npm run build`** and confirm the production build succeeds.
- [ ] **Step 4: Manually verify**: import a receipt, change one unknown item to `Produce`, save it, import the same item again, and confirm the suggestion is `Produce`.
- [ ] **Step 5: Commit** `test: verify receipt category learning`.
