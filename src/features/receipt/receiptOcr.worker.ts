import { normalizePaddleResult, type ReceiptOcrResult } from './receiptOcr';

export type ReceiptWorkerMessage =
  | { type: 'init'; assets: { det: ArrayBuffer; rec: ArrayBuffer; wasm: ArrayBuffer[] } }
  | { type: 'run'; requestId: string; image: Blob }
  | { type: 'cancel'; requestId: string };

export type ReceiptWorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; phase: 'initializing' | 'reading' }
  | { type: 'success'; requestId: string; result: ReceiptOcrResult }
  | { type: 'failure'; requestId?: string; message: string };

export function isCurrentRequest(currentRequestId: string, expectedRequestId: string): boolean {
  return currentRequestId === expectedRequestId;
}

export function normalizeWorkerMessage(message: ReceiptWorkerResponse): ReceiptWorkerResponse {
  return message;
}

export function createWasmPathMap(mjsUrl: string, wasmUrl: string): Record<string, string> {
  return { mjs: mjsUrl, wasm: wasmUrl };
}

function bytesToJavaScriptDataUrl(bytes: ArrayBuffer): string {
  const values = new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < values.length; offset += chunkSize) {
    binary += String.fromCharCode(...values.subarray(offset, offset + chunkSize));
  }
  return `data:text/javascript;base64,${btoa(binary)}`;
}

interface PaddleLike { predict(image: Blob): Promise<Array<{ items?: Array<{ text?: string; score?: number; poly?: number[][] }> }>>; }

let ocr: PaddleLike | null = null;
let disposedRequests = new Set<string>();

async function initialize(assets: { det: ArrayBuffer; rec: ArrayBuffer; wasm: ArrayBuffer[] }): Promise<void> {
  const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
  const detUrl = URL.createObjectURL(new Blob([assets.det], { type: 'application/octet-stream' }));
  const recUrl = URL.createObjectURL(new Blob([assets.rec], { type: 'application/octet-stream' }));
  const wasmPaths = createWasmPathMap(
    bytesToJavaScriptDataUrl(assets.wasm[0]),
    URL.createObjectURL(new Blob([assets.wasm[1]])),
  );
  ocr = await PaddleOCR.create({
    textDetectionModelName: 'PP-OCRv5_mobile_det',
    textDetectionModelAsset: { url: detUrl },
    textRecognitionModelName: 'PP-OCRv5_mobile_rec',
    textRecognitionModelAsset: { url: recUrl },
    ortOptions: { backend: 'wasm', wasmPaths: wasmPaths as unknown as string, numThreads: 1, simd: true },
  }) as unknown as PaddleLike;
}

if (typeof self !== 'undefined' && 'postMessage' in self) {
  const workerScope = self as unknown as { postMessage: (message: ReceiptWorkerResponse) => void; onmessage: ((event: MessageEvent<ReceiptWorkerMessage>) => void) | null };
  workerScope.onmessage = async (event) => {
    try {
      if (event.data.type === 'init') {
        workerScope.postMessage({ type: 'progress', phase: 'initializing' });
        await initialize(event.data.assets);
        workerScope.postMessage({ type: 'ready' });
        return;
      }
      if (event.data.type === 'cancel') {
        disposedRequests.add(event.data.requestId);
        return;
      }
      if (!ocr) throw new Error('OCR is not initialized.');
      if (disposedRequests.has(event.data.requestId)) return;
      workerScope.postMessage({ type: 'progress', phase: 'reading' });
      const [result] = await ocr.predict(event.data.image);
      if (disposedRequests.has(event.data.requestId)) return;
      workerScope.postMessage({ type: 'success', requestId: event.data.requestId, result: normalizePaddleResult(result ?? {}) });
    } catch (error) {
      workerScope.postMessage({ type: 'failure', message: error instanceof Error ? error.message : 'Receipt OCR failed.' });
    }
  };
}
