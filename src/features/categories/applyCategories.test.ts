import { describe, expect, it } from 'vitest';
import { applyCategories } from './applyCategories';
import type { ReceiptDraft } from '../receipt/receiptParser';

const draft: ReceiptDraft = {
  merchant: 'Market',
  total: 100,
  rawRows: ['*ONION 0.1@100 10.00', 'MYSTERY ITEM 90.00'],
  items: [
    { name: '*ONION', quantity: 0.1, unitPrice: 100, totalPrice: 10, confidence: 0.9 },
    { name: 'MYSTERY ITEM', quantity: 1, totalPrice: 90, confidence: 0.9 },
  ],
};

describe('apply receipt categories', () => {
  it('adds built-in, learned, and fallback categories without changing OCR values', () => {
    const result = applyCategories(draft, [{ phrase: 'mystery item', category: 'Snacks', updatedAt: 1 }]);

    expect(result.items.map(({ category }) => category)).toEqual(['Produce', 'Snacks']);
    expect(result.items.map(({ name, quantity, unitPrice, totalPrice }) => ({ name, quantity, unitPrice, totalPrice }))).toEqual(draft.items.map(({ name, quantity, unitPrice, totalPrice }) => ({ name, quantity, unitPrice, totalPrice })));
    expect(result.rawRows).toEqual(draft.rawRows);
  });

  it('uses Uncategorized when neither a learned nor built-in rule matches', () => {
    expect(applyCategories({ ...draft, items: [draft.items[1]] }, []).items[0].category).toBe('Uncategorized');
  });
});
