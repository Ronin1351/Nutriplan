import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PantryView from './PantryView';
import type { PantryItem } from '../../types/domain';

const item = (overrides: Partial<PantryItem>): PantryItem => ({ id: overrides.item ?? 'x', userId: 'u', item: 'x', amount: 1, unit: 'units', price: 0, expirationDate: null, category: 'Uncategorized', notes: null, isActive: true, ...overrides });
const pantry = [item({ id: 'p-milk', item: 'milk', category: 'Dairy', price: 90 }), item({ id: 'p-apples', item: 'Apples', category: 'Produce', price: 120 }), item({ id: 'p-butter', item: 'butter', category: 'Dairy', price: 200 })];

function renderView(overrides: Partial<React.ComponentProps<typeof PantryView>> = {}) {
  const props = {
    pantry,
    currency: 'PHP' as const,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    onSaveNotes: vi.fn().mockResolvedValue(undefined),
    onQuote: vi.fn().mockResolvedValue(undefined),
    onFindCollision: vi.fn().mockResolvedValue(null),
    onMerge: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<PantryView {...props} />);
  return props;
}

const rowNames = () => screen.getAllByRole('article').map((card) => within(card).getByRole('heading', { level: 3 }).textContent);

describe('PantryView stock segment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('defaults to category sort with a heading per category', () => {
    renderView();
    expect(screen.getByRole('tab', { name: 'Stock' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Dairy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Produce' })).toBeInTheDocument();
    expect(rowNames()).toEqual(['butter', 'milk', 'Apples']);
  });

  it('switching sort reorders rows and persists the choice', async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(screen.getByLabelText('Sort pantry'), 'price');
    expect(rowNames()).toEqual(['butter', 'Apples', 'milk']);
    expect(window.localStorage.getItem('nutriplan.pantry.sort')).toBe('price');
    await user.selectOptions(screen.getByLabelText('Sort pantry'), 'name');
    expect(rowNames()).toEqual(['Apples', 'butter', 'milk']);
    expect(screen.queryByRole('heading', { name: 'Dairy' })).not.toBeInTheDocument();
  });

  it('Add item opens a sheet; a purchase calls onCreate', async () => {
    const user = userEvent.setup();
    const props = renderView();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const sheet = screen.getByRole('dialog', { name: 'Add pantry item' });
    await user.type(within(sheet).getByLabelText('Item'), 'Eggs');
    await user.click(within(sheet).getByRole('button', { name: 'Save item' }));
    expect(props.onCreate).toHaveBeenCalledWith(expect.objectContaining({ item: 'Eggs', amount: 1 }));
    expect(props.onQuote).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a quote calls onQuote with kind quote and never onCreate', async () => {
    const user = userEvent.setup();
    const props = renderView();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const sheet = screen.getByRole('dialog', { name: 'Add pantry item' });
    await user.type(within(sheet).getByLabelText('Item'), 'Rice');
    await user.clear(within(sheet).getByLabelText('Price'));
    await user.type(within(sheet).getByLabelText('Price'), '55');
    await user.selectOptions(within(sheet).getByLabelText('Entry type'), 'quote');
    await user.click(within(sheet).getByRole('button', { name: 'Save item' }));
    expect(props.onCreate).not.toHaveBeenCalled();
    expect(props.onQuote).toHaveBeenCalledWith(expect.objectContaining({ kind: 'quote', lines: [expect.objectContaining({ itemName: 'Rice', paidMinor: 5500 })] }));
  });

  it('editing into a collision asks to combine and merges on confirm', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderView({ onFindCollision: vi.fn().mockResolvedValue(pantry[0]) });
    await user.click(screen.getByRole('button', { name: 'Edit butter' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit pantry item' });
    expect(within(sheet).queryByLabelText('Entry type')).not.toBeInTheDocument();
    await user.clear(within(sheet).getByLabelText('Item'));
    await user.type(within(sheet).getByLabelText('Item'), 'milk');
    await user.click(within(sheet).getByRole('button', { name: 'Save item' }));
    expect(window.confirm).toHaveBeenCalledWith('milk already exists (1 units). Combine into one entry?');
    expect(props.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-butter', item: 'milk' }));
    expect(props.onMerge).toHaveBeenCalledWith('p-butter', 'p-milk');
  });

  it('declining the combine keeps the edit as a separate row', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = renderView({ onFindCollision: vi.fn().mockResolvedValue(pantry[0]) });
    await user.click(screen.getByRole('button', { name: 'Edit butter' }));
    await user.click(screen.getByRole('button', { name: 'Save item' }));
    expect(props.onUpdate).toHaveBeenCalled();
    expect(props.onMerge).not.toHaveBeenCalled();
  });

  it('Purchases segment loads lines from inventory on first open and opens receipts', async () => {
    const user = userEvent.setup();
    const listPurchaseLines = vi.fn().mockResolvedValue([{ observationId: 'o1', eventId: 'event-1', itemName: 'Eggs', quantity: '12', unit: 'each', paidMinor: 1200, currency: 'PHP', occurredOn: '2026-10-01', merchantName: 'SM' }]);
    const onOpenReceipt = vi.fn();
    renderView({ inventory: { listPurchaseLines } as never, onOpenReceipt });
    expect(listPurchaseLines).not.toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: 'Purchases' }));
    await user.click(await screen.findByRole('button', { name: /Eggs/ }));
    expect(onOpenReceipt).toHaveBeenCalledWith('event-1');
    expect(listPurchaseLines).toHaveBeenCalledTimes(1);
  });
});
