# NutriPlan Pantry Inventory and Receipt Log Design

**Status:** Approved; implementation completed in the current working tree

## Intent

Pantry is the personal source of truth for what is currently available at home. Receipt scans and manual purchases add to that stock; cooking a recipe consumes stock; the shopping list compares planned recipe requirements with the remaining stock. Repeated purchases of the same item accumulate instead of creating confusing duplicate pantry cards.

Receipt history remains available separately from current stock. Each saved receipt is a reviewable log entry with merchant/purchase name, date, line items, and prices. A user can remove an accidental duplicate receipt when none of its stock has been consumed. Once any stock from that receipt has been consumed, deleting the receipt is blocked so the app cannot silently create an incorrect pantry balance.

## Goals

- Make pantry totals authoritative and persistent for personal, local-first use.
- Accumulate compatible repeated purchases into one visible pantry item balance.
- Preserve receipt-level provenance and line-level editing/deletion.
- Deduct pantry quantities when a planned recipe is cooked.
- Derive shopping needs from all planned meals and the actual pantry balance.
- Keep unit conversion conservative and explain shortages or incompatible units.
- Keep the flow usable on a phone and offline.

## Non-goals

- No multi-device synchronization, remote price/stock writes, or new authentication model.
- No ratings, admin approval, bookmarklets, or household sharing.
- No supermarket checkout or automatic purchase ordering.
- No deletion of a receipt after any of its purchased stock has been consumed.
- No automatic fuzzy merging of distinct brands, package sizes, or incompatible units.

## Prerequisite and current-code boundary

This design depends on the local price-history foundation already merged in commit `e74d010` (`feat: add local price history`). That commit provides the `nutriplan-cache` IndexedDB v2 database and the existing `price_events`, `price_observations`, `price_items`, and `price_stock` stores. It also provides the current `PriceStore` boundary used by the app. If this design is applied to a revision before `e74d010`, the price-history plan's Tasks 1–2 must be merged first; the stores are not created by this document alone.

The pantry work upgrades that foundation to the next schema version and adds the inventory-specific stores described below. It does not assume a remote inventory schema or service-role credentials.

The main integration points are:

- `src/lib/shopping-list.ts`: aggregate all pantry rows and perform strict unit-aware subtraction.
- `src/types/domain.ts`: extend `ShoppingListItem` with an exact/converted/unresolved match state while retaining the legacy `PantryItem` display shape.
- `src/lib/units.ts`: add a strict conversion helper for inventory operations; preserve the existing permissive `convertUnitsDetailed` behavior used by recipe-cost calculations.
- `src/features/pantry/pantryInventoryService.ts`: own accumulation, consumption, receipt provenance, and deletion rules.
- `src/app/dataSource.ts`: expose the inventory service without coupling UI code to IndexedDB.
- Pantry, meal-plan, recipe-detail, and shopping-list views: call the service and existing repositories rather than opening storage directly.

The repository already has a pinned Chromium browser harness (`@playwright/test` and `playwright.config.ts`), so the IndexedDB integration tests in this design use that harness rather than introducing an unpinned browser dependency.

## Approaches considered

1. **Current-stock service (chosen):** smallest change for a personal household, preserves current Pantry/Shopping UI, and supports safe receipt deletion through contribution records.
2. **Full immutable inventory ledger:** strongest audit and undo model, but larger than the immediate personal-use requirement and overlaps with future sync/history work.
3. **UI-only subtraction:** rejected because quantities would not persist and receipt deletion could not be made safe.

## Chosen approach

Use a current-stock service over the existing local IndexedDB v2 price store. Pantry displays one aggregated current-stock row per confirmed catalog identity and compatible unit basis. Receipt events and observations remain separate records so the receipt log can show exactly what was purchased. A small stock-contribution record links each purchase line to its receipt event and aggregated pantry row. Consumption records reference the affected stock row and receipt contributions, allowing the system to determine whether a receipt still has deletable, unconsumed stock.

This is intentionally smaller than a complete immutable inventory ledger while retaining the provenance needed for safe receipt deletion. The service boundary should allow a future ledger implementation without coupling UI components to IndexedDB tables.

## Receipt and pantry behavior

### Purchase accumulation

When a reviewed receipt is saved:

1. Match each line to an existing confirmed catalog item by normalized name, brand, package quantity, and package unit.
2. Require review for ambiguous identity; do not silently merge different brands or known package sizes.
3. Create one receipt event and one observation per line, preserving line ordinals, merchant, date, currency, and captured time.
4. For purchase lines, add quantity to the matching pantry stock row when units are compatible.
5. Recalculate the stock row's weighted-average major-unit price from its existing unconsumed stock value and the new purchase contribution. Preserve the recorded currency; do not convert currencies.
6. For quote lines, record history only and do not change pantry quantity.

The aggregation key is precise: `catalogItemId + canonical compatible unit basis + expirationDate (including null) + currency`. A different catalog identity, incompatible unit basis, expiration date, or recorded currency creates a separate stock row. Package and brand identity are part of catalog identity. Thus “one pantry row” means one row for one exact aggregation key; expiration batches are intentionally separate.

