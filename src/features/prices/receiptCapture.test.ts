import { describe, expect, it } from 'vitest';
import { receiptDraftToCapture } from './receiptCapture';

describe('receipt capture conversion', () => {
  it('uses the reviewed date or visibly estimates the Manila capture date', () => {
    const draft = { merchant: 'Shop', total: 100, purchaseDate: '2026-10-20', receiptNumber: null, items: [{ name: 'Rice', quantity: 1, unitPrice: 100, totalPrice: 100, confidence: 1 }], rawRows: [] };
    expect(receiptDraftToCapture(draft, 'PHP')).toMatchObject({ occurredOn: '2026-10-20', dateEstimated: false, currency: 'PHP' });
    expect(receiptDraftToCapture({ ...draft, purchaseDate: null }, 'PHP').dateEstimated).toBe(true);
  });
  it('keeps reviewed line ordinals and converts major units to minor units', () => {
    const capture = receiptDraftToCapture({ merchant: '', total: null, purchaseDate: null, receiptNumber: null, items: [{ name: 'Eggs', quantity: 2, totalPrice: 100, confidence: 1 }, { name: 'Eggs', quantity: 1, totalPrice: 50, confidence: 1 }], rawRows: [] }, 'PHP');
    expect(capture.lines.map((line) => [line.ordinal, line.paidMinor])).toEqual([[0, 10000], [1, 5000]]);
  });
});
