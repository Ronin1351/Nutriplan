# Nutriplan Current Data Contracts

> Frozen from `index.html` and `api/receipt-read.js` on 2026-10-28. These are observed contracts, not yet TypeScript definitions or a security-approved schema.

## Contract boundary

The current client uses a hand-written `supaFetch()` wrapper around Supabase REST. Requests target:

```text
https://aopdcjovyaogxctskyqe.supabase.co/rest/v1/<table>
```

Requests send the Supabase anon key as both `apikey` and `Authorization: Bearer ...`, use JSON bodies, and request `return=representation` for non-GET operations. The migration should replace this client helper with the Supabase JavaScript client and environment configuration.

## Database tables

The following fields are observed from reads, writes, filters, and renderers in `index.html`. Fields not listed may exist in the database but are not part of the current application contract.

### `users`

Observed fields:

| Field | Current use | Expected shape |
| --- | --- | --- |
| `id` | User identity and foreign-key target | Database ID, usually UUID or numeric ID |
| `username` | Login lookup, display, recipe submitter lookup, local session marker | String, case-insensitive unique value expected |
| `password` | Current browser-side login and password update | String; legacy insecure contract, must be removed from client auth |
| `name` | Display name and recipe submitter fallback | String, nullable in practice |
| `email` | Profile field and recipe submitter fallback | String, nullable/empty in practice |
| `avatar_url` | Header/profile avatar | Public URL string, nullable/empty |
| `is_admin` | Controls admin recipe visibility and Approval tab | Boolean, defaults false for registration |

Current registration sends `username`, `password`, `name`, `email`, `avatar_url`, and `is_admin: false`. Current profile updates can send `name`, `email`, `avatar_url`, and optionally `password`.

### `recipes`

Observed fields:

| Field | Current use | Expected shape |
| --- | --- | --- |
| `id` | Recipe identity and meal-plan reference | Database ID |
| `name` | Recipe title and search/display text | Non-empty string |
| `category` | Category filter and grouping | String; current UI has validated categories plus `Miscellaneous` fallback |
| `servings` | Recipe display and cost context | Positive number; default 4 |
| `prep_time` | Recipe display and print output | Minutes, non-negative number; default 30 in import/save paths |
| `ingredients` | Recipe ingredient list and shopping/cost calculations | JSON array of ingredient objects |
| `instructions` | Detail and print output | Plain-text string |
| `image_url` | Recipe image and print output | URL string, nullable/empty |
| `submitted_by` | Submitter display and pending-recipe filtering | String, usually username/email/name |
| `approved` | Guest/user visibility and admin workflow | Boolean |
| `created_at` | Admin/user recipe ordering | Timestamp |
| `average_rating` | Average rating display | Number, default 0 |
| `rating_count` | Rating count display | Number, default 0 |

The current recipe query selects:

```text
id,name,category,servings,prep_time,ingredients,instructions,image_url,
submitted_by,approved,created_at,average_rating,rating_count
```

### Recipe ingredient object

Observed shape:

```json
{
  "item": "flour",
  "amount": 2,
  "unit": "cup"
}
```

The parser accepts leading whole numbers, decimals, simple fractions, mixed fractions, and common unit aliases. The unit may be empty when no recognized unit is present. The migration should preserve unknown/non-convertible units rather than silently discarding them.

### `user_recipes`

Observed fields:

| Field | Current use | Expected shape |
| --- | --- | --- |
| `user_id` | User ownership/collection link | Foreign-key ID |
| `recipe_id` | Recipe collection link | Foreign-key ID |

New/imported recipes are linked by inserting `{ user_id, recipe_id }`. Removing a recipe from a user's collection deletes only this link.

### `ratings` — deferred

Observed fields:

| Field | Current use | Expected shape |
| --- | --- | --- |
| `user_id` | Rating owner and lookup | Foreign-key ID |
| `recipe_id` | Rated recipe | Foreign-key ID |
| `rating` | One-to-five-star value | Integer 1 through 5 |

The current client reads by `user_id` and `recipe_id`, then PATCHes the existing row or POSTs a new row. Ratings are deferred from the first personal release.

### `pantry`

Observed fields:

| Field | Current use | Expected shape |
| --- | --- | --- |
| `id` | Item identity for edit/remove/notes | Database ID |
| `user_id` | User ownership | Foreign-key ID |
| `item` | Case-insensitive item name and shopping-list match | Lowercase string on add |
| `amount` | Quantity and shopping comparison | Positive number for active items; zero for history |
| `unit` | Quantity unit and conversion | String |
| `price` | Per-unit price and cost calculation | Non-negative number |
| `expiration_date` | Expiration display/status | ISO date string or null |
| `category` | Icon, filter/display, receipt mapping | String; defaults to `Uncategorized` |
| `notes` | User notes modal | String or null |
| `is_active` | Active versus history view | Boolean; treated as true unless explicitly false |

The current client loads rows with `user_id=eq.<id>&order=item.asc` and maps numeric fields with `parseFloat()`.

### `meal_plans`

Observed fields:

