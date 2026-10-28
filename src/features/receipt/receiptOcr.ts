import { preprocessReceiptImage } from './imagePreprocess';
import { createAssetCache } from './assetCache';

export interface ReceiptOcrFragment {
  text: string;
  confidence: number;
  poly: number[][];
}

export interface ReceiptOcrResult {
  engine: 'paddleocr';
  rawText: string;
  fragments: ReceiptOcrFragment[];
}

interface PaddleItem { text?: string; score?: number; poly?: number[][]; }
interface PaddleResult { items?: PaddleItem[]; }
type Predict = (image: Blob) => Promise<PaddleResult>;

function absoluteAssetUrl(path: string): string {
  if (/^(https?:|blob:|data:)/.test(path) || typeof location === 'undefined') return path;
  return new URL(path, location.origin).href;
}

export class ReceiptOcrError extends Error {
  constructor(public readonly code: 'cancelled' | 'failed', message: string) {
    super(message);
    this.name = 'ReceiptOcrError';
  }
}

export function normalizePaddleResult(result: PaddleResult): ReceiptOcrResult {
  const fragments = (result.items ?? [])
    .filter((item): item is Required<Pick<PaddleItem, 'text'>> & PaddleItem => Boolean(item.text?.trim()))
    .map((item) => ({
      text: item.text!.trim(),
      confidence: typeof item.score === 'number' ? item.score : 0,
      poly: item.poly ?? [],
    }));
  return { engine: 'paddleocr', rawText: fragments.map((fragment) => fragment.text).join('\n'), fragments };
}

export interface ReceiptOcrController {
  run(file: Blob, onProgress?: (phase: 'initializing' | 'reading') => void): Promise<ReceiptOcrResult>;
  cancel(): void;
  dispose(): void;
  isDisposed(): boolean;
}

export function createReceiptOcrController(options: { predict: Predict; preprocess?: (file: Blob) => Promise<Blob> }): ReceiptOcrController {
  let requestId = 0;
  let disposed = false;
  const preprocess = options.preprocess ?? preprocessReceiptImage;
  return {
    async run(file, _onProgress) {
      if (disposed) throw new ReceiptOcrError('failed', 'OCR is no longer available.');
      const currentRequest = ++requestId;
      try {
        const result = normalizePaddleResult(await options.predict(await preprocess(file)));
        if (currentRequest !== requestId || disposed) throw new ReceiptOcrError('cancelled', 'OCR was cancelled.');
        return result;
      } catch (error) {
        if (error instanceof ReceiptOcrError) throw error;
        throw new ReceiptOcrError('failed', error instanceof Error ? error.message : 'Receipt OCR failed.');
      }
    },
    cancel() { requestId += 1; },
    dispose() { disposed = true; requestId += 1; },
    isDisposed() { return disposed; },
  };
}

export async function createPaddlePredictor(modelBaseUrl = '/models/ppocrv5-mobile'): Promise<Predict> {
  const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
  const ocr = await PaddleOCR.create({
    textDetectionModelName: 'PP-OCRv5_mobile_det',
    textDetectionModelAsset: { url: `${modelBaseUrl}/PP-OCRv5_mobile_det_onnx_infer.tar` },
    textRecognitionModelName: 'PP-OCRv5_mobile_rec',
    textRecognitionModelAsset: { url: `${modelBaseUrl}/PP-OCRv5_mobile_rec_onnx_infer.tar` },
    ortOptions: { backend: 'wasm', wasmPaths: '/models/onnxruntime/', numThreads: 1, simd: true },
  });
  return async (image) => {
    const [result] = await ocr.predict(image);
    return { items: result?.items ?? [] };
  };
}

export function createReceiptOcrWorkerController(options: {
  assetCache?: ReturnType<typeof createAssetCache>;
  modelBaseUrl?: string;
  wasmBaseUrl?: string;
} = {}): ReceiptOcrController {
  const cache = options.assetCache ?? createAssetCache();
  const modelBaseUrl = options.modelBaseUrl ?? '/models/ppocrv5-mobile';
  const wasmBaseUrl = options.wasmBaseUrl ?? '/models/onnxruntime';
  let initialized: Promise<{ predict(image: Blob): Promise<Array<{ items?: PaddleItem[] }>>; dispose?: () => Promise<void> }> | null = null;
  let disposed = false;
  let requestId = 0;
  let workerUnavailable = false;
  async function initialize(onProgress?: (phase: 'initializing' | 'reading') => void) {
    if (initialized) return initialized;
    initialized = (async () => {
      onProgress?.('initializing');
      await Promise.all([
        cache.getOrFetchAsset(`${modelBaseUrl}/PP-OCRv5_mobile_det_onnx_infer.tar`, 'receipt-models-v2'),
        cache.getOrFetchAsset(`${modelBaseUrl}/PP-OCRv5_mobile_rec_onnx_infer.tar`, 'receipt-models-v2'),
      ]);
      const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
      const options = {
        textDetectionModelName: 'PP-OCRv5_mobile_det',
        textDetectionModelAsset: { url: `${modelBaseUrl}/PP-OCRv5_mobile_det_onnx_infer.tar` },
        textRecognitionModelName: 'PP-OCRv5_mobile_rec',
        textRecognitionModelAsset: { url: `${modelBaseUrl}/PP-OCRv5_mobile_rec_onnx_infer.tar` },
        ortOptions: {
          backend: 'wasm',
          wasmPaths: {
            mjs: absoluteAssetUrl(`${wasmBaseUrl}/ort-wasm-simd-threaded.mjs`),
            wasm: absoluteAssetUrl(`${wasmBaseUrl}/ort-wasm-simd-threaded.wasm`),
          } as unknown as string,
          numThreads: 1,
          simd: true,
        },
      };
      if (!workerUnavailable) {
        try {
          return await PaddleOCR.create({ ...options, worker: true }) as unknown as { predict(image: Blob): Promise<Array<{ items?: PaddleItem[] }>>; dispose?: () => Promise<void> };
        } catch {
          workerUnavailable = true;
        }
      }
      return await PaddleOCR.create({ ...options, worker: false }) as unknown as { predict(image: Blob): Promise<Array<{ items?: PaddleItem[] }>>; dispose?: () => Promise<void> };
    })();
    try {
      return await initialized;
    } catch (error) {
      initialized = null;
      throw error;
    }
  }

  return {
    async run(file, onProgress) {
      if (disposed) throw new ReceiptOcrError('failed', 'OCR is no longer available.');
      const engine = await initialize(onProgress);
      const image = await preprocessReceiptImage(file);
      const currentRequest = ++requestId;
      onProgress?.('reading');
      const [result] = await engine.predict(image);
      if (currentRequest !== requestId || disposed) throw new ReceiptOcrError('cancelled', 'OCR was cancelled.');
      return normalizePaddleResult(result ?? {});
    },
    cancel() {
      requestId += 1;
    },
    dispose() {
      disposed = true;
      requestId += 1;
      void initialized?.then((engine) => engine.dispose?.());
    },
    isDisposed() { return disposed; },
  };
}
