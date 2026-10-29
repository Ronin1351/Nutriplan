import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createLocalDataSource, createSupabaseDataSource } from './dataSource';
import type { CacheSnapshot, AppCache } from '../lib/storage/cache';
import { openKitchenDatabase, transactionDone } from '../lib/storage/database';

function memoryCache(): AppCache {
  let snapshot: CacheSnapshot | null = null;
  return {
    async readSnapshot() { return snapshot; },
    async writeSnapshot(next) { snapshot = next; },
  };
}

describe('category rule persistence', () => {
  it('persists and upserts rules in the local snapshot', async () => {
    const cache = memoryCache();
    const first = createLocalDataSource(cache);
    await first.saveCategoryRule({ phrase: 'mag chkn thighs', category: 'Poultry', updatedAt: 1 });
    await first.saveCategoryRule({ phrase: 'mag chkn thighs', category: 'Meat', updatedAt: 2 });
    await first.saveCategoryRule({ phrase: 'unknown', category: 'Uncategorized', updatedAt: 3 });

    const second = createLocalDataSource(cache);
    await expect(second.loadCategoryRules()).resolves.toEqual([{ phrase: 'mag chkn thighs', category: 'Meat', updatedAt: 2 }]);
  });

  it('uses device-local rules even when the Supabase data source is active', async () => {
    const cache = memoryCache();
    const source = createSupabaseDataSource({ client: {} as never, cache });

    await source.saveCategoryRule({ phrase: 'onion leaves', category: 'Produce', updatedAt: 4 });

    await expect(source.loadCategoryRules()).resolves.toEqual([{ phrase: 'onion leaves', category: 'Produce', updatedAt: 4 }]);
  });
});

describe('local pantry migration from the cache snapshot', () => {
  const eggs = { id: 'pantry-1', userId: 'personal-user', item: 'Eggs', amount: 12, unit: 'units', price: 9, expirationDate: null, category: 'Dairy', notes: null, isActive: true };

  it('migrates cached pantry rows into device stock exactly once, so deleted rows stay deleted after a reload', async () => {
    const factory = new IDBFactory();
    const cache = memoryCache();
    await cache.writeSnapshot({ recipes: [], pantry: [eggs], mealPlan: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] }, settings: { theme: 'dark', currency: 'PHP' }, categoryRules: [] });

    const first = createLocalDataSource(cache, { indexedDb: factory });
    const migrated = await first.listPantry();
    expect(migrated.map((item) => item.item)).toEqual(['Eggs']);
    await first.removePantryItem(migrated[0].id);
    expect(await first.listPantry()).toEqual([]);

    const afterReload = createLocalDataSource(cache, { indexedDb: factory });
    expect(await afterReload.listPantry()).toEqual([]);
  });

  it('does not migrate the cache into a store that has already been used, even without a marker', async () => {
    const factory = new IDBFactory();
    const cache = memoryCache();
    await cache.writeSnapshot({ recipes: [], pantry: [eggs], mealPlan: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] }, settings: { theme: 'dark', currency: 'PHP' }, categoryRules: [] });
    const db = await openKitchenDatabase(factory);
    const transaction = db.transaction('price_items', 'readwrite');
    transaction.objectStore('price_items').put({ id: 'item-old', name: 'Eggs', brand: null, packageQuantity: null, packageUnit: null, category: 'Dairy', createdAt: '2026-10-01T00:00:00.000Z' }, 'item-old');
    await transactionDone(transaction);

    const source = createLocalDataSource(cache, { indexedDb: factory });
    expect(await source.listPantry()).toEqual([]);
  });
});
