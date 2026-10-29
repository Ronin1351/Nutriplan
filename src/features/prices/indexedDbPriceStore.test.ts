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
});
