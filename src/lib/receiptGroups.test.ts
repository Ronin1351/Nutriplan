import { describe, expect, it } from 'vitest';
import { groupReceiptsByYear } from './receiptGroups';
import type { ReceiptSummary } from '../features/pantry/pantryInventoryService';

const receipt = (id: string, occurredOn: string, totalMinor: number): ReceiptSummary => ({ id, merchantName: null, occurredOn, dateEstimated: false, currency: 'PHP', lineCount: 1, totalMinor, revision: 0 });

describe('groupReceiptsByYear', () => {
  it('groups by occurredOn year, newest year first, receipts newest first, with totals', () => {
    const groups = groupReceiptsByYear([receipt('a', '2025-02-01', 100), receipt('b', '2026-01-10', 250), receipt('c', '2026-03-05', 50)]);
    expect(groups.map((group) => group.year)).toEqual(['2026', '2025']);
    expect(groups[0].receipts.map((entry) => entry.id)).toEqual(['c', 'b']);
    expect(groups[0].totalMinor).toBe(300);
    expect(groups[1].totalMinor).toBe(100);
  });
  it('uses occurredOn, never the capture timestamp', () => {
    const late = { ...receipt('a', '2025-12-31', 10), capturedAt: '2026-01-01T00:00:00.000Z' } as ReceiptSummary;
    expect(groupReceiptsByYear([late])[0].year).toBe('2025');
  });
  it('returns an empty array for no receipts', () => { expect(groupReceiptsByYear([])).toEqual([]); });
});
