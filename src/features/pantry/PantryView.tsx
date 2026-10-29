import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, type CurrencyCode } from '../../lib/currency';
import type { PantrySort } from '../../lib/pantrySort';
import type { NewPantryItem, PantryItem } from '../../types/domain';
import type { PriceCapture, PriceStore } from '../prices/types';
import { toMinorUnits } from '../prices/priceMath';
import ItemDetailPanel from '../prices/ItemDetailPanel';
import PantryPurchasesList from './PantryPurchasesList';
import PantryStockList from './PantryStockList';
import StockItemSheet from './StockItemSheet';
import type { InventoryService, PurchaseLine } from './pantryInventoryService';

export type PantrySegment = 'stock' | 'purchases';

interface PantryViewProps {
  pantry: PantryItem[];
  currency: CurrencyCode;
  onCreate: (item: NewPantryItem) => Promise<void>;
  onUpdate: (item: PantryItem) => Promise<void>;
  onRemove: (id: string | number) => Promise<void>;
  onSaveNotes: (id: string | number, notes: string | null) => Promise<void>;
  onQuote: (capture: PriceCapture) => Promise<void>;
  onFindCollision: (item: PantryItem) => Promise<PantryItem | null>;
  onMerge: (sourceId: string, targetId: string) => Promise<void>;
  onOpenReceipt?: (eventId: string) => void;
  priceStore?: PriceStore;
  inventory?: InventoryService;
  initialSegment?: PantrySegment;
}

const SORT_KEY = 'nutriplan.pantry.sort';
const SORTS: PantrySort[] = ['category', 'name', 'price'];

function loadSort(): PantrySort {
  try { const saved = window.localStorage.getItem(SORT_KEY) as PantrySort | null; return saved && SORTS.includes(saved) ? saved : 'category'; } catch { return 'category'; }
}

export default function PantryView({ pantry, currency, onCreate, onUpdate, onRemove, onSaveNotes, onQuote, onFindCollision, onMerge, onOpenReceipt, priceStore, inventory, initialSegment = 'stock' }: PantryViewProps) {
  const [segment, setSegment] = useState<PantrySegment>(initialSegment);
  const [sort, setSort] = useState<PantrySort>(loadSort);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<PantryItem | null>(null);
  const [notesId, setNotesId] = useState<string | number | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [purchases, setPurchases] = useState<PurchaseLine[] | null>(null);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);

  useEffect(() => { setPurchases(null); }, [pantry]);

  useEffect(() => {
    if (segment !== 'purchases' || purchases !== null || !inventory) return;
    let cancelled = false;
    inventory.listPurchaseLines().then((lines) => { if (!cancelled) setPurchases(lines); }).catch((error: unknown) => { if (!cancelled) setPurchasesError(error instanceof Error ? error.message : 'Unable to load purchases.'); });
    return () => { cancelled = true; };
  }, [segment, purchases, inventory]);
  const filtered = useMemo(() => pantry.filter((item) => item.item.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase())), [pantry, query]);
  const total = pantry.filter((item) => item.isActive).reduce((sum, item) => sum + item.amount * item.price, 0);

  function changeSort(next: PantrySort) {
    setSort(next);
    try { window.localStorage.setItem(SORT_KEY, next); } catch { /* storage unavailable */ }
  }

  async function submitSheet({ item, entryType }: { item: NewPantryItem | PantryItem; entryType: 'purchase' | 'quote' }) {
    if ('id' in item) {
      const collision = await onFindCollision(item);
      await onUpdate(item);
      if (collision && window.confirm(`${item.item} already exists (${collision.amount} ${collision.unit}). Combine into one entry?`)) await onMerge(String(item.id), String(collision.id));
      return;
    }
    if (entryType === 'quote') {
      const today = new Date().toISOString().slice(0, 10);
      await onQuote({ operationId: `manual-${crypto.randomUUID()}`, kind: 'quote', source: 'manual', occurredOn: today, dateEstimated: false, capturedAt: new Date().toISOString(), currency, merchantName: null, receiptNumber: null, lines: [{ lineId: `manual-line-${crypto.randomUUID()}`, ordinal: 0, itemName: item.item, quantity: String(item.amount), unit: item.unit, paidMinor: toMinorUnits(String(item.price), currency), packageQuantity: null, packageUnit: null }] });
      return;
    }
    await onCreate(item);
  }

  const selected = selectedId !== null ? pantry.find((entry) => entry.id === selectedId) : undefined;

  return (
    <section className="content-section">
      <div className="section-toolbar"><div><h2>Pantry</h2></div><div className="toolbar-actions"><div className="pantry-total">{formatCurrency(total, currency)}</div><button className="button primary" onClick={() => { setEditing(null); setSheetOpen(true); }}>Add item</button></div></div>
      <div className="segment-control" role="tablist" aria-label="Pantry sections">
        <button role="tab" aria-selected={segment === 'stock'} className={segment === 'stock' ? 'active' : ''} onClick={() => setSegment('stock')}>Stock</button>
        <button role="tab" aria-selected={segment === 'purchases'} className={segment === 'purchases' ? 'active' : ''} onClick={() => setSegment('purchases')}>Purchases</button>
      </div>
      {segment === 'purchases' ? (purchasesError ? <p className="error-text" role="alert">{purchasesError}</p> : purchases === null ? <p className="empty-inline">Loading purchases…</p> : <PantryPurchasesList lines={purchases} currency={currency} onOpenReceipt={(eventId) => onOpenReceipt?.(eventId)} />) : selected && priceStore ? <ItemDetailPanel item={selected} store={priceStore} currency={currency} onClose={() => setSelectedId(null)} /> : <>
        <div className="list-controls">
          <label className="search-field">Search pantry<input aria-label="Search pantry" placeholder="Search items or categories" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="sort-control">Sort<select aria-label="Sort pantry" value={sort} onChange={(event) => changeSort(event.target.value as PantrySort)}><option value="category">Category</option><option value="name">A–Z</option><option value="price">Price</option></select></label>
        </div>
        {pantry.length === 0 ? <div className="empty-state"><h3>Your pantry is empty</h3><p>Add an item or scan a receipt to start tracking what you have.</p></div> : filtered.length === 0 ? <div className="empty-state"><h3>No pantry items match your search.</h3></div> : <PantryStockList items={filtered} sort={sort} currency={currency} canOpen={Boolean(priceStore)} notesId={notesId} notes={notes} onOpen={(item) => setSelectedId(item.id)} onEdit={(item) => { setEditing(item); setSheetOpen(true); }} onNotes={(item) => { setNotesId(item.id); setNotes(item.notes ?? ''); }} onNotesChange={setNotes} onNotesCancel={() => setNotesId(null)} onNotesSave={async (item) => { await onSaveNotes(item.id, notes.trim() || null); setNotesId(null); }} onRemove={onRemove} />}
      </>}
      <StockItemSheet open={sheetOpen} initial={editing} onSubmit={submitSheet} onClose={() => { setSheetOpen(false); setEditing(null); }} />
    </section>
  );
}
