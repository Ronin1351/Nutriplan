# Receipt Category Learning — Short Design

## Intent

Make receipt imports useful even when OCR cannot identify an item category. Nutriplan will suggest a category, let the user correct it during receipt review, and remember that correction for future imports.

## Goals

- Show a category selector for every receipt item before saving.
- Provide useful first-pass suggestions from item names.
- Persist personal category rules locally for offline, single-user use.
- Apply learned rules to later receipt imports.
- Keep manual correction authoritative over automatic suggestions.

## Non-goals

- No multi-device synchronization yet.
- No admin approval or shared category taxonomy.
- No automatic renaming of receipt item text.
- No machine-learning training pipeline; matching is transparent and editable.

## Approach

Alternatives considered:

1. **Local learning rules (chosen):** use the existing offline cache to store normalized item-name keywords and the user-selected category. This matches the personal/offline scope and can later migrate to Supabase.
2. **Supabase rules:** supports multi-device use immediately, but adds network/auth/schema work that is explicitly deferred.
3. **Category only, without rules:** simplest, but forces the user to repeat the same corrections on every receipt.

## Behavior

- The default category is `Uncategorized` unless a built-in keyword rule or saved personal rule matches.
- Receipt review displays `Category` beside item, quantity, unit price, and line total.
- A category dropdown includes: `Uncategorized`, `Produce`, `Meat`, `Poultry`, `Seafood`, `Dairy`, `Grains`, `Pantry`, `Beverages`, `Snacks`, and `Household`.
- Changing a category marks it as the user’s choice and saves a normalized rule for the item name when the receipt is saved.
- Learned rules are exact matches on the normalized full item name and always beat built-in suggestions. The normalized phrase is unique and is upserted, so a phrase has no learned-rule tie.
- Built-in suggestions match whole whitespace-separated tokens, never arbitrary substrings.
- `Uncategorized` is never saved as a learning rule.
- A category remains editable in the pantry after import.
- Existing pantry categories remain unchanged.

## Data and persistence

The receipt draft gains a `category` field per item. A local `categoryRules` collection stores `{ phrase, category, updatedAt }`. It is included in the existing local snapshot/cache and survives reloads and offline use. This cache is used even when the active data source is Supabase; rules are device-local regardless of network mode.

The existing pantry model only has `category: string`; it has no canonical pantry-category union or option list. This feature introduces the canonical `PantryCategory` type and `PANTRY_CATEGORIES` list in the shared domain types, while preserving the existing string field so legacy pantry categories remain valid.

Category application is separate from OCR parsing: `applyCategories(draft, rules)` enriches a parsed receipt draft without making the PaddleOCR parser depend on category storage.

## Verification

- Parser/classifier tests cover built-in suggestions, unknown items, normalization, and learned-rule precedence.
- Receipt review tests verify category controls and edited values passed to save.
- Persistence tests verify rules survive a reload and are reused by a later import.
- Full test suite, typecheck, and production build must pass.
