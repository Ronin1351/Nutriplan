# Information Architecture Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Nutriplan into five tabs (Plan · Shopping · Pantry · Recipes · Receipts) where every action lives with its object, add sortable stock, purchase-line history, edit-merge confirmation, year-grouped receipts, and recipe-from-photo import.

**Architecture:** Pure data helpers (sorting, grouping, text parsing) live in `src/lib/` and are unit-tested in isolation. Store/service changes land first so views build on tested interfaces. Views are rewritten per feature folder; `App.tsx` and navigation are rewired last so the app compiles at every commit. No router: tab is `App` state, sub-state is view-local.

**Tech Stack:** React 18, TypeScript, Vite, vitest + @testing-library/react + user-event, IndexedDB price store, PaddleOCR worker (existing).

**Spec:** `docs/superpowers/specs/2026-10-29-information-architecture-revamp-design.md`

## Global Constraints

- Keep the current dark/green theme and existing CSS class vocabulary in `src/styles/index.css`; add classes, do not restyle existing ones.
- Tab ids and labels exactly: `plan` "Plan", `shopping` "Shopping", `pantry` "Pantry", `recipes` "Recipes", `receipts` "Receipts". Default tab on launch: `plan`.
- Pantry segments labelled "Stock" and "Purchases". Receipts header dropdown labelled "Add receipt" with items "Take photo" and "Upload photo".
- Sort persistence key: `nutriplan.pantry.sort`.
- OCR output is never saved without passing through `RecipeEditor` / `ReceiptScanner` review.
- Every commit leaves `npx tsc --noEmit -p tsconfig.json` clean and `npx vitest run` green.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_013NVpkuYRn1oDaEi52RWSvB
  ```

## Review Focus

1. Edit that changes only the unit (e.g. `units`→`kg`) on a row with consumed contributions: collision dialog must still fire when a match exists, and "Keep separate" must not corrupt contribution units. → Task 1 test `mergeStockInto converts contributions`.
2. Purchase line whose catalog item was deleted (`price_items` missing): `listPurchaseLines` must show "Unknown item", not throw. → Task 2 test.
3. Receipt with `occurredOn` in a different year from `capturedAt`: grouping uses `occurredOn`. → Task 4 test.
4. Recipe photo whose OCR has no quantity-led lines: `parseRecipeText` must still produce a draft (empty ingredients, all lines instructions) rather than throw. → Task 3 test.
5. Quote entry from the Add sheet must not change stock amount. → Task 5 test.

---

### Task 1: Store collision API (replace silent auto-merge)

**Files:**
- Modify: `src/features/prices/types.ts` (PriceStore interface, lines 177–183)
- Modify: `src/features/prices/indexedDbPriceStore.ts` (`updateStock`, lines ~131–150)
- Modify: `src/app/dataSource.ts:30-33,73-76,118-121` (pass-through methods)
- Test: `src/features/prices/indexedDbPriceStore.test.ts` (create; use `fake-indexeddb` — add as devDependency `npm i -D fake-indexeddb`, import `'fake-indexeddb/auto'` at top of test)

**Interfaces:**
- Consumes: `findMergeTarget`, `mergeStockRows`, `toStockUnit` from `pantryInventoryService.ts` (exist).
- Produces, on `PriceStore` and `AppDataSource`:
  - `findStockCollision(item: PantryItem): Promise<PantryItem | null>` — returns the other active row `item` would merge into, or null.
  - `mergeStockInto(sourceId: string, targetId: string): Promise<PantryItem>` — merges source into target via `mergeStockRows`, re-points source contributions (quantities converted with `toStockUnit`), deletes source, returns merged target.
  - `updateStock(item)` becomes a plain put (no merge).

- [ ] **Step 1: Write failing tests**

```ts
describe('indexedDb price store collisions', () => {
  it('updateStock no longer merges silently', async () => { /* create Eggs units ×2 rows via createStock with different expirationDate, edit second to match first, expect listStock().length === 2 */ });
  it('findStockCollision returns the matching row', async () => { /* expect id of first row */ });
  it('findStockCollision returns null when nothing matches', async () => {});
  it('mergeStockInto sums amounts, deletes source, re-points contributions', async () => { /* after merge: listStock().length===1, amount sum; inventory.listReceipts lineCount unchanged */ });
  it('mergeStockInto converts contributions into target unit', async () => { /* source 1 kg Flour, target 500 g Flour → target amount '1500', consume 1500 g via inventory.consumeIngredients succeeds with missing 0 */ });
});
```

- [ ] **Step 2: Run** `npx vitest run src/features/prices/indexedDbPriceStore.test.ts` — expect FAIL (methods undefined).
- [ ] **Step 3: Implement** the two methods in `indexedDbPriceStore.ts`; revert `updateStock` to `const stock = pantryToStock(item, String(item.id)); await put('price_stock', stock, stock.id); return stockToPantry(stock);`. Add both methods to `PriceStore` and to `AppDataSource` (`findStockCollision`, `mergeStockInto`, optional like `prices`, forwarding to `priceStore` when present, else `null` / throw `new Error('Merging requires local inventory storage.')`).
- [ ] **Step 4: Run** full `npx vitest run` and `npx tsc --noEmit -p tsconfig.json` — PASS.
- [ ] **Step 5: Commit** `feat(pantry): expose stock collision + merge API, drop silent merge on edit`

### Task 2: Inventory service — purchase lines and receipt totals

**Files:**
- Modify: `src/features/pantry/pantryInventoryService.ts` (`ReceiptSummary`, `InventoryService`, `listReceipts`)
- Test: `src/features/pantry/pantryInventoryService.test.ts` (extend; needs `fake-indexeddb/auto`)

**Interfaces:**
- Produces:
  ```ts
  export interface PurchaseLine { observationId: string; eventId: string; itemName: string; quantity: string; unit: string; paidMinor: number; currency: string; occurredOn: string; merchantName: string | null; }
  listPurchaseLines(): Promise<PurchaseLine[]>   // newest occurredOn first, kind==='purchase' events only
  ```
  `ReceiptSummary` gains `totalMinor: number` (sum of `paidMinor` over its observations).

- [ ] **Step 1: Write failing tests** — `listPurchaseLines joins item and merchant names`, `listPurchaseLines labels a missing catalog item "Unknown item"`, `listPurchaseLines excludes quote events`, `listReceipts totalMinor sums line paidMinor`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** in `createIndexedDbInventoryService` reading `price_events`, `price_observations`, `price_items`, `price_merchants` in one readonly transaction.
- [ ] **Step 4: Run** tests + tsc — PASS.
- [ ] **Step 5: Commit** `feat(inventory): purchase line listing and receipt totals`

### Task 3: `parseRecipeText` for OCR output

**Files:**
- Modify: `src/lib/recipe-import.ts`
- Test: `src/lib/recipe-import.test.ts` (create or extend if exists)

**Interfaces:**
- Consumes: `parseIngredientLine` from `src/lib/ingredients.ts`, `classifyCategoryFromName` from `src/lib/recipes.ts`.
- Produces: `export function parseRecipeText(text: string): RecipeImportDraft` — first non-empty line is `name`; a line is an ingredient when `/^\s*(\d+([.,/]\d+)?|½|¼|¾)/` matches; all other lines after the title join with `\n` as `instructions`; `servings: 4`, `prepTime: 30`, `imageUrl: ''`, `submittedBy: 'Personal'`, `approved: false`, `category: classifyCategoryFromName(name)`. Throws `RecipeImportError('missing-recipe', 'No text was found in the photo.')` only when the text is blank.

- [ ] **Step 1: Write failing tests** — title + 3 ingredient lines + 2 instruction lines parse correctly; lines without quantities become instructions with empty `ingredients`; blank text throws `missing-recipe`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(recipes): parse OCR text into a recipe draft`

