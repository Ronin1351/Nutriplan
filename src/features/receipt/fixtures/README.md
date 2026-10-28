# Receipt OCR fixtures

This directory is reserved for 3–5 user-supplied, photographed Philippine receipts. Each receipt must be redacted before committing and must have three files:

- `<id>.jpg` — the source camera photo, used for manual browser verification only.
- `<id>.fragments.json` — the captured normalized PaddleOCR adapter output.
- `<id>.expected.json` — the reviewed parser output used by Vitest.

The OCR model archives are the official PP-OCRv5 mobile detection and recognition ONNX exports distributed by PaddlePaddle and self-hosted under `public/models/ppocrv5-mobile/`. The ONNX Runtime Web assets under `public/models/onnxruntime/` are copied from the `onnxruntime-web` npm package. Both are Apache-2.0 licensed; retain the upstream notices if these assets are redistributed.
