import type { NewPantryItem, PantryItem } from '../../types/domain';
import { captureFingerprint } from './captureFingerprint';
import { matchItem } from './itemMatching';
import { minorToMajor, pantryToStock, stockToPantry } from './pantryPriceAdapter';
import type { CatalogItem, EventCorrection, ItemAlias, Merchant, ObservationCorrection, PriceCapture, PriceEvent, PriceExport, PriceHistoryPoint, PriceHistoryQuery, PriceObservation, PriceStore, PriceStock, PriceSummary, SaveCaptureResult } from './types';
import { openKitchenDatabase, requestResult, transactionDone } from '../../lib/storage/database';
import { normalizeUnit } from '../../lib/units';
import { mergeStockRows } from '../pantry/pantryInventoryService';

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function all<T>(store: IDBObjectStore): Promise<T[]> {
  return (await requestResult(store.getAll())) as T[];
}

function stockMatches(stock: PriceStock, itemId: string, unit: string, currency: string): boolean {
  return stock.itemId === itemId && normalizeUnit(stock.unit) === normalizeUnit(unit) && (stock.currency ?? currency) === currency && stock.expirationDate === null;
}

function nextWeightedPrice(stock: PriceStock, addedAmount: string, addedPriceMajor: number): number {
  const existingAmount = Number(stock.amount) || 0;
  const amount = Number(addedAmount) || 0;
  return existingAmount + amount > 0 ? ((existingAmount * stock.priceMajor) + (amount * addedPriceMajor)) / (existingAmount + amount) : addedPriceMajor;
}

export interface IndexedDbPriceStoreOptions { factory?: IDBFactory; }

