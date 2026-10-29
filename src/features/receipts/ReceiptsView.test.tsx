import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReceiptsView from './ReceiptsView';
import type { InventoryService, ReceiptDetail, ReceiptSummary } from '../pantry/pantryInventoryService';

const summary = (id: string, occurredOn: string, totalMinor: number, merchantName = 'SM'): ReceiptSummary => ({ id, merchantName, occurredOn, dateEstimated: false, currency: 'PHP', lineCount: 1, totalMinor, revision: 0 });
const receipts = [summary('r-2025', '2025-06-01', 1000), summary('r-2026a', '2026-01-10', 2500), summary('r-2026b', '2026-03-05', 500, 'Robinsons')];

function inventory(overrides: Partial<InventoryService> = {}): InventoryService {
  const detail: ReceiptDetail = { ...receipts[2], lines: [{ id: 'obs-1', eventId: 'r-2026b', itemId: 'i', lineId: 'l', ordinal: 0, quantity: '1', unit: 'each', paidMinor: 500, packageQuantity: null, packageUnit: null, revision: 0, itemName: 'Milk' }] };
  return {
    listReceipts: vi.fn().mockResolvedValue(receipts),
    getReceipt: vi.fn().mockImplementation(async (id: string) => id === 'r-2026b' ? detail : null),
    deleteReceipt: vi.fn().mockResolvedValue(undefined),
    deleteReceiptLine: vi.fn().mockResolvedValue(undefined),
    listPurchaseLines: vi.fn().mockResolvedValue([]),
    listCurrentStock: vi.fn().mockResolvedValue([]),
    consumeIngredients: vi.fn(),
    consumeRecipe: vi.fn(),
    ...overrides,
  };
}

describe('ReceiptsView', () => {
  it('groups receipts by year, newest first, with only the newest year open', async () => {
    render(<ReceiptsView inventory={inventory()} currency="PHP" onSaveReceipt={vi.fn()} />);
    const groups = await screen.findAllByRole('group');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('2026');
    expect(groups[0]).toHaveTextContent('2 receipts');
    expect(groups[0]).toHaveTextContent('₱30.00');
    expect(groups[0]).toHaveAttribute('open');
    expect(groups[1]).toHaveTextContent('2025');
    expect(groups[1]).not.toHaveAttribute('open');
    expect(within(groups[0]).getAllByRole('listitem')[0]).toHaveTextContent('Robinsons');
  });

  it('Add receipt menu offers Take photo and Upload photo and mounts the scanner', async () => {
    const user = userEvent.setup();
    render(<ReceiptsView inventory={inventory()} currency="PHP" onSaveReceipt={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Add receipt' }));
    expect(screen.getByRole('menuitem', { name: 'Take photo' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Upload photo' }));
    expect(screen.getByRole('heading', { name: 'Scan receipt' })).toBeInTheDocument();
    expect(screen.getByLabelText('Receipt image')).toBeInTheDocument();
  });

  it('opens the receipt named by openEventId on mount and reports it', async () => {
    const onOpened = vi.fn();
    render(<ReceiptsView inventory={inventory()} currency="PHP" onSaveReceipt={vi.fn()} openEventId="r-2026b" onOpened={onOpened} />);
    expect(await screen.findByRole('heading', { name: /Robinsons · 2026-03-05/ })).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(onOpened).toHaveBeenCalled();
  });

  it('deleting a receipt asks for confirmation then calls the service', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const service = inventory();
    render(<ReceiptsView inventory={service} currency="PHP" onSaveReceipt={vi.fn()} />);
    await screen.findAllByRole('group');
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(service.deleteReceipt).toHaveBeenCalledWith('r-2026b', 0);
    vi.restoreAllMocks();
  });
});
