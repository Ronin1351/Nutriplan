import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createIndexedDbPriceStore } from './indexedDbPriceStore';
import { createIndexedDbInventoryService } from '../pantry/pantryInventoryService';
import type { NewPantryItem } from '../../types/domain';

function pantry(overrides: Partial<NewPantryItem> = {}): NewPantryItem {
  return { userId: 'personal-user', item: 'Eggs', amount: 6, unit: 'units', price: 10, expirationDate: null, category: 'Dairy', notes: null, isActive: true, ...overrides };
}

function setup() {
  const factory = new IDBFactory();
  return { store: createIndexedDbPriceStore({ factory }), inventory: createIndexedDbInventoryService({ factory }) };
}

describe('indexedDb price store collisions', () => {
  it('updateStock no longer merges silently', async () => {
    const { store } = setup();
    const first = await store.createStock(pantry());
    const second = await store.createStock(pantry({ expirationDate: '2026-12-01' }));
    expect(first.id).not.toBe(second.id);
    await store.updateStock({ ...second, expirationDate: null });
    expect((await store.listStock()).length).toBe(2);
  });

  it('findStockCollision returns the matching row', async () => {
    const { store } = setup();
    const first = await store.createStock(pantry());
    const second = await store.createStock(pantry({ expirationDate: '2026-12-01' }));
    const collision = await store.findStockCollision({ ...second, expirationDate: null });
    expect(collision?.id).toBe(first.id);
  });

  it('findStockCollision returns null when nothing matches', async () => {
    const { store } = setup();
    const first = await store.createStock(pantry());
    expect(await store.findStockCollision({ ...first, item: 'Milk' })).toBeNull();
  });

  it('mergeStockInto sums amounts, deletes source, keeps receipt lines', async () => {
    const { store, inventory } = setup();
    const target = await store.createStock(pantry({ amount: 6 }));
    const source = await store.createStock(pantry({ amount: 4, expirationDate: '2026-12-01' }));
    const merged = await store.mergeStockInto(String(source.id), String(target.id));
    expect(merged.id).toBe(target.id);
    expect(merged.amount).toBe(10);
    expect((await store.listStock()).length).toBe(1);
    expect((await inventory.listReceipts()).reduce((sum, receipt) => sum + receipt.lineCount, 0)).toBe(2);
  });

  it('mergeStockInto converts contributions into the target unit', async () => {
    const { store, inventory } = setup();
    const target = await store.createStock(pantry({ item: 'Flour', amount: 500, unit: 'g', price: 0.1 }));
    const source = await store.createStock(pantry({ item: 'Flour', amount: 1, unit: 'kg', price: 80, expirationDate: '2026-12-01' }));
    const merged = await store.mergeStockInto(String(source.id), String(target.id));
    expect(merged.amount).toBe(1500);
    expect(merged.unit).toBe('g');
    const result = await inventory.consumeIngredients({ operationId: 'op-1', ingredients: [{ item: 'Flour', amount: 1500, unit: 'g' }] });
    expect(result.results[0]?.missing).toBe(0);
  });

  it('createStock registers a catalog item so purchase lines carry the item name', async () => {
    const { store, inventory } = setup();
    await store.createStock(pantry({ item: 'Eggs' }));
    const lines = await inventory.listPurchaseLines();
    expect(lines[0]?.itemName).toBe('Eggs');
  });

  it('createStock reuses a catalog item created by a receipt, so the receipt row and the manual row merge', async () => {
    const { store } = setup();
    await store.saveCapture({ operationId: 'op-r', kind: 'purchase', source: 'manual', occurredOn: '2026-10-01', dateEstimated: false, capturedAt: '2026-10-01T00:00:00.000Z', currency: 'PHP', merchantName: 'SM', receiptNumber: null, lines: [{ lineId: 'l1', ordinal: 0, itemName: 'Eggs', quantity: '6', unit: 'units', paidMinor: 600, packageQuantity: null, packageUnit: null }] });
    await store.createStock(pantry({ item: 'eggs', amount: 6 }));
    const stock = await store.listStock();
    expect(stock).toHaveLength(1);
    expect(stock[0].amount).toBe(12);
  });

  it('C1: editing the unit converts the row contributions so a later receipt delete only removes that receipt', async () => {
    const { store, inventory } = setup();
    const target = await store.createStock(pantry({ item: 'Flour', amount: 1, unit: 'kg', price: 80 }));
    const source = await store.createStock(pantry({ item: 'Flour', amount: 500, unit: 'g', price: 0.1, expirationDate: '2026-12-01' }));
    const edited = await store.updateStock({ ...source, amount: 0.5, unit: 'kg', expirationDate: null });
    expect(edited.unit).toBe('kg');
    const merged = await store.mergeStockInto(String(source.id), String(target.id));
    expect(merged.amount).toBeCloseTo(1.5, 6);
    const receipts = await inventory.listReceipts();
    const details = await Promise.all(receipts.map((receipt) => inventory.getReceipt(receipt.id)));
    const sourceReceipt = details.find((detail) => detail?.lines[0]?.quantity === '500');
    expect(sourceReceipt).toBeDefined();
    await inventory.deleteReceipt(sourceReceipt!.id, sourceReceipt!.revision);
    const [remaining] = await store.listStock();
    expect(remaining.amount).toBeCloseTo(1, 6);
    expect(remaining.isActive).toBe(true);
  });

  it('C1: keep-separate unit edit converts contributions so consumption cannot exceed real stock', async () => {
    const { store, inventory } = setup();
    const sugar = await store.createStock(pantry({ item: 'Sugar', amount: 1000, unit: 'g', price: 0.05 }));
    await store.updateStock({ ...sugar, amount: 1, unit: 'kg' });
    const result = await inventory.consumeIngredients({ operationId: 'op-s', ingredients: [{ item: 'Sugar', amount: 2, unit: 'kg' }] });
    expect(result.results[0]).toMatchObject({ consumed: 1, missing: 1 });
  });

  it('C1: an edit to a non-convertible unit is rejected', async () => {
    const { store } = setup();
    const rice = await store.createStock(pantry({ item: 'Rice', amount: 5, unit: 'kg' }));
    await expect(store.updateStock({ ...rice, unit: 'units' })).rejects.toThrow(/convert/i);
  });

  it('I1: renaming a manual row to match another manual row reports the collision', async () => {
    const { store } = setup();
    const milk = await store.createStock(pantry({ item: 'Milk', amount: 1, unit: 'L' }));
    const typo = await store.createStock(pantry({ item: 'Mlik', amount: 1, unit: 'L' }));
    const collision = await store.findStockCollision({ ...typo, item: 'Milk' });
    expect(collision?.id).toBe(milk.id);
  });

  it('I1: renaming re-points the row at the catalog item of the new name', async () => {
    const { store, inventory } = setup();
    await store.createStock(pantry({ item: 'Milk', amount: 1, unit: 'L' }));
    const typo = await store.createStock(pantry({ item: 'Mlik', amount: 1, unit: 'L' }));
    const renamed = await store.updateStock({ ...typo, item: 'Milk' });
    const [milk] = await store.listStock();
    expect(renamed.catalogItemId).toBe(milk.catalogItemId);
    expect((await inventory.listPurchaseLines()).every((line) => line.itemName === 'Milk')).toBe(true);
  });

  it('a receipt line of 3 @ 44 = 132 stores a unit price of 44, not 132', async () => {
    const { store } = setup();
    await store.saveCapture({ operationId: 'op-g', kind: 'purchase', source: 'manual', occurredOn: '2026-10-01', dateEstimated: false, capturedAt: '2026-10-01T00:00:00.000Z', currency: 'PHP', merchantName: 'IFM', receiptNumber: null, lines: [{ lineId: 'l1', ordinal: 0, itemName: 'Gatorade', quantity: '3', unit: 'units', paidMinor: 13200, packageQuantity: null, packageUnit: null }] });
    const [row] = await store.listStock();
    expect(row.price).toBe(44);
    expect(row.amount * row.price).toBe(132);
  });

  it('a manual add of 5 kg at 55 records a 275 line total so later averaging is right', async () => {
    const { store, inventory } = setup();
    await store.createStock(pantry({ item: 'Rice', amount: 5, unit: 'kg', price: 55 }));
    expect((await inventory.listReceipts())[0].totalMinor).toBe(27500);
    expect((await store.listStock())[0].price).toBe(55);
  });
});
