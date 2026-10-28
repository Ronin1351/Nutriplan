# PaddleOCR Receipt Import Design

## Intent

Replace Nutriplan's mock receipt scanner with a real, free, browser-local OCR workflow for the React/Capacitor app. A user should be able to capture or select a receipt, extract readable text without sending the image to a paid cloud service, review the detected items, and save only corrected data.

## Goals

- Run PaddleOCR locally in the browser using `@paddleocr/paddleocr-js` (ONNX Runtime Web) and lightweight mobile models. Do not use the obsolete `@paddlejs-models/ocr` package.
- Preserve the existing React/Vite and Capacitor architecture so the same workflow can be used on desktop and mobile.
- Parse common receipt lines into product name, quantity, unit price, and total price where confidence is sufficient.
- Show raw OCR text and an editable review state before anything is saved.
- Handle loading, unsupported images, OCR failures, empty results, and cancellation clearly.
- Keep the existing Azure endpoint as a definite, user-invoked fallback only; it must not be required for the primary workflow and must never run silently after local OCR fails.

## Non-goals

- No paid OCR dependency or mandatory hosted OCR account.
- No promise that every receipt layout is parsed perfectly; the review screen remains authoritative.
- No multi-device synchronization, ratings, admin approval, bookmarklets, or receipt-sharing workflow.
- No large GPU-only model such as Unlimited-OCR in the browser or Vercel function.

## Approaches considered

1. Browser PaddleOCR.js — selected. It fits React/Capacitor, keeps images local, works without a server, and has a practical mobile model. The tradeoff is that first-run model download and low-end-device inference may be slower than a cloud API.
2. Python PaddleOCR sidecar — rejected for the primary path. It can expose larger models and higher server-side accuracy, but requires a separately running Python service and cannot be deployed as a normal Vercel function.
3. Hosted OCR API — rejected for the primary path. It would simplify inference but conflicts with the requirement for a free personal app and adds external data handling.

## Architecture

The receipt feature will be split into four focused layers:

1. `receiptOcr` adapter: lazy-loads the browser OCR runtime and model only when scanning starts, applies EXIF orientation, downscales camera captures to a maximum 1600px long edge, manages explicit model/WASM asset caching, and runs inference in a Web Worker so the main thread remains responsive. It returns normalized text fragments with confidence and bounding-box metadata.
2. `receiptParser`: pure TypeScript logic that first sorts fragments by bounding-box center-y, groups them into rows by y-overlap, and sorts each row by x. It then turns ordered rows into editable receipt fields and item candidates. It assumes PHP-style amounts with period decimals and recognizes `₱`, `P`, and `PHP` prefixes. It supports the common Philippine receipt pattern where quantity and price appear on the line below the product name. It will be deterministic and tested independently from PaddleOCR.
3. `ReceiptScanner` React feature: owns file/camera input, OCR progress/error state, raw text preview, parsed item editing, and confirm/cancel actions.
4. Existing persistence/import boundary: accepts confirmed items through the app's current local-first data flow; no persistence occurs before confirmation.

The OCR adapter will be dynamically imported to avoid increasing the initial Orbital Kitchen bundle. It will use PP-OCRv5 mobile detection plus English/Latin recognition. No angle classifier will be loaded unless photographed receipts prove that rotation errors require it.

Model and runtime assets will be self-hosted by Nutriplan, under `public/models/` for Vercel/static builds or the equivalent Supabase Storage bucket. They will not be pulled from a third-party CDN at runtime. The ONNX Runtime Web `.wasm` files follow the same self-hosting rule. The first-use download will be cached explicitly with the Cache API on web and Capacitor Filesystem on Android; Android WebView HTTP caching is not treated as durable storage.

The first implementation will run ONNX Runtime Web single-threaded. This avoids requiring COOP/COEP headers and keeps the Vercel deployment compatible. A later performance pass may opt into worker threads after measuring the impact and adding the required `vercel.json` headers.

## Receipt behavior

- Accept JPEG, PNG, and camera-captured image files.
- Apply EXIF orientation before inference and downscale the image to a maximum 1600px long edge to control Android memory use and latency.
- Reject empty, unsupported, or clearly oversized files with a user-readable error.
- Show an explicit “Preparing OCR”/“Reading receipt” state rather than a frozen screen.
- Present parsed items with editable name, quantity, and price fields.
- Preserve raw OCR text for troubleshooting and manual recovery.
- Save only after the user confirms.

## Fallback and compatibility

If browser OCR initialization or inference fails, the UI will show an explicit “Try cloud OCR” action when Azure credentials/configuration are available. It will not invoke Azure automatically. The endpoint will only treat the documented `notStarted`, `running`, `failed`, and `succeeded` statuses correctly and will time out safely.

The Azure polling correction is a separate commit from the PaddleOCR feature so fallback maintenance can be reviewed independently.

## Verification

- Unit tests for OCR line normalization and common receipt parsing patterns.
- Component tests for loading, success, empty-result, failure, cancel, edit, and confirm states.
- A committed fixture set of 3–5 photographed Philippine receipts with expected parse output, covering angled/rotated capture, PHP amount prefixes, and item-name/quantity-price line separation.
- Full test suite, TypeScript check, and production build.
- Browser verification on desktop and a narrow mobile viewport using the committed photographed receipt fixture set.

## Open implementation decisions

- Use the official browser package/API that is compatible with the repository's current dependency graph; if its browser package cannot be installed or bundled cleanly, stop and record that as a ruling before switching to a local service.
- Preserve the existing visual Orbital Kitchen design and add the scanner as a functional Import destination rather than introducing a separate visual system.