The stock row's displayed price is labeled **average paid per unit** and may be used for pantry valuation. It is not the latest observed price. The price-history panel continues to show **latest observed price** from the most recent observation, so the two values remain visibly distinct and are never silently substituted for one another.

Weighted average is derived from the unconsumed contribution records, each of which stores its own quantity and paid value. A cached average on `price_stock` may accelerate reads, but it is never the only copy of the value and is recomputed after accumulation, consumption, line deletion, or receipt deletion.

Example: two purchases of 5 soup with the same item identity and compatible units display as one pantry row with quantity 10. The receipt log still shows both receipt events independently.

### Pantry consumption

The recipe detail or meal-plan flow exposes `Cook recipe`. It shows a review of required ingredients, available quantities, and shortages. The implementation provides a typed `consumeRecipe` operation that resolves the recipe ingredients and delegates to a typed `consumeIngredients` operation, so both recipe cooking and future manual consumption use the same stock-deduction rules. Confirming a cook operation:

- consumes available compatible quantities from pantry stock;
- creates a consumption record with operation ID, recipe ID, date, and line allocations;
- leaves insufficient items at zero and reports the shortage rather than making negative stock;
- does not create a new price observation or receipt;
- keeps the recipe cook operation retry-safe by operation ID.

Consumption allocates stock FIFO by contribution purchase date, then capture time, then stable contribution ID. Each allocation increments that contribution's `consumedQuantity`; it never rewrites the original purchased quantity or paid value. The same rule is used for manual ingredient consumption.

The cook operation ID is generated when the confirmation flow opens and is persisted in `price_pending_operations` before the commit begins. If the page reloads mid-flow, the pending operation can be resumed or safely recognized as already committed. A duplicate operation ID returns the original result rather than deducting stock twice.

The first release consumes the available amount for each ingredient and reports any remaining amount needed. A later enhancement may offer partial-cook confirmation or serving multipliers; the service accepts a multiplier now so the boundary is explicit.

### Manual pantry edits

Manual add and edit remain available. A manual add with quantity and price creates a `source: 'manual'` event, observation, and contribution, shown in the receipt log as a Manual entry with no merchant. It uses the same accumulation and weighted-average pricing service rather than creating a second visible row. A stock-only adjustment is a distinct manual-adjustment contribution with no price observation. Notes and expiration remain attached to the stock row. Removing pantry stock does not delete receipt history.

## Receipt log

Add a compact receipt-log view within Pantry rather than a new top-level navigation destination. It has:

- merchant/store name;
- receipt purchase date, with estimated-date labeling when the date was not supplied;
- total/subtotal and currency;
- item count and saved status;
- duplicate-scan hint when the fingerprint matches an existing receipt.

Clicking a receipt opens a detail panel containing all reviewed lines. Each line can be edited or deleted. Deleting a line reverses only that line's unconsumed stock contribution and removes its observation; if that line's stock has been consumed, line deletion is blocked with an explanation. Deleting the entire receipt is allowed only when every purchase contribution from the receipt is unconsumed. It removes the receipt event, observations, and stock contributions atomically. Quotes can be deleted because they never changed stock, subject to the same event-level transaction.

This is deliberately different from historical correction. `correctObservation` changes historical observation fields and never mutates stock. `deleteReceiptLine` and `deleteReceipt` are explicit inventory-deletion operations that may reverse only unconsumed stock and must be documented and tested separately. They cross the correction boundary only because the user is removing a purchase that was never consumed.

The UI's preflight consumed check is advisory. `deleteReceipt` and `deleteReceiptLine` re-read the event revision, contribution rows, and consumption allocations inside the same IndexedDB readwrite transaction that performs deletion. If any contribution has become consumed or the expected revision is stale, the transaction aborts and no history or stock is changed.

The accidental duplicate-scan flow is therefore: open Pantry → Receipt log → duplicate receipt → Delete receipt. The app confirms the receipt identity and resulting pantry quantity before committing.

## Shopping-list behavior

Shopping requirements are derived from every planned recipe ingredient, grouped by normalized ingredient identity. Pantry availability is aggregated across all matching stock rows and compatible units. `src/lib/shopping-list.ts` must aggregate every matching pantry row; it must not use only the first row returned for a name. Compatible units are converted before subtraction; incompatible or unknown units remain visible as unresolved shortages instead of being treated as zero or equal.

Inventory operations use a new strict helper in `src/lib/units.ts`, for example `convertUnitsStrictDetailed`. It permits exact matches and approved mass-to-mass or volume-to-volume conversions, plus explicitly supplied ingredient densities. It does not treat the legacy `'units'` sentinel as compatible with arbitrary units. The existing permissive `convertUnitsDetailed` semantics remain unchanged for recipe-cost behavior and are not used for shopping subtraction or consumption.

Each result displays:

- required amount and unit;
- available amount and unit;
- amount still needed;
- whether the match is exact, converted, or unresolved.

`ShoppingListItem` exposes that state as `match: 'exact' | 'converted' | 'unresolved'`, with an optional explanation for unresolved mismatches. The shopping list must not silently subtract an incompatible pantry row.

