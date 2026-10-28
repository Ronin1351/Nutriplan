import { describe, expect, it } from 'vitest';
import { createLocalDataSource, createSupabaseDataSource } from './dataSource';
import type { CacheSnapshot, AppCache } from '../lib/storage/cache';

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
