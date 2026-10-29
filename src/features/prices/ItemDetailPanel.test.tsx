import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ItemDetailPanel from './ItemDetailPanel';
import type { PriceStore } from './types';

describe('ItemDetailPanel', () => {
  it('I2: loads history by the catalog item id, not the stock id', async () => {
    const getHistory = vi.fn().mockResolvedValue([]);
    const store = { getHistory, getLatest: vi.fn().mockResolvedValue(null) } as unknown as PriceStore;
    render(<ItemDetailPanel item={{ id: 'stock-1', catalogItemId: 'item-9', userId: 'u', item: 'Rice', amount: 1, unit: 'kg', price: 55, expirationDate: null, category: 'Grains', notes: null, isActive: true }} store={store} currency="PHP" onClose={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Rice' });
    expect(getHistory).toHaveBeenCalledWith('item-9', expect.anything());
  });
});
