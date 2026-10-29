import { describe, expect, it } from 'vitest';
import {
  allocateConsumption,
  calculateWeightedAverage,
  canDeleteReceipt,
  findMergeTarget,
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

describe('findMergeTarget', () => {
  const base: PriceStock = { id: 'stock-1', itemId: 'item-1', itemName: 'Eggs', brand: null, packageQuantity: null, packageUnit: null, amount: '6', unit: 'units', priceMajor: 10, expirationDate: null, category: 'Dairy', notes: null, isActive: true, currency: 'PHP' };

  it('matches a manual row (itemId === its own stock id) against a receipt row by normalized name', () => {
    const receiptRow = { ...base, id: 'stock-r', itemId: 'item-catalog' };
    const manual = { ...base, id: 'stock-m', itemId: 'stock-m', itemName: '  eggs ' };
    expect(findMergeTarget([receiptRow], manual)?.id).toBe('stock-r');
  });

  it('matches by catalog itemId when both rows have real catalog ids even if names differ', () => {
    const existing = { ...base, itemId: 'item-9', itemName: 'Large Eggs' };
    const incoming = { ...base, id: 'stock-x', itemId: 'item-9', itemName: 'Eggs' };
    expect(findMergeTarget([existing], incoming)?.id).toBe('stock-1');
  });

  it('matches convertible units (g vs kg)', () => {
    const existing = { ...base, itemName: 'Flour', unit: 'g' };
    const incoming = { ...base, id: 'stock-x', itemId: 'stock-x', itemName: 'Flour', unit: 'kg' };
    expect(findMergeTarget([existing], incoming)?.id).toBe('stock-1');
  });

  it('does not match non-convertible units', () => {
    const existing = { ...base, unit: 'units' };
    const incoming = { ...base, id: 'stock-x', itemId: 'stock-x', unit: 'kg' };
    expect(findMergeTarget([existing], incoming)).toBeUndefined();
  });

  it('keeps different expiration dates as separate lots, merges equal ones', () => {
    const lotA = { ...base, expirationDate: '2026-11-01' };
    const lotB = { ...base, id: 'stock-x', itemId: 'stock-x', expirationDate: '2026-11-05' };
    expect(findMergeTarget([lotA], lotB)).toBeUndefined();
    expect(findMergeTarget([lotA], { ...lotB, expirationDate: '2026-11-01' })?.id).toBe('stock-1');
    expect(findMergeTarget([lotA], { ...lotB, expirationDate: null })).toBeUndefined();
  });

  it('never matches a row to itself and ignores inactive rows', () => {
    expect(findMergeTarget([base], base)).toBeUndefined();
    expect(findMergeTarget([{ ...base, isActive: false }], { ...base, id: 'stock-x', itemId: 'stock-x' })).toBeUndefined();
  });

  it('does not match across currencies', () => {
    const existing = { ...base, currency: 'USD' };
    expect(findMergeTarget([existing], { ...base, id: 'stock-x', itemId: 'stock-x' })).toBeUndefined();
  });
});

describe('mergeStockRows with unit conversion', () => {
  it('converts the incoming amount into the existing unit and weights price per existing unit', () => {
    const existing: PriceStock = { id: 'stock-1', itemId: 'item-1', itemName: 'Flour', brand: null, packageQuantity: null, packageUnit: null, amount: '500', unit: 'g', priceMajor: 0.1, expirationDate: null, category: 'Baking', notes: null, isActive: true, currency: 'PHP' };
    const incoming: PriceStock = { ...existing, id: 'stock-2', amount: '1', unit: 'kg', priceMajor: 80 };
    const merged = mergeStockRows(existing, incoming);
    expect(merged.unit).toBe('g');
    expect(merged.amount).toBe('1500');
    expect(merged.priceMajor).toBeCloseTo((500 * 0.1 + 1000 * 0.08) / 1500, 6);
  });
});
