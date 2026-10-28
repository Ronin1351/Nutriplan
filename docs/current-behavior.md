# Nutriplan Current Behavior

> Frozen from `index.html` and `api/receipt-read.js` on 2026-10-28. This document describes the current browser app; it is not a proposal to change application behavior.

## Application shape

Nutriplan is currently a single-page browser application. `index.html` contains the markup, CSS, global state, rendering functions, event handlers, Supabase REST calls, recipe parsing, image upload, printing, and receipt-scanner UI. The only separate source file is `api/receipt-read.js`, a server endpoint for Azure Computer Vision Read OCR.

The app uses Supabase directly from the browser through its REST and Storage endpoints. The current client has a hard-coded Supabase URL and anon key. The browser-side user model also reads and compares a password field directly; this behavior must be treated as legacy behavior and must not be reproduced in the migration.

## Startup and session behavior

On startup the app:

1. Reads `nutriplan.currentUser` from `localStorage`.
2. Resolves the stored username against the `users` table.
3. Loads the signed-in user's pantry and meal plan.
4. Loads recipes according to guest, signed-in, or admin visibility.
5. Applies the saved theme and currency.

When no user is signed in, recipes remain browseable but pantry and meal-plan data are empty or unavailable. Logging out clears the local current-user marker, resets the in-memory meal plan, and reloads the guest recipe view.

## Navigation and presentation

The main tabs are:

- Recipes
- Pantry
- Meal Planner
- Shopping List
- Approval, visible only to admins in the current implementation

The layout is responsive CSS with mobile-specific rules, but it is still a desktop-oriented DOM application. Forms use modals, inline event handlers, browser alerts/confirms, and direct DOM mutation. Buttons and controls are generally made touch-friendly at small widths.

## Recipes

### Browse and filter

- Guests see up to 20 approved recipes.
- Signed-in users see all approved recipes plus their own pending recipes.
- Admins see all recipes and receive the Approval tab.
- Recipes can be filtered by category.
- A favorites-only checkbox exists, but favorites are currently an in-memory `isFavorite` flag and are not persisted to Supabase.
- Recipe cards show category, servings, prep time, submitter, a short ingredient preview, image/placeholder, and actions.

### Create, edit, view, and remove

Signed-in users can create recipes with:

- Name
- Category
- Servings
- Prep time
- Ingredient lines
- Instructions
- Image URL or uploaded image

Recipes open in a detail modal. Signed-in users can edit their recipe, add it to the meal plan, print it, and remove it from their collection. Removal deletes the `user_recipes` link rather than deleting the shared recipe row.

Recipe images upload to the Supabase `recipe-images` Storage bucket and are represented by public URLs.

### Recipe cost

The app calculates recipe cost from pantry quantities, ingredient units, unit conversion, and pantry prices. It reports a total, itemized breakdown, and missing items. Currency formatting is controlled by the selected currency.

### Ratings — deferred

The current app has interactive one-to-five-star ratings and stores them in `ratings`, including average/count display. Ratings are intentionally deferred from the first personal mobile release and should not block the core migration.

### Admin approval — deferred

Newly created/imported recipes are inserted with `approved: false`. Admins can view pending recipes, approve them, or reject/delete them. This workflow is documented for later parity work but is deferred from the first personal mobile scope.

## Online recipe URL import and parsing — in scope

Online URL import is part of the core migration scope and must be preserved.

The current import flow accepts a URL in the import modal, fetches the document with a timeout and response-size cap, parses it into a DOM document, and creates a reviewable recipe draft before saving. It reports network, timeout, empty-body, HTTP, and CORS-related failures.

Parsing precedence and fallbacks are:

1. Schema.org JSON-LD scripts.
2. Nested JSON-LD structures such as arrays, `@graph`, and `mainEntity`.
3. Schema.org Recipe microdata.
4. Selector-based extraction for supported recipe page structures.

The parser normalizes:

- Recipe name from `name`, `headline`, or `title`.
- Image from string, object, array, Open Graph, Twitter, or page images.
- Ingredients from `recipeIngredient` into amount/unit/item records.
- Instructions from strings, arrays, objects, and HTML into plain text.
- Duration from ISO-8601 values such as `PT1H30M` and common minute text.
- Servings from `recipeYield`, defaulting to 4.
- Category using the current name-based category inference.

The draft requires a name and at least one ingredient before saving. The saved recipe is linked to the signed-in user's collection and starts unapproved. URL import must remain a supported web and mobile flow; the migration should use a server-assisted fetch/parser when browser CORS would otherwise prevent reliable imports.

