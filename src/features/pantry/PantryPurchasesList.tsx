import { useMemo, useState } from 'react';
import { formatCurrency, type CurrencyCode } from '../../lib/currency';
import { sortPurchases, type PurchaseSort } from '../../lib/pantrySort';
import { minorToMajor } from '../prices/pantryPriceAdapter';
import type { PurchaseLine } from './pantryInventoryService';

interface PantryPurchasesListProps {
  lines: PurchaseLine[];
  currency: CurrencyCode;
  onOpenReceipt: (eventId: string) => void;
}

export default function PantryPurchasesList({ lines, currency, onOpenReceipt }: PantryPurchasesListProps) {
  const [sort, setSort] = useState<PurchaseSort>('date');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? lines.filter((line) => line.itemName.toLowerCase().includes(needle) || (line.merchantName ?? '').toLowerCase().includes(needle)) : lines;
    return sortPurchases(filtered, sort);
  }, [lines, query, sort]);

  if (lines.length === 0) return <div className="empty-state"><h3>No purchases recorded yet.</h3><p>Scan a receipt or add a purchase to see every line you have paid for.</p></div>;

  return <div className="purchases">
    <div className="list-controls">
      <label className="search-field">Search purchases<input aria-label="Search purchases" placeholder="Search items or merchants" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="sort-control">Sort<select aria-label="Sort purchases" value={sort} onChange={(event) => setSort(event.target.value as PurchaseSort)}><option value="date">Date</option><option value="item">Item A–Z</option><option value="price">Price</option></select></label>
    </div>
    {visible.length === 0 ? <div className="empty-state"><h3>No purchases match your search.</h3></div> : <ul className="shopping-items">
      {visible.map((line) => <li key={line.observationId}>
        <button className="purchase-row" onClick={() => onOpenReceipt(line.eventId)}>
          <span><strong>{line.itemName}</strong><small>{line.quantity} {line.unit} · {line.merchantName ?? 'Manual purchase'} · {line.occurredOn}</small></span>
          <strong>{formatCurrency(minorToMajor(line.paidMinor, line.currency), currency)}</strong>
        </button>
      </li>)}
    </ul>}
  </div>;
}
