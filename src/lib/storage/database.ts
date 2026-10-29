export const KITCHEN_DATABASE_NAME = 'nutriplan-cache';
export const KITCHEN_DATABASE_VERSION = 3;

export const KITCHEN_STORES = [
  'cache', 'price_items', 'price_aliases', 'price_merchants', 'price_events',
  'price_observations', 'price_stock', 'price_fingerprints', 'price_meta',
  'price_stock_contributions', 'price_consumptions', 'price_pending_operations',
] as const;

export type KitchenStoreName = typeof KITCHEN_STORES[number];

export async function openKitchenDatabase(factory: IDBFactory | undefined = typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined): Promise<IDBDatabase> {
  if (!factory) throw new Error('IndexedDB is unavailable. Price history requires device storage.');
  return new Promise((resolve, reject) => {
    const request = factory.open(KITCHEN_DATABASE_NAME, KITCHEN_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of KITCHEN_STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    request.onblocked = () => reject(new Error('Close older Nutriplan tabs to finish the local storage upgrade.'));
    request.onerror = () => reject(request.error ?? new Error('Unable to open local Nutriplan storage.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}