### Task 4: Pure sort and grouping helpers

**Files:**
- Create: `src/lib/pantrySort.ts`, `src/lib/receiptGroups.ts`
- Test: `src/lib/pantrySort.test.ts`, `src/lib/receiptGroups.test.ts`

**Interfaces:**
- `export type PantrySort = 'category' | 'name' | 'price'`
- `export function sortPantry(items: PantryItem[], sort: PantrySort): PantryItem[]` — `category`: by category A–Z then name A–Z; `name`: name A–Z (localeCompare, case-insensitive); `price`: `price` descending, ties by name.
- `export function groupByCategory(items: PantryItem[]): Array<{ category: string; items: PantryItem[] }>` (input already sorted).
- `export type PurchaseSort = 'date' | 'item' | 'price'`
- `export function sortPurchases(lines: PurchaseLine[], sort: PurchaseSort): PurchaseLine[]` — `date`: `occurredOn` desc; `item`: A–Z; `price`: `paidMinor` desc.
- `export function groupReceiptsByYear(receipts: ReceiptSummary[]): Array<{ year: string; receipts: ReceiptSummary[]; totalMinor: number }>` — year = `occurredOn.slice(0,4)`, groups newest year first, receipts within newest first.

- [ ] **Step 1: Write failing tests** for each comparator and both groupers, including year taken from `occurredOn` not `capturedAt`.
- [ ] **Step 2–4: Run FAIL → implement → run PASS.**
- [ ] **Step 5: Commit** `feat: pantry and receipt sort/group helpers`

### Task 5: Stock segment — list, sort, add/edit sheet, collision dialog

