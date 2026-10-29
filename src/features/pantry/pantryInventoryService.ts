import type { PantryItem, Recipe } from '../../types/domain';
import { convertUnitsStrictDetailed } from '../../lib/units';
import { openKitchenDatabase, requestResult, transactionDone } from '../../lib/storage/database';
import { stockToPantry } from '../prices/pantryPriceAdapter';
import type { PriceEvent, PriceObservation, PriceStock } from '../prices/types';

export interface StockContribution {
  id: string;
  stockId: string;
  eventId: string;
  observationId: string;
  quantity: string;
  consumedQuantity: string;
  paidMinor: number;
  currency: string;
  occurredOn: string;
  capturedAt: string;
}

export interface ConsumptionAllocation {
  contributionId: string;
  quantity: string;
}

export interface ConsumptionAllocationResult {
  consumed: string;
  remaining: string;
  allocations: ConsumptionAllocation[];
}

function decimal(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function exact(value: number): string {
  if (Math.abs(value) < 0.000000000001) return '0';
  return value.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
}

export function calculateWeightedAverage(contributions: StockContribution[]): number {
  let quantity = 0;
  let value = 0;
  for (const contribution of contributions) {
    const remaining = Math.max(0, decimal(contribution.quantity) - decimal(contribution.consumedQuantity));
    if (remaining <= 0) continue;
    quantity += remaining;
    value += contribution.paidMinor * (remaining / Math.max(decimal(contribution.quantity), 1));
  }
  return quantity > 0 ? value / quantity : 0;
}

export function mergeStockRows(existing: PriceStock, incoming: PriceStock): PriceStock {
  const existingAmount = decimal(existing.amount);
  const incomingAmount = decimal(incoming.amount);
  const total = existingAmount + incomingAmount;
  return {
    ...existing,
    amount: exact(total),
    priceMajor: total > 0 ? ((existingAmount * existing.priceMajor) + (incomingAmount * incoming.priceMajor)) / total : incoming.priceMajor,
    notes: existing.notes ?? incoming.notes,
    isActive: total > 0,
  };
}

export function allocateConsumption(contributions: StockContribution[], requested: string): ConsumptionAllocationResult {
  let remaining = Math.max(0, decimal(requested));
  const allocations: ConsumptionAllocation[] = [];
  const ordered = [...contributions].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id));
  for (const contribution of ordered) {
    if (remaining <= 0) break;
    const available = Math.max(0, decimal(contribution.quantity) - decimal(contribution.consumedQuantity));
    const amount = Math.min(available, remaining);
    if (amount > 0) {
      allocations.push({ contributionId: contribution.id, quantity: exact(amount) });
      remaining -= amount;
    }
  }
  const consumed = Math.max(0, decimal(requested) - remaining);
  return { consumed: exact(consumed), remaining: exact(remaining), allocations };
}

export function canDeleteReceipt(contributions: StockContribution[]): { allowed: true } | { allowed: false; reason: string } {
  return contributions.some((contribution) => decimal(contribution.consumedQuantity) > 0)
    ? { allowed: false, reason: 'Receipt stock has already been consumed.' }
    : { allowed: true };
}

export interface ConsumeIngredientInput {
  item: string;
  amount: number;
  unit: string;
}

export interface ConsumeIngredientsInput {
  operationId: string;
  ingredients: ConsumeIngredientInput[];
}

export interface ConsumeIngredientResult {
  item: string;
  requested: number;
  consumed: number;
  missing: number;
  unit: string;
}

export interface ConsumeIngredientsResult {
  operationId: string;
  results: ConsumeIngredientResult[];
}

export interface ConsumeRecipeInput {
  operationId: string;
  recipe: Recipe;
  multiplier?: number;
}

export interface ReceiptSummary {
  id: string;
  merchantName: string | null;
  occurredOn: string;
  dateEstimated: boolean;
  currency: string;
  lineCount: number;
  revision: number;
}