Covered ingredients appear separately as optional confirmation. The list remains derived and is not persisted as an independent table.

## Data model and storage

Keep the existing `price_events`, `price_observations`, `price_items`, and `price_stock` records. Upgrade `nutriplan-cache` from v2 to v3 and extend the local price store with:

- `price_stock_contributions`: purchase-line-to-stock-row quantity/value allocations and consumed quantity;
- `price_consumptions`: cook operation metadata and allocation lines;
- `price_pending_operations`: persisted operation IDs and inputs for retry-safe capture/cook commits;
- `price_receipt_meta`: optional receipt-log display fields if they do not fit the existing event record.

Required identifiers:

- `operationId`: UUID for retry-safe receipt save and cook operations;
- `eventId`: receipt or quote identity;
- `observationId`: reviewed line identity;
- `stockId`: aggregated current pantry row;
- `consumptionId`: cook operation identity.

Quantities remain exact decimal strings across persistence boundaries. Monetary values remain integer minor units in price history and major-unit numbers only at the legacy pantry display boundary. Every receipt delete, line delete, purchase accumulation, and cook operation uses one IndexedDB readwrite transaction. A failed transaction must not leave partial stock, history, or receipt-log state.

The existing legacy snapshot pantry is migrated into the v2 stock store once. Legacy notes, expiration, quantity, unit, and major-unit price remain intact. Existing undated pantry prices are not invented as dated receipt observations.

For compatibility, the aggregated `PantryItem` projection keeps `userId`, `item`, `amount`, `unit`, `price`, `expirationDate`, `category`, `notes`, `isActive`, and optional `catalogItemId`. `amount` is the numeric UI projection of the exact persisted quantity, `price` is the labeled weighted-average major-unit value in the row's currency, and `isActive` reflects whether remaining quantity is positive. Exact quantities, currency, contribution values, and provenance remain in the v3 price stores.

## Interfaces

Create a focused pantry inventory boundary:

```ts
interface PantryInventoryService {
  accumulatePurchase(input: PurchaseInput): Promise<PurchaseResult>;
  adjustStock(input: StockAdjustment): Promise<PantryItem>;
  consumeIngredients(input: ConsumeIngredientsInput): Promise<ConsumeIngredientsResult>;
  consumeRecipe(input: ConsumeRecipeInput): Promise<ConsumeRecipeResult>;
  listCurrentStock(): Promise<PantryItem[]>;
  listReceipts(query?: ReceiptQuery): Promise<ReceiptSummary[]>;
  getReceipt(id: string): Promise<ReceiptDetail>;
  deleteReceipt(id: string, expectedRevision: number): Promise<void>;
  updateReceiptLine(id: string, expectedRevision: number, changes: ReceiptLineCorrection): Promise<void>;
  deleteReceiptLine(id: string, expectedRevision: number): Promise<void>;
}
```

The UI consumes this interface rather than opening IndexedDB directly. `AppDataSource` exposes it as `inventory` while existing recipe and meal-plan repositories remain unchanged.

## User-facing states

- Show `Stored on this device` for local stock and receipt history.
- Show loading states while receipt details or bounded history are read.
- Show empty states for no pantry items, no receipts, no planned meals, and no missing ingredients.
- Show a blocking deletion message when a receipt or line has consumed stock.
- Show a confirmation summary before cooking and before deleting a receipt.
- Show a duplicate receipt warning before saving an exact repeated scan, with an explicit save-as-another-purchase option.
- Never report a successful save before the IndexedDB transaction commits.

## Test strategy

Pure logic tests cover:

- repeated compatible purchases aggregate to one current-stock balance;
- weighted average pricing is correct after accumulation;
- different brands/package sizes remain separate;
- cooking deducts quantities without going negative;
- missing and incompatible units remain shopping shortages;
- duplicate receipt operation IDs are retry-safe;
- receipt deletion is allowed for unconsumed stock and rejected after consumption;
- line deletion reverses only the unconsumed line contribution;
- receipt event and pantry updates roll back together on failure.

Repository/browser tests use real Chromium IndexedDB for:

- v1-to-v2 migration preserving recipes, settings, and legacy pantry rows;
- two purchases of the same item visible as one accumulated pantry row;
- receipt log retrieval and bounded receipt detail;
- atomic receipt deletion and blocked deletion after cooking;
- offline restart retaining pantry and receipt history.

UI tests cover:

- receipt list in Pantry, receipt detail navigation, line edit/delete, and receipt delete confirmation;
- `Cook recipe` review, shortage display, confirmation, and updated pantry/shopping list;
- 360px phone layout, keyboard access, and no horizontal overflow.

## Open implementation calls

- The first implementation will use one aggregated pantry row per `catalogItemId + canonical compatible unit basis + expirationDate (including null) + currency`; separate expiration batches remain separate rows when their expiration/storage details conflict.
- Receipt detail will live inside Pantry, not as a new navigation tab.
- Cooking confirmation will consume available stock and show shortages; it will not silently block cooking because an ingredient is missing.
- Receipt deletion will be blocked after any associated stock contribution has been consumed.
