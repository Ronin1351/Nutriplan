import { describe, expect, it } from 'vitest';
import { buildHistorySeries, summarizePrices } from './historySelectors';
import type { PriceHistoryPoint } from './types';

const point = (id: string, price: number, date: string, currency = 'PHP', kind: 'purchase' | 'quote' = 'purchase', unit = 'each'): PriceHistoryPoint => ({ observationId: id, eventId: id, itemId: 'item', occurredOn: date, capturedAt: `${date}T00:00:00Z`, currency, kind, dateEstimated: false, paidMinor: price, quantity: '1', unit, packageQuantity: null, packageUnit: null, merchantName: null });

describe('history selectors', () => {
  it('groups by currency and compatible basis without inventing a trend', () => {
    expect(buildHistorySeries([point('1', 100, '2026-01-01'), point('2', 110, '2026-02-01'), point('3', 200, '2026-02-01', 'USD')])).toHaveLength(2);
    expect(summarizePrices([point('1', 100, '2026-01-01')])?.changePercent).toBeNull();
  });
  it('does not divide by a zero previous price', () => {
    expect(summarizePrices([point('1', 0, '2026-01-01'), point('2', 100, '2026-02-01')])?.changePercent).toBeNull();
  });
  it('keeps purchase and quote points filterable', () => {
    expect(buildHistorySeries([point('1', 100, '2026-01-01', 'PHP', 'purchase'), point('2', 90, '2026-02-01', 'PHP', 'quote')], { source: 'quote' })[0].points[0].kind).toBe('quote');
  });
});