export interface ReceiptDetail extends ReceiptSummary {
  lines: Array<PriceObservation & { itemName: string }>;
}

export interface InventoryService {
  consumeIngredients(input: ConsumeIngredientsInput): Promise<ConsumeIngredientsResult>;
  consumeRecipe(input: ConsumeRecipeInput): Promise<ConsumeIngredientsResult>;
  listCurrentStock(): Promise<PantryItem[]>;
  listReceipts(): Promise<ReceiptSummary[]>;
  getReceipt(id: string): Promise<ReceiptDetail | null>;
  deleteReceipt(id: string, expectedRevision: number): Promise<void>;
  deleteReceiptLine(eventId: string, observationId: string, expectedRevision: number): Promise<void>;
}

export interface IndexedDbInventoryServiceOptions { factory?: IDBFactory; }

interface PendingOperation {
  id: string;
  kind: 'consume';
  status: 'pending' | 'committed';
  result?: ConsumeIngredientsResult;
}

interface ConsumptionRecord {
  id: string;
  operationId: string;
  recipeId?: string | number;
  createdAt: string;
  allocations: ConsumptionAllocation[];
}

async function readAll<T>(store: IDBObjectStore): Promise<T[]> {
  return (await requestResult(store.getAll())) as T[];
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createIndexedDbInventoryService(options: IndexedDbInventoryServiceOptions = {}): InventoryService {
  let database: Promise<IDBDatabase> | null = null;
  const open = () => database ??= openKitchenDatabase(options.factory);

  return {
    async listCurrentStock() {
      const db = await open();
      const transaction = db.transaction('price_stock', 'readonly');
      return (await readAll<PriceStock>(transaction.objectStore('price_stock'))).map(stockToPantry);
    },

    async listReceipts() {
      const db = await open();
      const transaction = db.transaction(['price_events', 'price_observations', 'price_merchants'], 'readonly');
      const [events, observations, merchants] = await Promise.all([
        readAll<PriceEvent>(transaction.objectStore('price_events')),
        readAll<PriceObservation>(transaction.objectStore('price_observations')),
        readAll<{ id: string; name: string }>(transaction.objectStore('price_merchants')),
      ]);
      const merchantNames = new Map(merchants.map((merchant) => [merchant.id, merchant.name]));
      return events.map((event) => ({ id: event.id, merchantName: event.merchantId ? merchantNames.get(event.merchantId) ?? null : null, occurredOn: event.occurredOn, dateEstimated: event.dateEstimated, currency: event.currency, lineCount: observations.filter((observation) => observation.eventId === event.id).length, revision: event.revision })).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    },

    async getReceipt(eventId) {
      const db = await open();
      const transaction = db.transaction(['price_events', 'price_observations', 'price_items', 'price_merchants'], 'readonly');
      const event = await requestResult(transaction.objectStore('price_events').get(eventId)) as PriceEvent | undefined;
      if (!event) { await transactionDone(transaction); return null; }
      const [observations, items, merchants] = await Promise.all([
        readAll<PriceObservation>(transaction.objectStore('price_observations')),
        readAll<{ id: string; name: string }>(transaction.objectStore('price_items')),
        readAll<{ id: string; name: string }>(transaction.objectStore('price_merchants')),
      ]);
      const itemNames = new Map(items.map((item) => [item.id, item.name]));
      const merchantNames = new Map(merchants.map((merchant) => [merchant.id, merchant.name]));
      await transactionDone(transaction);
      return { id: event.id, merchantName: event.merchantId ? merchantNames.get(event.merchantId) ?? null : null, occurredOn: event.occurredOn, dateEstimated: event.dateEstimated, currency: event.currency, lineCount: observations.filter((observation) => observation.eventId === event.id).length, revision: event.revision, lines: observations.filter((observation) => observation.eventId === event.id).map((observation) => ({ ...observation, itemName: itemNames.get(observation.itemId) ?? 'Unknown item' })) };
    },

    async deleteReceipt(eventId, expectedRevision) {
      const db = await open();
      const transaction = db.transaction(['price_events', 'price_observations', 'price_stock', 'price_stock_contributions'], 'readwrite');
      const eventStore = transaction.objectStore('price_events');
      const event = await requestResult(eventStore.get(eventId)) as PriceEvent | undefined;
      if (!event || event.revision !== expectedRevision) throw new Error('This receipt changed elsewhere.');
      const observationStore = transaction.objectStore('price_observations');
      const contributionStore = transaction.objectStore('price_stock_contributions');
      const stockStore = transaction.objectStore('price_stock');
      const [observations, contributions, stocks] = await Promise.all([
        readAll<PriceObservation>(observationStore),
        readAll<StockContribution>(contributionStore),
        readAll<PriceStock>(stockStore),
      ]);
      const receiptContributions = contributions.filter((contribution) => contribution.eventId === eventId);
      const deletion = canDeleteReceipt(receiptContributions);
      if (!deletion.allowed) throw new Error(deletion.reason);
      for (const contribution of receiptContributions) {
        const stock = stocks.find((candidate) => candidate.id === contribution.stockId);
        if (stock) {
          const remainingContributions = contributions.filter((candidate) => candidate.stockId === stock.id && candidate.eventId !== eventId);
          stock.amount = String(Math.max(0, (Number(stock.amount) || 0) - Number(contribution.quantity)));
          stock.isActive = Number(stock.amount) > 0;
          const averageMinor = calculateWeightedAverage(remainingContributions);
          stock.priceMajor = averageMinor / ((stock.currency ?? event.currency).toUpperCase() === 'JPY' ? 1 : 100);
          stockStore.put(stock, stock.id);
          const stockIndex = stocks.findIndex((candidate) => candidate.id === stock.id);
          if (stockIndex >= 0) stocks[stockIndex] = stock;
        }
        contributionStore.delete(contribution.id);
      }
      for (const observation of observations.filter((candidate) => candidate.eventId === eventId)) observationStore.delete(observation.id);
      eventStore.delete(eventId);
      await transactionDone(transaction);
    },

    async deleteReceiptLine(eventId, observationId, expectedRevision) {
      const db = await open();
      const transaction = db.transaction(['price_events', 'price_observations', 'price_stock', 'price_stock_contributions'], 'readwrite');
      const eventStore = transaction.objectStore('price_events');
      const event = await requestResult(eventStore.get(eventId)) as PriceEvent | undefined;
      if (!event || event.revision !== expectedRevision) throw new Error('This receipt changed elsewhere.');
      const observationStore = transaction.objectStore('price_observations');
      const contributionStore = transaction.objectStore('price_stock_contributions');
      const stockStore = transaction.objectStore('price_stock');
      const observation = await requestResult(observationStore.get(observationId)) as PriceObservation | undefined;
      if (!observation || observation.eventId !== eventId) throw new Error('Receipt line not found.');
      const contributions = await readAll<StockContribution>(contributionStore);
      const contribution = contributions.find((candidate) => candidate.observationId === observationId);
      if (contribution) {
        const deletion = canDeleteReceipt([contribution]);
        if (!deletion.allowed) throw new Error(deletion.reason);
        const stock = await requestResult(stockStore.get(contribution.stockId)) as PriceStock | undefined;
        if (stock) {
          const remaining = contributions.filter((candidate) => candidate.stockId === stock.id && candidate.id !== contribution.id);
          stock.amount = String(Math.max(0, (Number(stock.amount) || 0) - Number(contribution.quantity)));
          stock.isActive = Number(stock.amount) > 0;
          const averageMinor = calculateWeightedAverage(remaining);
          stock.priceMajor = averageMinor / ((stock.currency ?? event.currency).toUpperCase() === 'JPY' ? 1 : 100);
          stockStore.put(stock, stock.id);
        }
        contributionStore.delete(contribution.id);
      }
      observationStore.delete(observationId);
      eventStore.put({ ...event, revision: event.revision + 1 }, event.id);
      await transactionDone(transaction);
    },

    async consumeIngredients(input) {
      const db = await open();
      const preparation = db.transaction('price_pending_operations', 'readwrite');
      const existingPending = await requestResult(preparation.objectStore('price_pending_operations').get(input.operationId)) as PendingOperation | undefined;
      if (existingPending?.status === 'committed' && existingPending.result) {
        await transactionDone(preparation);
        return existingPending.result;
      }
      preparation.objectStore('price_pending_operations').put({ id: input.operationId, kind: 'consume', status: 'pending' } satisfies PendingOperation, input.operationId);
      await transactionDone(preparation);
      const transaction = db.transaction(['price_stock', 'price_stock_contributions', 'price_consumptions', 'price_pending_operations'], 'readwrite');
      const stockStore = transaction.objectStore('price_stock');
      const contributionStore = transaction.objectStore('price_stock_contributions');
      const consumptionStore = transaction.objectStore('price_consumptions');
      const pendingStore = transaction.objectStore('price_pending_operations');
      const stocks = await readAll<PriceStock>(stockStore);
      const contributions = await readAll<StockContribution>(contributionStore);
      const results: ConsumeIngredientResult[] = [];
      const allAllocations: ConsumptionAllocation[] = [];

      for (const ingredient of input.ingredients) {
        let remainingInRecipeUnit = Math.max(0, ingredient.amount);
        let consumedInRecipeUnit = 0;
        const candidates = stocks.filter((stock) => stock.isActive && stock.itemName.trim().toLocaleLowerCase() === ingredient.item.trim().toLocaleLowerCase());
        for (const stock of candidates) {
          if (remainingInRecipeUnit <= 0) break;
          const requestedInStockUnit = convertUnitsStrictDetailed(remainingInRecipeUnit, ingredient.unit, stock.unit, ingredient.item);
          if (!requestedInStockUnit.convertible) continue;
          const stockContributions = contributions.filter((contribution) => contribution.stockId === stock.id);
          const allocation = allocateConsumption(stockContributions, String(requestedInStockUnit.amount));
          if (allocation.consumed === '0') continue;
          const consumedBack = convertUnitsStrictDetailed(Number(allocation.consumed), stock.unit, ingredient.unit, ingredient.item);
          if (!consumedBack.convertible) continue;
          remainingInRecipeUnit = Math.max(0, remainingInRecipeUnit - consumedBack.amount);
          consumedInRecipeUnit += consumedBack.amount;
          stock.amount = String(Math.max(0, (Number(stock.amount) || 0) - Number(allocation.consumed)));
          stock.isActive = Number(stock.amount) > 0;
          stockStore.put(stock, stock.id);
          for (const item of allocation.allocations) {
            const contribution = stockContributions.find((candidate) => candidate.id === item.contributionId);
            if (!contribution) continue;
            contribution.consumedQuantity = String((Number(contribution.consumedQuantity) || 0) + Number(item.quantity));
            contributionStore.put(contribution, contribution.id);
            allAllocations.push(item);
          }
        }
        results.push({ item: ingredient.item, requested: ingredient.amount, consumed: consumedInRecipeUnit, missing: remainingInRecipeUnit, unit: ingredient.unit });
      }
      const result: ConsumeIngredientsResult = { operationId: input.operationId, results };
      const record: ConsumptionRecord = { id: id('consumption'), operationId: input.operationId, createdAt: new Date().toISOString(), allocations: allAllocations };
      consumptionStore.put(record, record.id);
      pendingStore.put({ id: input.operationId, kind: 'consume', status: 'committed', result } satisfies PendingOperation, input.operationId);
      await transactionDone(transaction);
      return result;
    },

    async consumeRecipe(input) {
      const multiplier = input.multiplier ?? 1;
      return this.consumeIngredients({ operationId: input.operationId, ingredients: input.recipe.ingredients.map((ingredient) => ({ item: ingredient.item, amount: ingredient.amount * multiplier, unit: ingredient.unit })) });
    },
  };
}