## Pasted recipe import — in scope

The import modal also accepts pasted HTML or JSON-LD plus an optional base URL. The same normalization and validation rules apply before the user confirms saving.

## Bookmarklet — deferred

The current web app provides a bookmarklet that extracts JSON-LD, microdata, or fallback page content on another recipe page. It stores a temporary payload in `nutriplan_import_recipe`, opens Nutriplan with `?import=bookmarklet`, and loads the draft into the import modal. Bookmarklets are web-only and intentionally deferred from the personal mobile release.

## TheMealDB integration

When a recipe category is selected, the app queries TheMealDB for category results and displays up to 12 online recipe cards. Selecting a result fetches full recipe details, converts the ingredient fields into the local ingredient shape, inserts a new unapproved recipe, and links it to the current user's collection.

## Pantry

Pantry management requires a signed-in user. The current UI supports:

- Add item
- Edit item
- Search by item name
- Category selection
- Amount and unit
- Price
- Optional expiration date
- Notes
- Active/inactive history
- Quick re-add from history
- Remove as empty or delete permanently

Item names are lowercased on add. Adding a duplicate prompts the user to merge quantities. If units differ, the app asks whether to convert; compatible units are converted and prices are combined using a weighted average. Active pantry value is displayed in the selected currency.

Inactive items retain their row for history with amount zero and `is_active: false`. Notes are saved independently to the pantry row.

## Receipt scanning

The receipt UI requires sign-in and accepts PNG, JPG, or WEBP image files through file input or drag-and-drop. It previews the image, shows scan progress/errors, displays extracted item name/category/weight/price-per-unit/total price, and lets the user add reviewed items to the pantry.

The current `index.html` path calls a mock `extractItemsFromReceipt()` function that returns sample grocery items after a delay. It does not currently call `/api/receipt-read.js`. The separate API route accepts a binary image POST, calls Azure Read API v3.2, polls the operation URL, and returns `{ text }`.

Receipt items are converted to pantry items using weight parsing, price-per-unit parsing, category mapping, and duplicate merging.

## Meal planner

The planner contains Monday through Sunday. Users can:

- Add a recipe to one or more days through a day-selector modal.
- Add a recipe directly from a day card.
- Remove a planned recipe from a day.
- Open the recipe detail modal from a planned item.
- Print the weekly plan.

The current persistence implementation deletes all rows for the user and recreates `meal_plans` entries with day, recipe ID, and position.

## Shopping list

The shopping list is derived in memory from all planned recipe ingredients. For each ingredient name it sums the required amount, compares it to a matching pantry item by case-insensitive name, and reports the amount to buy. Items with sufficient pantry quantity are shown as available/in pantry.

The list is not a separate persisted table.

## Authentication and profile

Registration collects username, password, name, email, and optional avatar. Login loads all users and compares username/password in the browser. Profile editing supports name, email, avatar, and password changes. The header displays the current user's name/avatar and exposes logout.

This is legacy behavior only. The React migration must replace it with a secure authentication boundary and user-scoped authorization.

## Theme and currency

- Theme toggles between light and dark and persists in `theme`.
- Currency persists in `nutriplan.currency`.
- Supported currencies are PHP, USD, EUR, GBP, CAD, AUD, JPY, INR, and MXN.
- JPY is formatted without decimals; other currencies use two decimals.

## Printing and other web-only behavior

Recipe, meal-plan, and shopping-list printing use `window.print()` and temporary browser document/window content. These flows should remain available on web/PWA builds but are not required to block the first native mobile release.

## Deferred product scope

The following are explicitly deferred until the personal core is stable:

- Ratings
- Admin approval/rejection
- Bookmarklets
- Multi-device sync, conflict resolution, and sync-status UX

The current app already persists core data remotely through Supabase, but it has no deliberate multi-device synchronization model or conflict handling. That is why multi-device sync is a separate deferred product concern.

## Task 1 acceptance criteria

- Existing guest, signed-in, and admin flows are described.
- Recipes, online URL import/parsing, pasted import, TheMealDB, pantry, receipt scanning, meal planning, shopping list, theme, currency, image upload, and printing are described.
- Ratings, admin approval, bookmarklets, and multi-device sync are explicitly marked deferred.
- Current persistence keys, tables, storage buckets, and API route behavior are documented in `docs/data-contracts.md`.
