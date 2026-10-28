# PaddleOCR Receipt Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nutriplan's mock receipt scanner with a browser-local PaddleOCR workflow that preprocesses photos, runs inference in a Web Worker, parses Philippine receipt layouts, and requires review before saving.

**Architecture:** Add a lazy-loaded `receiptOcr` adapter backed by `@paddleocr/paddleocr-js` and ONNX Runtime Web, with self-hosted PP-OCRv5 mobile model/WASM assets and explicit web/Android caching. Keep deterministic receipt parsing separate from OCR, expose it through a React scanner/review feature, and leave Azure as an explicit fallback.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, `@paddleocr/paddleocr-js`, ONNX Runtime Web, Web Worker, Cache API, Capacitor Filesystem.

**Spec:** `docs/superpowers/specs/2026-10-28-paddleocr-receipt-design.md`

## Global Constraints

- Use `@paddleocr/paddleocr-js` (ONNX Runtime Web); do not use `@paddlejs-models/ocr`.
- Use PP-OCRv5 mobile detection plus English/Latin recognition; do not load an angle classifier unless fixture testing proves it necessary.
- Self-host model and `.wasm` assets; do not use a third-party runtime CDN.
- Cache assets explicitly with Cache API on web and Capacitor Filesystem on Android.
- Run single-threaded ONNX Runtime Web; do not add COOP/COEP headers in this implementation.
- Apply EXIF orientation and downscale each image to a 1600px maximum long edge before inference.
- Run OCR in a Web Worker so the main thread remains responsive.
- Sort OCR fragments by center-y, group rows by y-overlap, and sort within rows by x.
- Parse PHP/₱/P/PHP amounts with period decimals and quantity/price lines below item names.
- Cloud OCR is an explicit user-invoked fallback only.
- Azure polling correction is a separate commit from the PaddleOCR feature.
- Verification requires 3–5 photographed Philippine receipt fixtures with expected parse output.
- Receipt fixture coverage is user-supplied; the implementer must not invent or photograph receipts.

## Review Focus

- A rotated EXIF camera image must be visually normalized before OCR rather than parsed sideways.
- A high-resolution phone photo must be reduced before worker inference to avoid Android memory pressure.
- OCR fragments arriving out of order must produce the same receipt rows as visually ordered text.
- `₱`, `P`, and `PHP` prices plus a quantity/price continuation row must parse correctly.
- Closing or cancelling while the worker is running must terminate/ignore the result and must not save data.

---

### Task 1: Add the PaddleOCR runtime boundary and preprocessing helpers

**Files:**
- Create: `src/features/receipt/receiptOcr.ts`
- Create: `src/features/receipt/receiptOcr.test.ts`
- Create: `src/features/receipt/imagePreprocess.ts`
- Create: `src/features/receipt/imagePreprocess.test.ts`
- Modify: `package.json`
- Modify: `vite.config.ts` if required by the package's worker/asset bundling

**Interfaces:**
- Produces `ReceiptOcrFragment`, `ReceiptOcrProgress`, and `runReceiptOcr(file, options): Promise<ReceiptOcrResult>`.
- `ReceiptOcrResult` contains normalized fragments, raw text, and an explicit `engine: 'paddleocr'` marker.
- `imagePreprocess` exposes a browser-testable `preprocessReceiptImage(file, maxLongEdge = 1600): Promise<Blob>` contract.

- [ ] **Step 1: Write failing tests** for package/runtime configuration, EXIF orientation handling, max-long-edge downscaling, and rejection of unsupported/empty images.
- [ ] **Step 2: Run the focused tests and verify they fail** because the adapter/helpers do not exist.
- [ ] **Step 3: Add `@paddleocr/paddleocr-js` and implement the preprocessing contract.** Apply EXIF orientation before drawing to a canvas, preserve a JPEG/PNG-compatible output, and keep inference single-threaded. Run these tests in Vitest browser mode or provide a deliberate canvas stub so jsdom does not become an accidental test dependency.
- [ ] **Step 4: Run focused tests and verify they pass.**
- [ ] **Step 5: Verify the official package can be bundled in the current Vite graph.** If the package cannot install or bundle cleanly, record a ruling in the ledger before changing the selected approach.
- [ ] **Step 6: Commit:** `feat: add browser paddleocr boundary and image preprocessing`

