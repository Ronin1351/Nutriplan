import type { PantryItem } from '../types/domain';
import type { PurchaseLine } from '../features/pantry/pantryInventoryService';

export type PantrySort = 'category' | 'name' | 'price';
export type PurchaseSort = 'date' | 'item' | 'price';

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function sortPantry(items: PantryItem[], sort: PantrySort): PantryItem[] {
  const copy = [...items];
  if (sort === 'name') return copy.sort((a, b) => byName(a.item, b.item));
  if (sort === 'price') return copy.sort((a, b) => b.price - a.price || byName(a.item, b.item));
  return copy.sort((a, b) => byName(a.category, b.category) || byName(a.item, b.item));
}

export function groupByCategory(items: PantryItem[]): Array<{ category: string; items: PantryItem[] }> {
  const groups: Array<{ category: string; items: PantryItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.category === item.category) last.items.push(item);
    else groups.push({ category: item.category, items: [item] });
  }
  return groups;
}

export function sortPurchases(lines: PurchaseLine[], sort: PurchaseSort): PurchaseLine[] {
  const copy = [...lines];
  if (sort === 'item') return copy.sort((a, b) => byName(a.itemName, b.itemName));
  if (sort === 'price') return copy.sort((a, b) => b.paidMinor - a.paidMinor || byName(a.itemName, b.itemName));
  return copy.sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || byName(a.itemName, b.itemName));
}
