import { describe, expect, it } from 'vitest';
import { comparablePrice, selectLatest, toMinorUnits } from './priceMath';

describe('price math', () => {
  it('uses currency precision without converting display units', () => {
    expect(toMinorUnits('100.10', 'PHP')).toBe(10010);
    expect(toMinorUnits('100', 'JPY')).toBe(100);
    expect(() => toMinorUnits('100.50', 'JPY')).toThrow();
  });
  it('normalizes exact mass and volume prices', () => {
    expect(comparablePrice({ lineId: '1', ordinal: 0, itemName: 'Rice', quantity: '1', unit: 'kg', paidMinor: 20000 }, 'PHP')).toEqual({ minor: 20000, basis: 'kg', currency: 'PHP' });
    expect(comparablePrice({ lineId: '1', ordinal: 0, itemName: 'Rice', quantity: '1', unit: 'pack', paidMinor: 10000 }, 'PHP')).toBeNull();
  });
  it('selects the newest observed date, then capture time', () => {
    const point = (id: string, date: string, capturedAt: string) => ({ observationId: id, eventId: id, itemId: 'item', occurredOn: date, capturedAt, currency: 'PHP', kind: 'purchase' as const, dateEstimated: false, paidMinor: 1, quantity: '1', unit: 'each', packageQuantity: null, packageUnit: null, merchantName: null });
    expect(selectLatest([point('old', '2026-10-10', '2026-10-20T00:00:00Z'), point('new', '2026-10-20', '2026-10-10T00:00:00Z')])?.observationId).toBe('new');
  });
});