---

### Task 2: Implement the Web Worker and explicit model/runtime asset caching

**Files:**
- Create: `src/features/receipt/receiptOcr.worker.ts`
- Create: `src/features/receipt/receiptOcr.worker.test.ts`
- Create: `src/features/receipt/assetCache.ts`
- Create: `src/features/receipt/assetCache.test.ts`
- Create/Import: `public/models/ppocrv5-mobile/` and `public/models/onnxruntime/`
- Modify: `src/features/receipt/receiptOcr.ts`
- Modify: `capacitor.config.ts` if Filesystem configuration requires it

**Interfaces:**
- Worker receives `{ type: 'init'; assets: { det: ArrayBuffer; rec: ArrayBuffer; wasm: ArrayBuffer[] } }` before any run, then receives `{ type: 'run'; requestId; image }` and returns progress, success, or failure messages. The worker never fetches assets or calls Capacitor APIs.
- `assetCache.getOrFetchAsset(url, cacheName)` fetches each self-hosted asset on the main thread, uses Cache API on web and a Capacitor Filesystem-backed path on Android, and returns bytes. Those bytes are transferred to the worker with `postMessage` transfer lists.
- The adapter wraps cached model/WASM bytes in object URLs and passes those URLs to `PaddleOCR.create`; the library never receives its default third-party URLs.
- Cancellation uses request-id invalidation while keeping the initialized model warm; `terminate()` is reserved for component unmount.

- [ ] **Step 1: Write failing tests** for cache hit/miss behavior, worker message normalization, progress events, failure messages, and stale-result suppression.
- [ ] **Step 2: Run focused tests and verify they fail.**
- [ ] **Step 3: Download the official PP-OCRv5 mobile detection and English recognition ONNX archives using the package's “Obtaining ONNX models” instructions. Place the extracted model files under `public/models/ppocrv5-mobile/`. Copy the `onnxruntime-web` `.wasm` files from `node_modules` into `public/models/onnxruntime/`, and document the model/runtime Apache-2.0 license in `src/features/receipt/fixtures/README.md`.
- [ ] **Step 4: Implement the main-thread asset cache and worker initialization.** Load self-hosted bytes through the cache, create object URLs, pass the det/rec/WASM bytes to the worker with transfer lists, keep the runtime single-threaded, transfer image data without blocking the main thread, and expose request-id cancellation while keeping the model warm.
- [ ] **Step 5: Verify `vite build` copies the model and WASM assets into the production output and contains no third-party CDN model URLs.**
- [ ] **Step 6: Run focused tests and verify they pass.**
- [ ] **Step 7: Commit:** `feat: run receipt paddleocr in a cached web worker`

---

### Task 3: Build deterministic Philippine receipt ordering and parsing

**Files:**
- Create: `src/features/receipt/receiptParser.ts`
- Create: `src/features/receipt/receiptParser.test.ts`
- Create: `src/features/receipt/fixtures/README.md`
- Add: `src/features/receipt/fixtures/<receipt-id>.jpg` photographed receipt images supplied by the user
- Add: `src/features/receipt/fixtures/<receipt-id>.fragments.json` captured adapter output for each supplied photo
- Add: `src/features/receipt/fixtures/<receipt-id>.expected.json` parser output for each supplied photo

**Interfaces:**
- `orderReceiptFragments(fragments): ReceiptRow[]` performs center-y sorting, y-overlap grouping, and x ordering.
- `parseReceiptRows(rows): ReceiptDraft` returns merchant/date/total candidates and editable item candidates.
- Parser has no browser, OCR-runtime, or React dependency.

