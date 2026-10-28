import { describe, expect, it } from 'vitest';
import { isReceiptItemPriceConsistent, orderReceiptFragments, parseReceiptRows, type ReceiptFragment } from './receiptParser';

const fragment = (text: string, x: number, y: number, width = 80): ReceiptFragment => ({
  text, confidence: 0.96, poly: [[x, y], [x + width, y], [x + width, y + 20], [x, y + 20]],
});

describe('receipt parser', () => {
  it('orders OCR fragments into visual rows and x order', () => {
    const rows = orderReceiptFragments([
      fragment('₱120.00', 260, 30), fragment('MILK', 20, 30), fragment('STORE', 20, 0),
    ]);
    expect(rows.map((row) => row.text)).toEqual(['STORE', 'MILK ₱120.00']);
  });

  it('parses peso-prefixed item prices and a total', () => {
    const rows = orderReceiptFragments([
      fragment('STORE', 10, 0), fragment('RICE', 10, 30), fragment('P 85.50', 250, 30),
      fragment('TOTAL', 10, 90), fragment('₱85.50', 250, 90),
    ]);
    expect(parseReceiptRows(rows)).toMatchObject({
      merchant: 'STORE', total: 85.5,
      items: [{ name: 'RICE', quantity: 1, totalPrice: 85.5 }],
    });
  });

  it('associates a quantity and price continuation row with the item name above it', () => {
    const rows = orderReceiptFragments([
      fragment('EGGS', 10, 30),
      fragment('2 x 12.50', 10, 55),
      fragment('TOTAL', 10, 100), fragment('PHP 25.00', 250, 100),
    ]);
    expect(parseReceiptRows(rows).items).toEqual([{ name: 'EGGS', quantity: 2, unitPrice: 12.5, totalPrice: 25, confidence: 0.96 }]);
  });

  it('attaches at-sign continuation rows and ignores payment summaries', () => {
    const rows = [
      { text: '*GATORADE TROP FRT500 88.00', fragments: [], confidence: 1 },
      { text: '2.000@44.00', fragments: [], confidence: 0.95 },
      { text: 'NET TOTAL TOTAL 2,593.85 2,593.85', fragments: [], confidence: 1 },
      { text: 'E Wallet PAYMENT BREAKDOWN 2,593.85', fragments: [], confidence: 1 },
    ];
    const result = parseReceiptRows(rows);

    expect(result.items).toEqual([{ name: '*GATORADE TROP FRT500', quantity: 2, unitPrice: 44, totalPrice: 88, confidence: 0.95 }]);
    expect(result.total).toBe(2593.85);
  });

  it('parses compact weighted receipt details with quantity, unit price, and total', () => {
    const result = parseReceiptRows([
      { text: '*MAG CHKN THIGHS 2.192226.00 495.40', fragments: [], confidence: 0.94 },
    ]);

    expect(result.items).toEqual([{ name: '*MAG CHKN THIGHS', quantity: 2.192, unitPrice: 226, totalPrice: 495.4, confidence: 0.94 }]);
  });

  it('preserves unit prices and validates their printed total', () => {
    const result = parseReceiptRows([
      { text: '*ONION LEAVES IS 0.086@495 42.55', fragments: [], confidence: 0.94 },
      { text: 'RED LADY PAPAYA G', fragments: [], confidence: 0.94 },
      { text: '0.636@70.00 44.50', fragments: [], confidence: 0.94 },
    ]);

    expect(result.items[0]).toMatchObject({ name: '*ONION LEAVES IS', quantity: 0.086, unitPrice: 495, totalPrice: 42.55 });
    expect(result.items[1]).toMatchObject({ name: 'RED LADY PAPAYA G', quantity: 0.636, unitPrice: 70, totalPrice: 44.5 });
    expect(isReceiptItemPriceConsistent(result.items[0])).toBe(true);
    expect(isReceiptItemPriceConsistent(result.items[1])).toBe(true);
    expect(isReceiptItemPriceConsistent({ ...result.items[1], totalPrice: 40 })).toBe(false);
  });
});
