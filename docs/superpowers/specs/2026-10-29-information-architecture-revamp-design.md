# Information architecture revamp — design

Date: 2026-10-29
Status: awaiting review
Scope: Phase 1 — structure, placement and the functions listed below. Keeps the current dark/green visual theme. A visual-identity pass is a separate Phase 2 spec.

## Problem

Actions and objects are scattered: receipts are created under Import but viewed at the bottom of Pantry; recipe import has three entry points; "Import" is a verb among noun tabs; Pantry stacks an always-open add form, a second "Record price" form, the stock list and the receipt log in one scroll; `MobileNav.tsx` is dead code; the pantry item detail ships a placeholder upload box.

## Navigation

Five top-level destinations, in this order, identical on phone (bottom tab bar) and desktop (top nav):

| Tab | Contents |
|---|---|
| Plan | 7-day grid, Cook action (unchanged `MealPlannerView`) |
| Shopping | Derived list = Plan − Pantry (unchanged `ShoppingListView`) |
| Pantry | Segments: **Stock** (default) · **Purchases** |
| Recipes | Library + one **Add** menu |
| Receipts | **Add receipt** dropdown + history grouped by year |

- `OrbitalSection` becomes `'plan' | 'shopping' | 'pantry' | 'recipes' | 'receipts'`.
- `ImportHub.tsx` and `MobileNav.tsx` are deleted. Their inner components (`RecipeImportPanel`, `ReceiptScanner`) are reused where their objects live.
- Sub-state (segment, open detail, open sheet) lives in each view's local state; no router dependency is added.
- Default tab on launch: Plan.

## Pantry

### Stock segment (default)

- One row per stock row from `price_stock` (duplicate prevention is already enforced by `findMergeTarget`, commit `0123dee`).
- Row shows: name, category, amount + unit, unit price, total value, expiration status.
- Header: total pantry value, **Sort** control, **Add item** button.
- Sort options: `Category` (grouped, header per category, A–Z within), `A–Z`, `Price` (unit price, descending). Choice persists in `localStorage` key `nutriplan.pantry.sort`.
- Search field filters by name or category (existing behaviour).
- **Add item** opens a bottom sheet (phone) / modal (desktop) containing one form: item, amount, unit, price, category, expiration, plus an **Entry type** toggle `Purchase (adds stock)` / `Quote (price history only)`. This replaces both the inline add form and `PriceCaptureForm`. Purchase → `priceStore.createStock`; Quote → `priceStore.saveCapture` with `kind: 'quote'`.
- Tap row → **item detail** sub-view (back button, name, amount, category, price history panel). The "Upload images — placeholder only" block is removed.
- Row actions: Edit, Notes, Remove (existing).

### Edit with merge confirmation

- Edit opens the same sheet pre-filled. On save, the store is asked whether the edited row now collides with another row.
- If it does, a confirm dialog: *"{name} already exists ({amount} {unit}). Combine into one entry?"* — **Combine** merges via `mergeStockRows` (contributions re-pointed, edited row deleted); **Keep separate** saves the edit as-is and leaves two rows.
- Store API change: `updateStock` no longer auto-merges. New methods on `PriceStore`:
  - `findStockCollision(item: PantryItem): Promise<PantryItem | null>`
  - `mergeStockInto(sourceId, targetId): Promise<PantryItem>`
  - `updateStock` becomes a plain put again.

### Purchases segment

- Flat list of every purchased **line** across all receipts and manual purchases: item name, quantity + unit, paid price, date, merchant.
- Sort: `Date` (default, newest first), `Item A–Z`, `Price`.
- Search by item or merchant.
- Tap a line → opens that receipt in the Receipts tab (cross-tab navigation via a callback from `App`).
- Data: `price_observations` joined to `price_events` (merchant, date, currency) and `price_items` (name). New `InventoryService.listPurchaseLines()` returns this joined shape; no schema change.

## Recipes

- Toolbar collapses to one **Add** menu with: `New recipe`, `From URL`, `Paste text`, `From JSON file`, `From photo`.
- `New recipe` → `RecipeEditor`; `From URL` / `Paste text` → `RecipeImportPanel` in that mode; `From JSON file` → existing hidden file input.
- **From photo (new feature).** Take photo or upload (same `<input capture="environment">` pattern as `ReceiptScanner`). Runs the existing PaddleOCR worker (`createReceiptOcrWorkerController`), orders fragments with `orderReceiptFragments`, joins rows into text, and hands that text to a new `parseRecipeText(text)` in `src/lib/recipe-import.ts` that produces a `RecipeImportDraft` (title = first line, ingredient lines detected by leading quantity via the existing `parseIngredientLine`, remaining lines = instructions). The draft opens in `RecipeEditor` for correction before save — OCR output is never saved unreviewed. Handwriting accuracy is whatever the mobile model gives; the editor step is the safety net.
- Export JSON moves into an overflow (⋯) menu on the toolbar.
- Detail and edit remain sub-views with back navigation (existing).

## Receipts

- Header: **Add receipt** dropdown → `Take photo` / `Upload photo`. Both open `ReceiptScanner` in the matching mode; the scanner's own tabs are removed since the dropdown already chose.
- Below: history grouped by **year**, each year a collapsible section showing receipt count and total spend; current year expanded by default, others collapsed. State per year kept in component state only.
- Receipt row: merchant, date (with "estimated" marker), line count, total. Tap → receipt detail (lines, per-line delete, delete receipt) — existing `ReceiptDetail` behaviour, moved out of `PantryView` into `ReceiptsView`.
- `InventoryService.listReceipts()` gains `totalMinor` per receipt (sum of its observations) so the year header and rows can show spend without a second query.

## App shell

- Header keeps brand, online status, currency, theme. Remove the "Your kitchen, organized / Choose a workspace" nav caption and the footer line.
- `App.tsx` section switch maps the five tabs; `importReceipt` and recipe import handlers are passed to the views that own them.

## Files

Create: `src/features/receipts/ReceiptsView.tsx`, `src/features/pantry/PantryStockList.tsx`, `src/features/pantry/PantryPurchasesList.tsx`, `src/features/pantry/StockItemSheet.tsx`, `src/features/recipes/RecipeAddMenu.tsx`, `src/features/recipes/RecipePhotoImport.tsx`, `src/app/navigation/TabBar.tsx`.
Modify: `App.tsx`, `OrbitalNav.tsx` (or replaced by `TabBar`), `PantryView.tsx`, `RecipesView.tsx`, `ReceiptScanner.tsx` (mode prop), `indexedDbPriceStore.ts`, `pantryInventoryService.ts`, `types.ts` (PriceStore), `recipe-import.ts`, `index.css`.
Delete: `ImportHub.tsx`, `MobileNav.tsx`, `PriceCaptureForm.tsx`.

## Testing

- Unit: `parseRecipeText`, `listPurchaseLines` join, `findStockCollision`/`mergeStockInto`, sort comparators, year grouping.
- Component (vitest + testing-library, existing setup): Pantry sort switching, Add sheet Purchase vs Quote dispatch, edit-collision dialog both branches, Receipts year collapse, Recipes Add menu routing.
- Existing e2e (`tests/e2e`, `tests/browser`) updated for the new tab labels.

## Out of scope

Visual identity (typography, palette, card treatment), Supabase pantry path parity for purchases view (local IndexedDB store only, as today), cloud OCR.