| Field | Current use | Expected shape |
| --- | --- | --- |
| `user_id` | Plan ownership | Foreign-key ID |
| `day` | Weekday bucket | One of Monday through Sunday |
| `recipe_id` | Planned recipe | Recipe ID, stored/rendered as string in local state |
| `position` | Order within a day | Non-negative integer |

The current client loads ordered by `day.asc,position.asc`. Saving deletes all rows for the user and inserts the current seven-day plan as a batch.

## Storage contracts

### `recipe-images` bucket

Recipe and avatar uploads use a generated filename:

```text
<crypto.randomUUID()>-<original filename>
```

The upload is a POST to the Storage object endpoint with the file MIME type. The client expects a public URL under:

```text
/storage/v1/object/public/recipe-images/<filename>
```

The migration must move upload policy and authorization checks to a controlled storage design. The existing app also references a public `assets` path for the application logo; that is a static asset reference, not a user-upload contract.

## Browser persistence contracts

| Key | Stored value | Purpose | Migration note |
| --- | --- | --- | --- |
| `nutriplan.currentUser` | JSON object containing `{ "username": string }` | Restores the current legacy session | Replace with Supabase Auth session persistence |
| `nutriplan.currency` | Currency code such as `PHP` or `USD` | Restores selected currency | Preserve behavior in local preferences |
| `theme` | `light` or `dark` | Restores theme | Preserve behavior in local preferences |
| `nutriplan_import_recipe` | JSON payload with `recipe`, `sourceUrl`, `timestamp` | Transfers bookmarklet result to import modal | Bookmarklet is deferred |

## Domain-shaped runtime objects

The current renderer maps database rows to objects approximately shaped as follows:

```ts
type RecipeView = {
  id: string | number;
  name: string;
  category: string;
  servings: number;
  prepTime: number;
  isFavorite: boolean;
  image: string | null;
  ingredients: Ingredient[];
  instructions: string;
  submittedBy: string;
  approved: boolean;
  averageRating: number;
  ratingCount: number;
};

type Ingredient = {
  item: string;
  amount: number;
  unit: string;
};

type PantryView = {
  id: string | number;
  item: string;
  amount: number;
  unit: string;
  price: number;
  expiration_date: string | null;
  category: string;
  notes: string | null;
  is_active: boolean;
};

type MealPlan = Record<
  'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday',
  string[]
>;
```

These are migration reference shapes, not final TypeScript definitions. The final domain model should use consistent naming and isolate database-specific snake_case fields at the repository boundary.

## Recipe import contracts

### URL/pasted import draft

The parser produces a draft approximately shaped as:

```ts
type RecipeImportDraft = {
  name: string;
  category: string;
  servings: number;
  prep_time: number;
  ingredients: Ingredient[];
  instructions: string;
  image_url: string;
  submitted_by: string;
  approved: false;
  source_url?: string;
};
```

The current save path requires a signed-in user, a non-empty name, and at least one ingredient. It inserts into `recipes`, then best-effort inserts into `user_recipes`.

The online URL parser uses a response cap of approximately 2.5 MB, a per-request timeout of 15 seconds, and an overall import timeout of 60 seconds. These limits are part of the observed behavior and should be retained or made stricter in the server-assisted implementation.

## Receipt contracts

### Current UI receipt item

The current mock/extraction UI expects:

```ts
type ReceiptItem = {
  name: string;
  category?: string;
  weight?: string;
  pricePerUnit?: string;
  totalPrice: number;
};
```

The converter maps receipt categories to pantry categories, parses weights in `lb`, `kg`, `g`, and `oz`, derives price from `pricePerUnit` when present, and defaults to one `units` quantity when no weight is available.

### `/api/receipt-read.js`

Request:

- Method: `POST`
- Body: raw binary image data
- Required server environment: `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY`

Responses:

- `200`: `{ "text": string }`
- `400`: `Empty body`
- `405`: `Method Not Allowed`, with `Allow: POST`
- `500`: missing configuration or server error
- Azure status/error responses are forwarded where possible
- `502`: missing operation location or invalid Azure response

The route calls Azure Read v3.2, polls the operation URL up to 15 times with an 800 ms interval, and extracts all returned line text joined by newlines. The current client does not yet call this endpoint; connecting OCR to item extraction is a later task.

## External service contracts

### TheMealDB

The client calls:

```text
GET https://www.themealdb.com/api/json/v1/1/filter.php?c=<category>
GET https://www.themealdb.com/api/json/v1/1/lookup.php?i=<mealId>
```

The category response provides `idMeal`, `strMeal`, and `strMealThumb`. The detail response is converted from `strIngredient1..20` and `strMeasure1..20` into the local ingredient shape.

### Supabase

Supabase is the current persistence source for recipes, collections, ratings, pantry, meal plans, users, and image storage. The migration should preserve these logical resources while replacing the browser REST helper, hard-coded configuration, and insecure custom password flow.

## Deferred contracts

- Ratings remain documented but are not required for the first personal mobile release.
- Admin approval/rejection remains documented but is not required for the first personal mobile release.
- Bookmarklet transfer via `nutriplan_import_recipe` remains web-only and deferred.
- Multi-device synchronization, conflict resolution, and sync-status semantics are not defined by the current app and remain deferred.