**Files:**
- Create: `src/features/pantry/StockItemSheet.tsx`, `src/features/pantry/PantryStockList.tsx`
- Modify: `src/features/pantry/PantryView.tsx` (rewrite), `src/styles/index.css` (add `.segment-control`, `.sheet`, `.sheet-backdrop`, `.sort-control`, `.category-header`)
- Delete: `src/features/prices/PriceCaptureForm.tsx`
- Test: `src/features/pantry/PantryView.test.tsx` (create)

**Interfaces:**
- `StockItemSheet` props: `{ open: boolean; initial?: PantryItem | null; currency: CurrencyCode; onSubmit: (value: { item: NewPantryItem | PantryItem; entryType: 'purchase' | 'quote' }) => Promise<void>; onClose: () => void }`. Renders `<dialog>`-like panel with role `dialog` and `aria-label` "Add pantry item" / "Edit pantry item"; Entry type `<select aria-label="Entry type">` with options `Purchase (adds stock)` / `Quote (price history only)`; hidden when editing.
- `PantryStockList` props: `{ items: PantryItem[]; sort: PantrySort; currency; onOpen(item); onEdit(item); onNotes(item); onRemove(id) }` — renders category headers when `sort === 'category'`.
- `PantryView` props become: `{ pantry; currency; onCreate; onUpdate; onRemove; onSaveNotes; onQuote: (capture: PriceCapture) => Promise<void>; onFindCollision: (item: PantryItem) => Promise<PantryItem | null>; onMerge: (sourceId, targetId) => Promise<void>; priceStore?; inventory?; initialSegment?: 'stock' | 'purchases' }`. Segment control `role="tablist"` with tabs "Stock" / "Purchases" (Purchases body is a placeholder until Task 6). Sort `<select aria-label="Sort pantry">` with options `Category` / `A–Z` / `Price`, persisted to `localStorage['nutriplan.pantry.sort']`.
- Collision dialog: `window.confirm(\`${name} already exists (${amount} ${unit}). Combine into one entry?\`)` → true: `onUpdate(edited)` then `onMerge(edited.id, target.id)`; false: `onUpdate(edited)` only.
- Item detail: existing `ItemDetailPanel` with the `.upload-placeholder` block removed.

- [ ] **Step 1: Write failing tests** — sort select reorders rows and persists key; Add item opens sheet and Purchase calls `onCreate`; Quote calls `onQuote` with `kind: 'quote'` and not `onCreate`; editing to a colliding name with `confirm` mocked true calls `onMerge(editedId, targetId)`; mocked false does not; category sort renders a heading per category.
- [ ] **Step 2–4: Run FAIL → implement → run PASS** (`App.test.tsx` may need prop updates; keep it green).
- [ ] **Step 5: Commit** `feat(pantry): sortable stock list, single add/edit sheet, merge confirmation`

### Task 6: Purchases segment

**Files:**
- Create: `src/features/pantry/PantryPurchasesList.tsx`
- Modify: `src/features/pantry/PantryView.tsx` (render it under the Purchases tab)
- Test: `src/features/pantry/PantryPurchasesList.test.tsx`

**Interfaces:**
- Props: `{ lines: PurchaseLine[]; currency; onOpenReceipt: (eventId: string) => void }`; sort `<select aria-label="Sort purchases">` options `Date` / `Item A–Z` / `Price`; search `<input aria-label="Search purchases">` matches item or merchant; row button labelled `${itemName}` opens receipt.
- `PantryView` gains `onOpenReceipt: (eventId: string) => void` and loads lines via `inventory.listPurchaseLines()` when the Purchases tab is first shown.

- [ ] **Step 1: Write failing tests** — renders lines with merchant and formatted price; search filters by merchant; clicking a row calls `onOpenReceipt(eventId)`.
- [ ] **Step 2–4: FAIL → implement → PASS.**
- [ ] **Step 5: Commit** `feat(pantry): purchases segment`

### Task 7: Receipts tab

**Files:**
- Create: `src/features/receipts/ReceiptsView.tsx`
- Modify: `src/features/receipt/ReceiptScanner.tsx` (add `mode?: 'camera' | 'upload'` prop; when set, skip the idle chooser and immediately trigger the matching hidden file input via a ref on mount)
- Modify: `src/styles/index.css` (`.year-group`, `.dropdown-menu`)
- Test: `src/features/receipts/ReceiptsView.test.tsx`

**Interfaces:**
- Props: `{ inventory: InventoryService; currency; categoryRules; onSaveReceipt: (draft: ReceiptDraft) => Promise<void>; openEventId?: string | null; onOpened?: () => void }`.
- Header `<button aria-haspopup="menu">Add receipt</button>` → menu items "Take photo", "Upload photo" → renders `ReceiptScanner mode="camera" | "upload"`; on save calls `onSaveReceipt`, refreshes list.
- Year groups from `groupReceiptsByYear`; each `<details>` with `<summary>{year} · {count} receipts · {formatCurrency(total)}</summary>`, `open` only for the newest year.
- Receipt row/detail logic moved verbatim from the old `PantryView` (list, open detail, delete receipt, delete line). When `openEventId` is set, open that receipt's detail and call `onOpened`.

