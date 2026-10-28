import { describe, expect, it } from 'vitest';
import { createWasmPathMap, isCurrentRequest, normalizeWorkerMessage } from './receiptOcr.worker';

describe('receipt OCR worker protocol', () => {
  it('accepts only the active request id', () => {
    expect(isCurrentRequest('request-2', 'request-2')).toBe(true);
    expect(isCurrentRequest('request-1', 'request-2')).toBe(false);
  });

  it('normalizes worker success messages', () => {
    expect(normalizeWorkerMessage({ type: 'success', requestId: 'r1', result: { engine: 'paddleocr', rawText: '', fragments: [] } })).toEqual({
      type: 'success', requestId: 'r1', result: { engine: 'paddleocr', rawText: '', fragments: [] },
    });
  });

  it('uses the ONNX Runtime wasm and mjs path keys', () => {
    expect(createWasmPathMap('blob:mjs', 'blob:wasm')).toEqual({ mjs: 'blob:mjs', wasm: 'blob:wasm' });
  });
});