export function createIndexedDbPriceStore(options: IndexedDbPriceStoreOptions = {}): PriceStore {
  let database: Promise<IDBDatabase> | null = null;
  const open = () => database ??= openKitchenDatabase(options.factory);
  const read = async <T>(storeName: string) => { const db = await open(); return all<T>(db.transaction(storeName, 'readonly').objectStore(storeName)); };
  const put = async (storeName: string, value: unknown, key: string) => { const db = await open(); const transaction = db.transaction(storeName, 'readwrite'); transaction.objectStore(storeName).put(value, key); await transactionDone(transaction); };

  return {
    async saveCapture(input: PriceCapture): Promise<SaveCaptureResult> {
      const db = await open();
      const fingerprint = await captureFingerprint(input);
      const transaction = db.transaction(['price_items', 'price_aliases', 'price_merchants', 'price_events', 'price_observations', 'price_stock', 'price_stock_contributions', 'price_fingerprints'], 'readwrite');
      const itemsStore = transaction.objectStore('price_items');
      const aliasesStore = transaction.objectStore('price_aliases');
      const merchantsStore = transaction.objectStore('price_merchants');
      const eventsStore = transaction.objectStore('price_events');
      const observationsStore = transaction.objectStore('price_observations');
      const stockStore = transaction.objectStore('price_stock');
      const contributionStore = transaction.objectStore('price_stock_contributions');
      const fingerprintsStore = transaction.objectStore('price_fingerprints');
      const [items, aliases, merchants, events, stocks] = await Promise.all([all<CatalogItem>(itemsStore), all<ItemAlias>(aliasesStore), all<Merchant>(merchantsStore), all<PriceEvent>(eventsStore), all<PriceStock>(stockStore)]);
      const duplicate = events.find((event) => event.fingerprint === fingerprint || event.operationId === input.operationId);
      if (duplicate) { await transactionDone(transaction); return { status: 'duplicate', eventId: duplicate.id, matchedCatalogIds: [], affectedStockIds: [] }; }
      let merchantId: string | null = null;
      if (input.merchantName?.trim()) {
        merchantId = merchants.find((merchant) => merchant.name.toLocaleLowerCase() === input.merchantName?.trim().toLocaleLowerCase())?.id ?? id('merchant');
        if (!merchants.some((merchant) => merchant.id === merchantId)) merchantsStore.put({ id: merchantId, name: input.merchantName.trim() } satisfies Merchant, merchantId);
      }
      const event: PriceEvent = { id: id('event'), operationId: input.operationId, kind: input.kind, source: input.source, occurredOn: input.occurredOn, dateEstimated: input.dateEstimated, capturedAt: input.capturedAt, currency: input.currency, merchantId, receiptNumber: input.receiptNumber?.trim() || null, fingerprint, revision: 0 };
      eventsStore.put(event, event.id);
      fingerprintsStore.put({ eventId: event.id, fingerprint }, fingerprint);
      const matchedCatalogIds: string[] = [];
      const affectedStockIds: string[] = [];
      for (const line of input.lines) {
        const match = line.itemId ? { kind: 'exact' as const, item: items.find((item) => item.id === line.itemId) } : matchItem({ name: line.itemName, brand: line.brand, packageQuantity: line.packageQuantity, packageUnit: line.packageUnit }, items, aliases, merchantId ?? undefined);
        const catalog = match.kind === 'exact' || match.kind === 'alias' ? match.item : undefined;
        const item = catalog ?? { id: id('item'), name: line.itemName.trim(), brand: line.brand?.trim() || null, packageQuantity: line.packageQuantity ?? null, packageUnit: line.packageUnit ?? null, category: line.category ?? 'Uncategorized', createdAt: new Date().toISOString() } satisfies CatalogItem;
        if (!catalog) itemsStore.put(item, item.id);
        matchedCatalogIds.push(item.id);
        const observation: PriceObservation = { id: id('observation'), eventId: event.id, itemId: item.id, lineId: line.lineId, ordinal: line.ordinal, quantity: line.quantity, unit: line.unit, paidMinor: line.paidMinor, packageQuantity: line.packageQuantity ?? null, packageUnit: line.packageUnit ?? null, revision: 0 };
        observationsStore.put(observation, observation.id);
        if (input.kind === 'purchase') {
          const addedPriceMajor = minorToMajor(line.paidMinor, input.currency);
          const existing = stocks.find((stock) => stockMatches(stock, item.id, line.unit, input.currency));
          const stockId = existing?.id ?? id('stock');
          const stock: PriceStock = existing
            ? { ...existing, amount: String((Number(existing.amount) || 0) + (Number(line.quantity) || 0)), priceMajor: nextWeightedPrice(existing, line.quantity, addedPriceMajor), isActive: true }
            : { id: stockId, itemId: item.id, itemName: item.name, brand: item.brand, packageQuantity: item.packageQuantity, packageUnit: item.packageUnit, amount: line.quantity, unit: line.unit, priceMajor: addedPriceMajor, expirationDate: null, category: item.category, notes: input.merchantName?.trim() || null, isActive: true, currency: input.currency };
          stockStore.put(stock, stockId);
          const stockIndex = stocks.findIndex((candidate) => candidate.id === stockId);
          if (stockIndex >= 0) stocks[stockIndex] = stock;
          else stocks.push(stock);
          const contributionId = id('contribution');
          contributionStore.put({ id: contributionId, stockId, eventId: event.id, observationId: observation.id, quantity: line.quantity, consumedQuantity: '0', paidMinor: line.paidMinor, currency: input.currency, occurredOn: input.occurredOn, capturedAt: input.capturedAt }, contributionId);
          affectedStockIds.push(stockId);
        }
      }
      await transactionDone(transaction);
      return { status: 'saved', eventId: event.id, matchedCatalogIds, affectedStockIds };
    },
    async getHistory(itemId: string, query: PriceHistoryQuery = {}): Promise<PriceHistoryPoint[]> {
      const [events, observations, merchants] = await Promise.all([read<PriceEvent>('price_events'), read<PriceObservation>('price_observations'), read<Merchant>('price_merchants')]);
      const byEvent = new Map(events.map((event) => [event.id, event]));
      const byMerchant = new Map(merchants.map((merchant) => [merchant.id, merchant.name]));
      return observations.filter((observation) => observation.itemId === itemId).flatMap((observation) => { const event = byEvent.get(observation.eventId); if (!event || (query.currency && event.currency !== query.currency) || (query.source && event.kind !== query.source) || (query.from && event.occurredOn < query.from) || (query.to && event.occurredOn > query.to)) return []; return [{ observationId: observation.id, eventId: event.id, itemId, occurredOn: event.occurredOn, capturedAt: event.capturedAt, currency: event.currency, kind: event.kind, dateEstimated: event.dateEstimated, paidMinor: observation.paidMinor, quantity: observation.quantity, unit: observation.unit, packageQuantity: observation.packageQuantity, packageUnit: observation.packageUnit, merchantName: event.merchantId ? byMerchant.get(event.merchantId) ?? null : null }]; }).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.capturedAt.localeCompare(b.capturedAt));
    },
    async getLatest(itemId: string, currency?: string): Promise<PriceSummary | null> {
      const points = await this.getHistory(itemId, { currency });
      const latest = points.at(-1); if (!latest) return null;
      const previous = points.at(-2) ?? null;
      const changeMinor = previous ? latest.paidMinor - previous.paidMinor : null;
      return { latest, previous, changeMinor, changePercent: previous && previous.paidMinor !== 0 ? (changeMinor! / previous.paidMinor) * 100 : null };
    },
    async correctObservation(observationId: string, expectedRevision: number, changes: ObservationCorrection): Promise<PriceObservation> {
      const db = await open(); const transaction = db.transaction('price_observations', 'readwrite'); const store = transaction.objectStore('price_observations'); const current = await requestResult(store.get(observationId)) as PriceObservation | undefined; if (!current || current.revision !== expectedRevision) throw new Error('This price observation changed elsewhere.'); const updated = { ...current, ...changes, revision: current.revision + 1 }; store.put(updated, observationId); await transactionDone(transaction); return updated;
    },
    async correctEvent(eventId: string, expectedRevision: number, changes: EventCorrection): Promise<PriceEvent> {
      const db = await open(); const transaction = db.transaction('price_events', 'readwrite'); const store = transaction.objectStore('price_events'); const current = await requestResult(store.get(eventId)) as PriceEvent | undefined; if (!current || current.revision !== expectedRevision) throw new Error('This price event changed elsewhere.'); const updated = { ...current, occurredOn: changes.occurredOn ?? current.occurredOn, dateEstimated: changes.dateEstimated ?? current.dateEstimated, revision: current.revision + 1 }; store.put(updated, eventId); await transactionDone(transaction); return updated;
    },
    async exportRecords(): Promise<PriceExport> { const [items, aliases, merchants, events, observations, stock] = await Promise.all([read<CatalogItem>('price_items'), read<ItemAlias>('price_aliases'), read<Merchant>('price_merchants'), read<PriceEvent>('price_events'), read<PriceObservation>('price_observations'), read<PriceStock>('price_stock')]); return { schemaVersion: 2, items, aliases, merchants, events, observations, stock }; },
    async listStock() { return (await read<PriceStock>('price_stock')).map(stockToPantry); },
    async createStock(input: NewPantryItem) {
      const db = await open();
      const transaction = db.transaction(['price_stock', 'price_events', 'price_observations', 'price_stock_contributions'], 'readwrite');
      const stockStore = transaction.objectStore('price_stock');
      const eventStore = transaction.objectStore('price_events');
      const observationStore = transaction.objectStore('price_observations');
      const contributionStore = transaction.objectStore('price_stock_contributions');
      const stocks = await all<PriceStock>(stockStore);
      const incoming = pantryToStock(input, id('stock'));
      const existing = stocks.find((stock) => stock.itemName.trim().toLocaleLowerCase() === incoming.itemName.trim().toLocaleLowerCase() && normalizeUnit(stock.unit) === normalizeUnit(incoming.unit) && stock.expirationDate === incoming.expirationDate && (stock.currency ?? 'PHP') === 'PHP');
      const stock = existing ? mergeStockRows(existing, incoming) : incoming;
      stockStore.put(stock, stock.id);
      const event: PriceEvent = { id: id('event'), operationId: id('manual'), kind: 'purchase', source: 'manual', occurredOn: new Date().toISOString().slice(0, 10), dateEstimated: true, capturedAt: new Date().toISOString(), currency: 'PHP', merchantId: null, receiptNumber: null, fingerprint: '', revision: 0 };
      eventStore.put(event, event.id);
      const observation: PriceObservation = { id: id('observation'), eventId: event.id, itemId: stock.itemId, lineId: id('manual-line'), ordinal: 0, quantity: String(input.amount), unit: input.unit, paidMinor: Math.round(input.price * 100), packageQuantity: null, packageUnit: null, revision: 0 };
      observationStore.put(observation, observation.id);
      const contributionId = id('contribution');
      contributionStore.put({ id: contributionId, stockId: stock.id, eventId: event.id, observationId: observation.id, quantity: String(input.amount), consumedQuantity: '0', paidMinor: Math.round(input.price * 100), currency: 'PHP', occurredOn: event.occurredOn, capturedAt: event.capturedAt }, contributionId);
      await transactionDone(transaction);
      return stockToPantry(stock);
    },
    async updateStock(item: PantryItem) { const stock = pantryToStock(item, String(item.id)); await put('price_stock', stock, stock.id); return stockToPantry(stock); },
    async removeStock(stockId: string | number) { const db = await open(); const transaction = db.transaction('price_stock', 'readwrite'); transaction.objectStore('price_stock').delete(String(stockId)); await transactionDone(transaction); },
    async saveStockNotes(stockId: string | number, notes: string | null) { const db = await open(); const transaction = db.transaction('price_stock', 'readwrite'); const store = transaction.objectStore('price_stock'); const stock = await requestResult(store.get(String(stockId))) as PriceStock | undefined; if (stock) store.put({ ...stock, notes }, String(stockId)); await transactionDone(transaction); },
  };
}
