import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PantryPurchasesList from './PantryPurchasesList';
import type { PurchaseLine } from './pantryInventoryService';

const line = (overrides: Partial<PurchaseLine>): PurchaseLine => ({ observationId: overrides.itemName ?? 'o', eventId: 'e', itemName: 'x', quantity: '1', unit: 'each', paidMinor: 0, currency: 'PHP', occurredOn: '2026-01-01', merchantName: null, ...overrides });
const lines = [
  line({ itemName: 'Eggs', paidMinor: 1200, quantity: '12', occurredOn: '2026-10-01', merchantName: 'SM', eventId: 'event-sm' }),
  line({ itemName: 'Milk', paidMinor: 900, occurredOn: '2026-10-05', merchantName: 'Robinsons', eventId: 'event-rob' }),
];

describe('PantryPurchasesList', () => {
  it('renders each line with merchant, quantity and formatted price, newest first', () => {
    render(<PantryPurchasesList lines={lines} currency="PHP" onOpenReceipt={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Milk');
    expect(rows[0]).toHaveTextContent('Robinsons');
    expect(rows[0]).toHaveTextContent('₱9.00');
    expect(rows[1]).toHaveTextContent('12 each');
  });

  it('search filters by merchant', async () => {
    const user = userEvent.setup();
    render(<PantryPurchasesList lines={lines} currency="PHP" onOpenReceipt={vi.fn()} />);
    await user.type(screen.getByLabelText('Search purchases'), 'robin');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('Milk');
  });

  it('sort by item reorders A–Z', async () => {
    const user = userEvent.setup();
    render(<PantryPurchasesList lines={lines} currency="PHP" onOpenReceipt={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Sort purchases'), 'item');
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Eggs');
  });

  it('clicking a line opens its receipt', async () => {
    const user = userEvent.setup();
    const onOpenReceipt = vi.fn();
    render(<PantryPurchasesList lines={lines} currency="PHP" onOpenReceipt={onOpenReceipt} />);
    await user.click(screen.getByRole('button', { name: /Eggs/ }));
    expect(onOpenReceipt).toHaveBeenCalledWith('event-sm');
  });

  it('shows an empty state when there are no purchases', () => {
    render(<PantryPurchasesList lines={[]} currency="PHP" onOpenReceipt={vi.fn()} />);
    expect(screen.getByText('No purchases recorded yet.')).toBeInTheDocument();
  });
});
