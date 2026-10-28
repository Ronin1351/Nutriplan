import { describe, expect, it } from 'vitest';
import { captureFingerprint } from './captureFingerprint';
import type { PriceCapture } from './types';

const capture = (imageOnly: string): PriceCapture => ({ operationId: imageOnly, kind: 'purchase', source: 'receipt', occurredOn: '2026-10-20', dateEstimated: false, capturedAt: '2026-10-20T00:00:00Z', currency: 'PHP', merchantName: 'Shop', receiptNumber: null, lines: [{ lineId: 'line-1', ordinal: 0, itemName: 'Rice', quantity: '1', unit: 'kg', paidMinor: 10000, packageQuantity: null, packageUnit: null }] });

describe('capture fingerprint', () => {
  it('does not include image or operation identifiers', async () => {
    expect(await captureFingerprint(capture('image-a'))).toBe(await captureFingerprint(capture('image-b')));
  });
  it('retains repeated line ordinals', async () => {
    const one = capture('a');
    const two = { ...capture('b'), lines: [...one.lines, { ...one.lines[0], lineId: 'line-2', ordinal: 1 }] };
    expect(await captureFingerprint(one)).not.toBe(await captureFingerprint(two));
  });
});
