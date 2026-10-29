import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createIndexedDbPriceStore } from '../prices/indexedDbPriceStore';
import { openKitchenDatabase, transactionDone } from '../../lib/storage/database';
import {
  allocateConsumption,
  calculateWeightedAverage,
  canDeleteReceipt,
  createIndexedDbInventoryService,
  findMergeTarget,
  mergeStockRows,
  type StockContribution,
} from './pantryInventoryService';
import type { PriceCapture, PriceStock } from '../prices/types';

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

describe('inventory purchase lines and receipt totals', () => {
  function setup() {
    const factory = new IDBFactory();
    return { store: createIndexedDbPriceStore({ factory }), inventory: createIndexedDbInventoryService({ factory }), factory };
  }
  const line = (itemName: string, paidMinor: number, quantity = '1') => ({ lineId: `line-${itemName}`, ordinal: 0, itemName, quantity, unit: 'each', paidMinor, packageQuantity: null, packageUnit: null });
  const capture = (overrides: Partial<PriceCapture>): PriceCapture => ({ operationId: `op-${Math.random()}`, kind: 'purchase', source: 'manual', occurredOn: '2026-10-01', dateEstimated: false, capturedAt: '2026-10-01T00:00:00.000Z', currency: 'PHP', merchantName: 'SM', receiptNumber: null, lines: [line('Eggs', 1200)], ...overrides });

  it('listPurchaseLines joins item and merchant names, newest first', async () => {
    const { store, inventory } = setup();
    await store.saveCapture(capture({ occurredOn: '2026-10-01', lines: [line('Eggs', 1200)] }));
    await store.saveCapture(capture({ occurredOn: '2026-10-05', merchantName: 'Robinsons', lines: [line('Milk', 900)] }));
    const lines = await inventory.listPurchaseLines();
    expect(lines.map((entry) => entry.itemName)).toEqual(['Milk', 'Eggs']);
    expect(lines[0]).toMatchObject({ merchantName: 'Robinsons', paidMinor: 900, currency: 'PHP', occurredOn: '2026-10-05' });
  });

  it('listPurchaseLines excludes quote events', async () => {
    const { store, inventory } = setup();
    await store.saveCapture(capture({ kind: 'quote', lines: [line('Butter', 500)] }));
    expect(await inventory.listPurchaseLines()).toEqual([]);
  });

  it('listPurchaseLines labels a missing catalog item "Unknown item"', async () => {
    const { store, inventory, factory } = setup();
    await store.saveCapture(capture({ lines: [line('Eggs', 1200)] }));
    const db = await openKitchenDatabase(factory);
    const transaction = db.transaction('price_items', 'readwrite');
    transaction.objectStore('price_items').clear();
    await transactionDone(transaction);
    const lines = await inventory.listPurchaseLines();
    expect(lines[0]?.itemName).toBe('Unknown item');
  });

  it('listReceipts totalMinor sums line paidMinor', async () => {
    const { store, inventory } = setup();
    await store.saveCapture(capture({ lines: [line('Eggs', 1200), line('Milk', 900)] }));
    expect((await inventory.listReceipts())[0]?.totalMinor).toBe(2100);
  });

  it('I5: listReceipts excludes quote events', async () => {
    const { store, inventory } = setup();
    await store.saveCapture(capture({ kind: 'quote', lines: [line('Butter', 500)] }));
    await store.saveCapture(capture({ kind: 'purchase', lines: [line('Eggs', 1200)] }));
    const receipts = await inventory.listReceipts();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].totalMinor).toBe(1200);
  });

  it('deleting a receipt removes stock rows that only that receipt supplied', async () => {
    const { store, inventory } = setup();
    const saved = await store.saveCapture(capture({ lines: [line('Eggs', 1200, '12'), line('Milk', 900, '1')] }));
    await store.createStock({ userId: 'u', item: 'Rice', amount: 5, unit: 'kg', price: 55, expirationDate: null, category: 'Grains', notes: null, isActive: true });
    await inventory.deleteReceipt(saved.eventId, 0);
    const stock = await store.listStock();
    expect(stock.map((row) => row.item)).toEqual(['Rice']);
  });

  it('deleting a receipt that only partly supplied a row keeps the row with the remaining amount', async () => {
    const { store, inventory } = setup();
    const first = await store.saveCapture(capture({ occurredOn: '2026-10-01', lines: [line('Eggs', 1200, '12')] }));
    await store.saveCapture(capture({ occurredOn: '2026-10-02', lines: [line('Eggs', 600, '6')] }));
    await inventory.deleteReceipt(first.eventId, 0);
    const [eggs] = await store.listStock();
    expect(eggs).toMatchObject({ item: 'Eggs', amount: 6, isActive: true });
  });

  it('deleting the last line of a receipt removes the row it supplied', async () => {
    const { store, inventory } = setup();
    const saved = await store.saveCapture(capture({ lines: [line('Eggs', 1200, '12')] }));
    const detail = await inventory.getReceipt(saved.eventId);
    await inventory.deleteReceiptLine(saved.eventId, detail!.lines[0].id, 0);
    expect(await store.listStock()).toEqual([]);
  });

  it('reconcile drops stock rows that no receipt line or contribution supports', async () => {
    const { store, inventory, factory } = setup();
    await store.createStock({ userId: 'u', item: 'Rice', amount: 5, unit: 'kg', price: 55, expirationDate: null, category: 'Grains', notes: null, isActive: true });
    // Simulate a legacy row created before contribution tracking, whose receipt was deleted.
    const db = await openKitchenDatabase(factory);
    const transaction = db.transaction('price_stock', 'readwrite');
    transaction.objectStore('price_stock').put({ id: 'stock-legacy', itemId: 'item-gone', itemName: 'GATORADE', brand: null, packageQuantity: null, packageUnit: null, amount: '3', unit: 'units', priceMajor: 132, expirationDate: null, category: 'Beverages', notes: null, isActive: true, currency: 'PHP' }, 'stock-legacy');
    await transactionDone(transaction);
    expect((await store.listStock()).map((row) => row.item)).toEqual(['Rice']);
    expect((await inventory.listCurrentStock()).map((row) => row.item)).toEqual(['Rice']);
  });

  it('reconcile removes contributions whose receipt no longer exists and adjusts the row', async () => {
    const { store, factory } = setup();
    await store.saveCapture(capture({ occurredOn: '2026-10-01', lines: [line('Eggs', 1200, '12')] }));
    const second = await store.saveCapture(capture({ occurredOn: '2026-10-02', lines: [line('Eggs', 600, '6')] }));
    const db = await openKitchenDatabase(factory);
    const transaction = db.transaction(['price_events'], 'readwrite');
    transaction.objectStore('price_events').delete(second.eventId);
    await transactionDone(transaction);
    const [eggs] = await store.listStock();
    expect(eggs.amount).toBe(12);
  });
});
