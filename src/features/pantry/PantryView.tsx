import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../../lib/currency';
import { getExpirationStatus } from '../../lib/pantry';
import type { NewPantryItem, PantryItem } from '../../types/domain';
import type { PriceStore } from '../prices/types';
import ItemDetailPanel from '../prices/ItemDetailPanel';
import PriceCaptureForm from '../prices/PriceCaptureForm';
import type { InventoryService, ReceiptDetail, ReceiptSummary } from './pantryInventoryService';

interface PantryViewProps {
  pantry: PantryItem[];
  currency: Parameters<typeof formatCurrency>[1];
  onCreate: (item: NewPantryItem) => Promise<void>;
  onUpdate: (item: PantryItem) => Promise<void>;
  onRemove: (id: string | number) => Promise<void>;
  onSaveNotes: (id: string | number, notes: string | null) => Promise<void>;
  priceStore?: PriceStore;
  onPricesSaved?: () => Promise<void>;
  inventory?: InventoryService;
}

const emptyForm: NewPantryItem = { userId: 'personal-user', item: '', amount: 1, unit: 'units', price: 0, expirationDate: null, category: 'Uncategorized', notes: null, isActive: true };

export default function PantryView({ pantry, currency, onCreate, onUpdate, onRemove, onSaveNotes, priceStore, onPricesSaved, inventory }: PantryViewProps) {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<NewPantryItem>(emptyForm);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [notesId, setNotesId] = useState<string | number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [recordingPrice, setRecordingPrice] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const filtered = useMemo(() => pantry.filter((item) => item.item.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase())), [pantry, query]);

  async function refreshReceipts() {
    if (!inventory) return;
    try { setReceipts(await inventory.listReceipts()); setReceiptError(null); } catch (error) { setReceiptError(error instanceof Error ? error.message : 'Unable to load receipt history.'); }
  }

  useEffect(() => { void refreshReceipts(); }, [inventory]);

  function startEdit(item: PantryItem) {
    setEditingId(item.id);
    setForm(item);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.item.trim() || form.amount <= 0 || form.price < 0) return;
    setSaving(true);
    try {
      if (editingId !== null) await onUpdate({ ...form, id: editingId, item: form.item.trim() });
      else await onCreate({ ...form, item: form.item.trim() });
      setForm(emptyForm);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-section">
      <div className="section-toolbar"><div><p className="section-kicker">What you have</p><h2>Pantry</h2></div><div className="toolbar-actions"><div className="pantry-total">{formatCurrency(pantry.filter((item) => item.isActive).reduce((sum, item) => sum + item.amount * item.price, 0), currency)}</div>{priceStore && <button className="button secondary" onClick={() => setRecordingPrice(true)}>Record price</button>}</div></div>
      {recordingPrice && priceStore && <PriceCaptureForm store={priceStore} currency={currency} onSaved={async () => { await onPricesSaved?.(); await refreshReceipts(); }} onCancel={() => setRecordingPrice(false)} />}
      <form className="quick-form" onSubmit={submit}><div className="form-heading"><h3>{editingId === null ? 'Add pantry item' : 'Edit pantry item'}</h3>{editingId !== null && <button type="button" className="text-button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel edit</button>}</div><div className="form-grid"><label>Item<input aria-label="Pantry item" value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} /></label><label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} /></label><label>Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>units</option><option>each</option><option>cup</option><option>tbsp</option><option>tsp</option><option>g</option><option>kg</option><option>ml</option><option>L</option><option>oz</option><option>lb</option></select></label><label>Price<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label></div><div className="form-grid"><label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label><label>Expiration<input type="date" value={form.expirationDate ?? ''} onChange={(event) => setForm({ ...form, expirationDate: event.target.value || null })} /></label></div><button className="button primary full-width" disabled={saving}>{saving ? 'Saving…' : editingId === null ? 'Add item' : 'Update item'}</button></form>
      <label className="search-field">Search pantry<input aria-label="Search pantry" placeholder="Search items or categories" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {selectedId !== null && priceStore ? <ItemDetailPanel item={pantry.find((entry) => entry.id === selectedId)!} store={priceStore} currency={currency} onClose={() => setSelectedId(null)} /> : pantry.length === 0 ? <div className="empty-state"><span>◌</span><h3>Your pantry is empty</h3><p>Add ingredients to compare stock with your recipes.</p></div> : filtered.length === 0 ? <div className="empty-state"><h3>No pantry items match your search.</h3></div> : <div className="pantry-list">{filtered.map((item) => { const expiration = getExpirationStatus(item.expirationDate); return <article className="pantry-card" key={item.id}><button className="pantry-card-opener" onClick={() => priceStore && setSelectedId(item.id)}><div className="pantry-card-top"><div><p className="card-category">{item.category}</p><h3>{item.item}</h3></div><strong>{formatCurrency(item.amount * item.price, currency)}</strong></div><div className="pantry-meta"><span>{item.amount} {item.unit}</span><span>{formatCurrency(item.price, currency)} / {item.unit}</span>{expiration.label && <span className={expiration.urgent ? 'warning-text' : 'muted'}>{expiration.label}</span>}</div></button><div className="card-actions"><button className="text-button" onClick={() => startEdit(item)}>Edit</button><button className="text-button" aria-label={`Edit notes for ${item.item}`} onClick={() => { setNotesId(item.id); setNotes(item.notes ?? ''); }}>Notes</button><button className="text-button danger" onClick={() => void onRemove(item.id)}>Remove</button></div>{notesId === item.id && <div className="notes-editor"><label>Notes for {item.item}<textarea aria-label={`Notes for ${item.item}`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="form-actions"><button className="button secondary" onClick={() => setNotesId(null)}>Cancel</button><button className="button primary" onClick={async () => { await onSaveNotes(item.id, notes.trim() || null); setNotesId(null); }}>Save notes</button></div></div>}</article>; })}</div>}
      {inventory && <section className="receipt-log"><div className="section-toolbar"><div><p className="section-kicker">Purchase history</p><h3>Receipt log</h3></div></div>{receiptError && <p className="error-text" role="alert">{receiptError}</p>}{receipts.length === 0 ? <p className="empty-inline">No saved receipts yet.</p> : <ul className="shopping-items">{receipts.map((entry) => <li key={entry.id}><button className="text-button" onClick={async () => setReceipt(await inventory.getReceipt(entry.id))}><span><strong>{entry.merchantName ?? 'Manual purchase'}</strong><small>{entry.occurredOn}{entry.dateEstimated ? ' · estimated date' : ''} · {entry.lineCount} item{entry.lineCount === 1 ? '' : 's'}</small></span></button><button className="text-button danger" onClick={async () => { if (!window.confirm('Delete this receipt and return its unconsumed stock?')) return; try { await inventory.deleteReceipt(entry.id, entry.revision); setReceipt(null); await refreshReceipts(); await onPricesSaved?.(); } catch (error) { setReceiptError(error instanceof Error ? error.message : 'Unable to delete receipt.'); } }}>Delete</button></li>)}</ul>}{receipt && <div className="form-panel"><div className="form-heading"><div><p className="section-kicker">Receipt detail</p><h3>{receipt.merchantName ?? 'Manual purchase'} · {receipt.occurredOn}</h3></div><button className="icon-button" onClick={() => setReceipt(null)} aria-label="Close receipt detail">×</button></div><ul className="shopping-items">{receipt.lines.map((line) => <li key={line.id}><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unit}</small></span><span><strong>{formatCurrency(line.paidMinor / (receipt.currency.toUpperCase() === 'JPY' ? 1 : 100), currency)}</strong><button className="text-button danger" onClick={async () => { if (!window.confirm(`Delete ${line.itemName} from this receipt?`)) return; try { await inventory.deleteReceiptLine(receipt.id, line.id, receipt.revision); setReceipt(await inventory.getReceipt(receipt.id)); await refreshReceipts(); await onPricesSaved?.(); } catch (error) { setReceiptError(error instanceof Error ? error.message : 'Unable to delete receipt line.'); } }}>Delete line</button></span></li>)}</ul></div>}</section>}
    </section>
  );
}
