import { describe, expect, it, vi } from 'vitest';
import { normalizePaddleResult, createReceiptOcrController } from './receiptOcr';

describe('receipt OCR adapter', () => {
  it('normalizes PaddleOCR output into fragments with raw text', () => {
    const result = normalizePaddleResult({
      items: [
        { text: 'MILK', score: 0.98, poly: [[10, 10], [110, 10], [110, 30], [10, 30]] },
        { text: '₱120.00', score: 0.94, poly: [[300, 10], [390, 10], [390, 30], [300, 30]] },
      ],
    });

    expect(result.engine).toBe('paddleocr');
    expect(result.rawText).toBe('MILK\n₱120.00');
    expect(result.fragments[0]).toMatchObject({ text: 'MILK', confidence: 0.98 });
  });

  it('ignores a stale result after cancellation while keeping the controller usable', async () => {
    const predict = vi.fn(() => new Promise<{ items: never[] }>((resolve) => setTimeout(() => resolve({ items: [] }), 5)));
    const controller = createReceiptOcrController({ predict, preprocess: async (file) => file });

    const pending = controller.run(new Blob(['receipt'], { type: 'image/jpeg' }));
    controller.cancel();

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    expect(controller.isDisposed()).toBe(false);
  });
});
