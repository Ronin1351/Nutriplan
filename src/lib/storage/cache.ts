import type { MealPlan, PantryItem, Recipe } from '../../types/domain';
import type { CategoryRule } from '../../features/categories/categoryClassifier';
import { openKitchenDatabase, requestResult, transactionDone } from './database';

export interface CacheSnapshot {
  recipes: Recipe[];
  pantry: PantryItem[];
  mealPlan: MealPlan;
  settings: { theme: string; currency: string };
  categoryRules?: CategoryRule[];
}

export interface CacheBackend {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

export interface AppCache {
  readSnapshot(): Promise<CacheSnapshot | null>;
  writeSnapshot(snapshot: CacheSnapshot): Promise<void>;
}

const STORAGE_KEY = 'nutriplan.cache.snapshot';

function localStorageBackend(storage: Storage | undefined): CacheBackend {
  return {
    async get() {
      if (!storage) return null;
      const value = storage.getItem(STORAGE_KEY);
      return value ? JSON.parse(value) : null;
    },
    async set(_key, value) {
      storage?.setItem(STORAGE_KEY, JSON.stringify(value));
    },
  };
}

function indexedDbBackend(factory: IDBFactory | undefined): CacheBackend | null {
  if (!factory) return null;
  let database: Promise<IDBDatabase> | null = null;
  const open = () => database ??= new Promise((resolve, reject) => {
    void openKitchenDatabase(factory).then(resolve, reject);
  });
  return {
    async get(key) {
      const db = await open();
      const transaction = db.transaction('cache', 'readonly');
      return (await requestResult(transaction.objectStore('cache').get(key))) ?? null;
    },
    async set(key, value) {
      const db = await open();
      const transaction = db.transaction('cache', 'readwrite');
      transaction.objectStore('cache').put(value, key);
      await transactionDone(transaction);
    },
  };
}

function validSnapshot(value: unknown): value is CacheSnapshot {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as CacheSnapshot).recipes) && Array.isArray((value as CacheSnapshot).pantry) && (value as CacheSnapshot).mealPlan);
}

export function createAppCache(options: { indexedDb?: CacheBackend; localStorage?: Storage } = {}): AppCache {
  const primary = options.indexedDb ?? indexedDbBackend(typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined);
  const fallback = localStorageBackend(options.localStorage ?? (typeof window !== 'undefined' ? window.localStorage : undefined));
  return {
    async readSnapshot() {
      try { const value = await primary?.get('snapshot'); if (validSnapshot(value)) return value; } catch { /* use fallback */ }
      try { const value = await fallback.get(STORAGE_KEY); return validSnapshot(value) ? value : null; } catch { return null; }
    },
    async writeSnapshot(snapshot) {
      try { if (primary) { await primary.set('snapshot', snapshot); return; } } catch { /* use fallback */ }
      await fallback.set(STORAGE_KEY, snapshot);
    },
  };
}