- [ ] **Step 1: Write failing tests** — years rendered newest first with only the first open; "Add receipt" menu shows both options; selecting one mounts the scanner (assert heading "Scan receipt"); `openEventId` opens detail on mount.
- [ ] **Step 2–4: FAIL → implement → PASS.**
- [ ] **Step 5: Commit** `feat(receipts): dedicated tab with add menu and year grouping`

### Task 8: Recipes — Add menu and photo import

**Files:**
- Create: `src/features/recipes/RecipeAddMenu.tsx`, `src/features/recipes/RecipePhotoImport.tsx`
- Modify: `src/features/recipes/RecipesView.tsx`, `src/features/recipes/RecipeImportPanel.tsx` (accept `initialMode?: 'url' | 'paste'`)
- Test: `src/features/recipes/RecipePhotoImport.test.tsx`, extend `src/features/recipes/RecipesView.test.tsx` (create)

**Interfaces:**
- `RecipeAddMenu` props: `{ onSelect: (choice: 'new' | 'url' | 'paste' | 'json' | 'photo') => void }` — `<button aria-haspopup="menu">Add</button>` with items "New recipe", "From URL", "Paste text", "From JSON file", "From photo".
- `RecipePhotoImport` props: `{ ocr?: ReceiptOcrController; onSave: (recipe: NewRecipe) => Promise<void>; onCancel: () => void }` — two labelled inputs ("Take photo" with `capture="environment"`, "Upload photo"); runs `ocr.run(file)`, `orderReceiptFragments(result.fragments).map(row => row.text).join('\n')` (confirm `ReceiptRow` text field name in `receiptParser.ts:6-11` and use it), then `parseRecipeText`, then renders `RecipeEditor` with `heading="Review scanned recipe"`. Error state shows `validation-errors`.
- `RecipesView` toolbar: `RecipeAddMenu` + overflow `<button aria-label="More actions">⋯</button>` containing "Export JSON". Remove the three old import buttons.

- [ ] **Step 1: Write failing tests** — `RecipePhotoImport` with a stub `ocr` whose `run` resolves fragments for "Pancakes / 2 cups flour / 1 egg / Mix and fry" shows the editor prefilled with name "Pancakes" and 2 ingredients; stub rejecting shows an error; `RecipesView` Add menu lists five items and "New recipe" opens the editor.
- [ ] **Step 2–4: FAIL → implement → PASS.**
- [ ] **Step 5: Commit** `feat(recipes): single add menu with photo import`

### Task 9: Navigation and App rewire

**Files:**
- Modify: `src/app/navigation/OrbitalNav.tsx` (section union + destinations), `src/app/navigation/OrbitalNav.test.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`, `src/styles/index.css` (bottom tab bar ≤720px: `.top-nav` fixed bottom, main gets bottom padding), `tests/e2e/*`, `tests/browser/*` (tab labels)
- Delete: `src/app/navigation/MobileNav.tsx`, `src/features/receipt/ImportHub.tsx`

**Interfaces:**
- `export type OrbitalSection = 'plan' | 'shopping' | 'pantry' | 'recipes' | 'receipts'`; destinations in that order; remove `.top-nav-heading` block. Keep `nav.top-nav` and `.top-nav-item` class names so existing nav tests only change labels.
- `App` state: `activeSection` default `'plan'`; `pendingReceiptId: string | null` set by Pantry's `onOpenReceipt` (also sets `activeSection='receipts'`), cleared by `ReceiptsView.onOpened`. `importReceipt` passed to `ReceiptsView`; `createRecipe` to `RecipesView`; `onQuote` → `source.prices.saveCapture` then `refreshPantryFromPriceStore`; `onFindCollision` / `onMerge` → `source.findStockCollision` / `source.mergeStockInto` then refresh.
- Remove the app footer element.

- [ ] **Step 1: Update tests first** — `OrbitalNav.test.tsx` expects the five labels and no "Import"; `App.test.tsx` expects Plan as the initial view and Receipts tab present.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** full suite + tsc + `npx vite build` — PASS. Run `npx playwright test tests/browser` if browsers are installed; otherwise note it.
- [ ] **Step 5: Commit** `feat: five-tab navigation, retire Import hub and MobileNav`

### Task 10: Visual verification and push

- [ ] **Step 1:** `npx vite preview` + headless screenshots of all five tabs at 390×844 and 1280×900; check: no horizontal scroll, bottom tab bar visible on phone, no placeholder copy, receipt year groups collapse.
- [ ] **Step 2:** Fix any layout defect found (one commit per fix).
- [ ] **Step 3:** `git push origin main` and report the deploy commit.
