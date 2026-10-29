import { describe, expect, it } from 'vitest';
import { groupByCategory, sortPantry, sortPurchases } from './pantrySort';
import type { PantryItem } from '../types/domain';
import type { PurchaseLine } from '../features/pantry/pantryInventoryService';

const item = (overrides: Partial<PantryItem>): PantryItem => ({ id: overrides.item ?? 'x', userId: 'u', item: 'x', amount: 1, unit: 'units', price: 0, expirationDate: null, category: 'Uncategorized', notes: null, isActive: true, ...overrides });
const items = [item({ item: 'milk', category: 'Dairy', price: 90 }), item({ item: 'Apples', category: 'Produce', price: 120 }), item({ item: 'butter', category: 'Dairy', price: 200 })];

describe('sortPantry', () => {
  it('name sorts A–Z ignoring case', () => {
    expect(sortPantry(items, 'name').map((entry) => entry.item)).toEqual(['Apples', 'butter', 'milk']);
  });
  it('price sorts unit price descending with name tie-break', () => {
    expect(sortPantry([...items, item({ item: 'cream', price: 200 })], 'price').map((entry) => entry.item)).toEqual(['butter', 'cream', 'Apples', 'milk']);
  });
  it('category sorts by category then name', () => {
    expect(sortPantry(items, 'category').map((entry) => entry.item)).toEqual(['butter', 'milk', 'Apples']);
  });
  it('does not mutate its input', () => {
    const copy = [...items];
    sortPantry(items, 'name');
    expect(items).toEqual(copy);
  });
});

describe('groupByCategory', () => {
  it('groups consecutive items by category in input order', () => {
    const groups = groupByCategory(sortPantry(items, 'category'));
    expect(groups.map((group) => [group.category, group.items.length])).toEqual([['Dairy', 2], ['Produce', 1]]);
  });
});

describe('sortPurchases', () => {
  const line = (overrides: Partial<PurchaseLine>): PurchaseLine => ({ observationId: 'o', eventId: 'e', itemName: 'x', quantity: '1', unit: 'each', paidMinor: 0, currency: 'PHP', occurredOn: '2026-01-01', merchantName: null, ...overrides });
  const lines = [line({ itemName: 'milk', paidMinor: 90, occurredOn: '2026-03-01' }), line({ itemName: 'Apples', paidMinor: 120, occurredOn: '2026-05-01' }), line({ itemName: 'butter', paidMinor: 200, occurredOn: '2026-01-01' })];
  it('date sorts newest first', () => { expect(sortPurchases(lines, 'date').map((entry) => entry.itemName)).toEqual(['Apples', 'milk', 'butter']); });
  it('item sorts A–Z', () => { expect(sortPurchases(lines, 'item').map((entry) => entry.itemName)).toEqual(['Apples', 'butter', 'milk']); });
  it('price sorts paid descending', () => { expect(sortPurchases(lines, 'price').map((entry) => entry.itemName)).toEqual(['butter', 'Apples', 'milk']); });
});
