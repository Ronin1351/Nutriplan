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
      merchant: 'STORE', total: 85.5, purchaseDate: null, receiptNumber: null,
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

    expect(result.items).toEqual([{ name: 'GATORADE TROP FRT500', quantity: 2, unitPrice: 44, totalPrice: 88, confidence: 0.95 }]);
    expect(result.total).toBe(2593.85);
  });

  it('parses compact weighted receipt details with quantity, unit price, and total', () => {
    const result = parseReceiptRows([
      { text: '*MAG CHKN THIGHS 2.192226.00 495.40', fragments: [], confidence: 0.94 },
    ]);

    expect(result.items).toEqual([{ name: 'MAG CHKN THIGHS', quantity: 2.192, unitPrice: 226, totalPrice: 495.4, confidence: 0.94 }]);
  });

  it('preserves unit prices and validates their printed total', () => {
    const result = parseReceiptRows([
      { text: '*ONION LEAVES IS 0.086@495 42.55', fragments: [], confidence: 0.94 },
      { text: 'RED LADY PAPAYA G', fragments: [], confidence: 0.94 },
      { text: '0.636@70.00 44.50', fragments: [], confidence: 0.94 },
    ]);

    expect(result.items[0]).toMatchObject({ name: 'ONION LEAVES IS', quantity: 0.086, unitPrice: 495, totalPrice: 42.55 });
    expect(result.items[1]).toMatchObject({ name: 'RED LADY PAPAYA G', quantity: 0.636, unitPrice: 70, totalPrice: 44.5 });
    expect(isReceiptItemPriceConsistent(result.items[0])).toBe(true);
    expect(isReceiptItemPriceConsistent(result.items[1])).toBe(true);
    expect(isReceiptItemPriceConsistent({ ...result.items[1], totalPrice: 40 })).toBe(false);
  });
});

describe('receipt parser on a tilted Iloilo Fresh Market receipt', () => {
  // Line pitch 24px, glyph height 16px, tilt: y drops 25px across the 600px width (~2.4°). Totals sit at x≈520, names at x≈40.
  const slope = 25 / 600;
  const frag = (text: string, x: number, line: number, width: number): ReceiptFragment => {
    const y = 100 + line * 24 + x * slope;
    return { text, confidence: 0.95, poly: [[x, y], [x + width, y + width * slope], [x + width, y + width * slope + 16], [x, y + 16]] };
  };
  const fragments = [
    frag('*MAG CHKN THIGHS', 40, 0, 200),
    frag('2.192 @ 226.00', 60, 1, 150), frag('495.40', 520, 1, 70),
    frag('*RC DRESSED CHICKEN', 40, 2, 230),
    frag('2.328 @ 177.00', 60, 3, 150), frag('412.05', 520, 3, 70),
    frag('GATORADE BLU BOLT500', 40, 4, 240),
    frag('3.000 @ 44.00', 60, 5, 140), frag('132.00', 520, 5, 70),
    frag('*CALAMANSI EG', 40, 6, 160), frag('37.50', 530, 6, 60),
    frag('TOTAL', 40, 7, 70), frag('2,593.85', 500, 7, 90),
  ];

  it('keeps each right-aligned total on its own line despite the tilt', () => {
    const rows = orderReceiptFragments(fragments).map((row) => row.text);
    expect(rows).toEqual(['*MAG CHKN THIGHS', '2.192 @ 226.00 495.40', '*RC DRESSED CHICKEN', '2.328 @ 177.00 412.05', 'GATORADE BLU BOLT500', '3.000 @ 44.00 132.00', '*CALAMANSI EG 37.50', 'TOTAL 2,593.85']);
  });

  it('pairs every detail line with the name above it and strips the marker asterisk', () => {
    const draft = parseReceiptRows(orderReceiptFragments(fragments));
    expect(draft.items.map((item) => [item.name, item.quantity, item.unitPrice, item.totalPrice])).toEqual([
      ['MAG CHKN THIGHS', 2.192, 226, 495.4],
      ['RC DRESSED CHICKEN', 2.328, 177, 412.05],
      ['GATORADE BLU BOLT500', 3, 44, 132],
      ['CALAMANSI EG', 1, undefined, 37.5],
    ]);
    expect(draft.total).toBe(2593.85);
  });
});
