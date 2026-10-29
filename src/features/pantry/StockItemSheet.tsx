import { useEffect, useState } from 'react';
import type { NewPantryItem, PantryItem } from '../../types/domain';

export type StockEntryType = 'purchase' | 'quote';

interface StockItemSheetProps {
  open: boolean;
  initial?: PantryItem | null;
  onSubmit: (value: { item: NewPantryItem | PantryItem; entryType: StockEntryType }) => Promise<void>;
  onClose: () => void;
}

const UNITS = ['units', 'each', 'cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'L', 'oz', 'lb'];
const emptyForm: NewPantryItem = { userId: 'personal-user', item: '', amount: 1, unit: 'units', price: 0, expirationDate: null, category: 'Uncategorized', notes: null, isActive: true };

export default function StockItemSheet({ open, initial, onSubmit, onClose }: StockItemSheetProps) {
  const [form, setForm] = useState<NewPantryItem | PantryItem>(emptyForm);
  const [entryType, setEntryType] = useState<StockEntryType>('purchase');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial);

  useEffect(() => { if (open) { setForm(initial ?? emptyForm); setEntryType('purchase'); } }, [open, initial]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.item.trim() || form.amount <= 0 || form.price < 0) return;
    setSaving(true);
    try { await onSubmit({ item: { ...form, item: form.item.trim() }, entryType }); onClose(); } finally { setSaving(false); }
  }

  const title = editing ? 'Edit pantry item' : 'Add pantry item';
  return <div className="sheet-backdrop" onClick={onClose}>
    <form className="sheet quick-form" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} onSubmit={submit}>
      <div className="form-heading"><h3>{title}</h3><button type="button" className="icon-button" aria-label="Close" onClick={onClose}>×</button></div>
      <div className="form-grid">
        <label>Item<input value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} autoFocus /></label>
        <label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} /></label>
        <label>Unit<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
        <label>Price<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
      </div>
      <div className="form-grid">
        <label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
        <label>Expiration<input type="date" value={form.expirationDate ?? ''} onChange={(event) => setForm({ ...form, expirationDate: event.target.value || null })} /></label>
        {!editing && <label>Entry type<select value={entryType} onChange={(event) => setEntryType(event.target.value as StockEntryType)}><option value="purchase">Purchase (adds stock)</option><option value="quote">Quote (price history only)</option></select></label>}
      </div>
      <button className="button primary full-width" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button>
    </form>
  </div>;
}