- [ ] **Step 1: Write failing tests** for out-of-order fragments, PHP/₱/P/PHP currency forms, decimal prices, item-name followed by quantity/price row, totals, and the committed `.fragments.json` → `.expected.json` parser cases.
- [ ] **Step 2: Run focused tests and verify they fail.**
- [ ] **Step 3: Implement ordering and parsing with conservative confidence rules.** Unrecognized lines remain in raw text and are not silently converted into saved items.
- [ ] **Step 4: Run focused tests and verify they pass.**
- [ ] **Step 5: Add the user-provided 3–5 photographed receipt fixture triplets.** The user must supply the photos; the implementer records each browser adapter output as `.fragments.json`, creates/adjusts `.expected.json` after review, and redacts personal information before committing.
- [ ] **Step 6: Commit:** `feat: parse Philippine receipt OCR output`

---

### Task 4: Replace the mock scanner with the React review workflow

**Files:**
- Create: `src/features/receipt/ReceiptScanner.tsx`
- Create: `src/features/receipt/ReceiptScanner.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/index.css`
- Remove/replace: legacy mock receipt scanner code in `index.html` only if it is still reachable

**Interfaces:**
- `ReceiptScanner` accepts `onSave(draft): Promise<void>` and `onCancel(): void`.
- UI states are `idle`, `preparing`, `reading`, `review`, `empty`, and `error`.
- Save is disabled until review data is valid and is only called from explicit confirmation.

- [ ] **Step 1: Write failing component tests** for file selection, progress text, successful review, editable fields, empty OCR, failure, cancel, and confirm-before-save behavior.
- [ ] **Step 2: Run component tests and verify they fail.**
- [ ] **Step 3: Implement the scanner using the existing Orbital Kitchen visual language.** Keep raw OCR text available, expose “Try cloud OCR” only when configured, and prevent stale worker results from saving after cancellation.
- [ ] **Step 4: Run component tests and verify they pass.**
- [ ] **Step 5: Run the app in the browser and manually exercise the scanner from the Import orbit.**
- [ ] **Step 6: Commit:** `feat: add receipt scanner review flow`

---

### Task 5: Fix Azure fallback polling independently

**Files:**
- Create: `api/receipt-read.test.ts`
- Modify: `api/receipt-read.js:56-74`

**Interfaces:**
- Polling must preserve `notStarted` and `running` as pending, return only on `succeeded`, throw on `failed`, and timeout after the configured attempts.

- [ ] **Step 1: Write failing tests** that reproduce the current `running`-reported-as-succeeded bug and cover failed/timeout responses.
- [ ] **Step 2: Run the tests and verify they fail.**
- [ ] **Step 3: Fix only the polling status expression and related testability boundary.** Do not mix PaddleOCR feature changes into this commit.
- [ ] **Step 4: Run the API tests and verify they pass.**
- [ ] **Step 5: Commit:** `fix: keep azure receipt polling pending while running`

---

### Task 6: Full verification and browser/mobile review

**Files:**
- Modify: `docs/superpowers/specs/2026-10-28-paddleocr-receipt-design.md` only for measured implementation notes
- Modify: `docs/superpowers/plans/2026-10-28-paddleocr-receipt-import.md` only for execution rulings

- [ ] **Step 1: Run `npm test`.** Expected: all tests pass, including the 3–5 photographed receipt fixtures.
- [ ] **Step 2: Run `npm run typecheck`.** Expected: exit code 0.
- [ ] **Step 3: Run `npm run build`.** Expected: production build succeeds, copies self-hosted model/runtime assets, and contains no third-party CDN model URLs.
- [ ] **Step 4: Verify in the built app at desktop and narrow mobile viewport.** Check model loading, worker progress, OCR result, edit, cancel, confirm, and explicit Azure fallback visibility.
- [ ] **Step 5: Record any intentional deviations and run a final code review before claiming completion.**

