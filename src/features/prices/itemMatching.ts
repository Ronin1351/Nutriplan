import type { CatalogItem, ItemAlias } from './types';

export interface ItemCandidate {
  name: string;
  brand?: string | null;
  packageQuantity?: string | null;
  packageUnit?: string | null;
}

export type ItemMatch =
  | { kind: 'exact' | 'alias'; item: CatalogItem }
  | { kind: 'review'; candidates: CatalogItem[] }
  | { kind: 'new' };

export function normalizeItemName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function matchItem(input: ItemCandidate, items: CatalogItem[], aliases: ItemAlias[], merchantId?: string): ItemMatch {
  const name = normalizeItemName(input.name);
  const brand = normalizeItemName(input.brand ?? '');
  const packageQuantity = input.packageQuantity?.trim() ?? null;
  const packageUnit = normalizeItemName(input.packageUnit ?? '');
  const compatible = (item: CatalogItem) => normalizeItemName(item.name) === name
    && normalizeItemName(item.brand ?? '') === brand
    && (item.packageQuantity ?? null) === packageQuantity
    && normalizeItemName(item.packageUnit ?? '') === packageUnit;
  const exact = items.find(compatible);
  if (exact) return { kind: 'exact', item: exact };
  const merchantAlias = aliases.find((alias) => (!merchantId || alias.merchantId === merchantId) && normalizeItemName(alias.value) === name);
  if (merchantAlias) {
    const item = items.find((candidate) => candidate.id === merchantAlias.itemId);
    if (item) return { kind: 'alias', item };
  }
  const candidates = items.filter((item) => normalizeItemName(item.name) === name);
  return candidates.length > 1 ? { kind: 'review', candidates } : { kind: 'new' };
}
