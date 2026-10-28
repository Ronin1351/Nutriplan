import { describe, expect, it } from 'vitest';
import { matchItem } from './itemMatching';
import type { CatalogItem, ItemAlias } from './types';

const item = (id: string, name = 'Chicken', brand: string | null = null, packageQuantity: string | null = null): CatalogItem => ({ id, name, brand, packageQuantity, packageUnit: packageQuantity ? 'kg' : null, category: 'Meat', createdAt: '2026-01-01T00:00:00Z' });

describe('item matching', () => {
  it('reuses an exact normalized item identity', () => {
    expect(matchItem({ name: '  chicken ' }, [item('1')], [])).toEqual({ kind: 'exact', item: item('1') });
  });
  it('does not merge brands or package sizes', () => {
    expect(matchItem({ name: 'Chicken', brand: 'Brand A' }, [item('1', 'Chicken', 'Brand B')], [])).toEqual({ kind: 'new' });
    expect(matchItem({ name: 'Chicken', packageQuantity: '0.5', packageUnit: 'kg' }, [item('1', 'Chicken', null, '1')], [])).toEqual({ kind: 'new' });
  });
  it('uses a confirmed merchant alias', () => {
    const aliases: ItemAlias[] = [{ id: 'a', itemId: '1', merchantId: 'm', value: 'CHK' }];
    expect(matchItem({ name: 'CHK' }, [item('1')], aliases, 'm')).toEqual({ kind: 'alias', item: item('1') });
  });
  it('requires review when an abbreviation is ambiguous', () => {
    expect(matchItem({ name: 'Chicken' }, [item('1', 'Chicken', 'A'), item('2', 'Chicken', 'B')], [])).toMatchObject({ kind: 'review', candidates: expect.any(Array) });
  });
});
