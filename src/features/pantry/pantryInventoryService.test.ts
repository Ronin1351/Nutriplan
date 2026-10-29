import { describe, expect, it } from 'vitest';
import {
  allocateConsumption,
  calculateWeightedAverage,
  canDeleteReceipt,
  mergeStockRows,
  type StockContribution,
} from './pantryInventoryService';
import type { PriceStock } from '../prices/types';

describe('pantry inventory service', () => {
  it('merges compatible manual stock rows using weighted average pricing', () => {
    const first: PriceStock = { id: 'stock-1', itemId: 'item-1', itemName: 'Soup', brand: null, packageQuantity: null, packageUnit: null, amount: '5', unit: 'units', priceMajor: 100, expirationDate: null, category: 'Pantry', notes: null, isActive: true, currency: 'PHP' };
    const second: PriceStock = { ...first, id: 'stock-2', amount: '5', priceMajor: 120 };

    expect(mergeStockRows(first, second)).toMatchObject({ amount: '10', priceMajor: 110, id: 'stock-1' });
  });

  it('calculates weighted average from remaining contribution value', () => {
    const contributions: StockContribution[] = [
      { id: 'a', stockId: 'stock-1', eventId: 'receipt-1', observationId: 'line-1', quantity: '5', consumedQuantity: '0', paidMinor: 500, currency: 'PHP', occurredOn: '2026-10-28', capturedAt: '2026-10-28T01:00:00.000Z' },
      { id: 'b', stockId: 'stock-1', eventId: 'receipt-2', observationId: 'line-2', quantity: '5', consumedQuantity: '0', paidMinor: 750, currency: 'PHP', occurredOn: '2026-10-29', capturedAt: '2026-10-29T01:00:00.000Z' },
    ];

    expect(calculateWeightedAverage(contributions)).toBe(125);
  });

  it('allocates consumption FIFO across receipt contributions without going negative', () => {
    const contributions: StockContribution[] = [
      { id: 'old', stockId: 'stock-1', eventId: 'receipt-1', observationId: 'line-1', quantity: '3', consumedQuantity: '0', paidMinor: 300, currency: 'PHP', occurredOn: '2026-10-01', capturedAt: '2026-10-01T01:00:00.000Z' },
      { id: 'new', stockId: 'stock-1', eventId: 'receipt-2', observationId: 'line-2', quantity: '4', consumedQuantity: '1', paidMinor: 500, currency: 'PHP', occurredOn: '2026-10-02', capturedAt: '2026-10-02T01:00:00.000Z' },
    ];

    const result = allocateConsumption(contributions, '5');

    expect(result.consumed).toBe('5');
    expect(result.allocations).toEqual([
      { contributionId: 'old', quantity: '3' },
      { contributionId: 'new', quantity: '2' },
    ]);
    expect(result.remaining).toBe('0');
  });

  it('blocks receipt deletion when any contribution has been consumed', () => {
    const contributions: StockContribution[] = [
      { id: 'line-1', stockId: 'stock-1', eventId: 'receipt-1', observationId: 'line-1', quantity: '5', consumedQuantity: '1', paidMinor: 500, currency: 'PHP', occurredOn: '2026-10-28', capturedAt: '2026-10-28T01:00:00.000Z' },
    ];

    expect(canDeleteReceipt(contributions)).toEqual({ allowed: false, reason: 'Receipt stock has already been consumed.' });
  });
});
