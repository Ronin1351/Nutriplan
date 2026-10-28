import { useState } from 'react';
import { toMinorUnits } from './priceMath';
import type { PriceCapture, PriceStore } from './types';

export default function PriceCaptureForm({ store, currency, onSaved, onCancel }: { store: PriceStore; currency: string; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('each');
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<'purchase' | 'quote'>('purchase');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    try {
      const capture: PriceCapture = { operationId: `manual-${crypto.randomUUID()}`, kind, source: 'manual', occurredOn, dateEstimated: false, capturedAt: new Date().toISOString(), currency, merchantName: null, receiptNumber: null, lines: [{ lineId: `manual-line-${crypto.randomUUID()}`, ordinal: 0, itemName: itemName.trim(), quantity, unit, paidMinor: toMinorUnits(price, currency), packageQuantity: null, packageUnit: null }] };
      if (!itemName.trim() || !quantity.trim()) throw new Error('Enter an item and quantity.');
      await store.saveCapture(capture); setSaving(true); await onSaved(); onCancel();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save price.'); setSaving(false); }
  }
  return <form className="quick-form price-capture-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><h3>Record a price</h3><button type="button" className="text-button" onClick={onCancel}>Cancel</button></div>{error && <p className="validation-errors" role="alert">{error}</p>}<div className="form-grid"><label>Item<input aria-label="Price item" value={itemName} onChange={(event) => setItemName(event.target.value)} required /></label><label>Price<input aria-label="Observed price" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>Quantity<input aria-label="Observed quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label>Unit<select aria-label="Observed unit" value={unit} onChange={(event) => setUnit(event.target.value)}><option>each</option><option>units</option><option>g</option><option>kg</option><option>ml</option><option>L</option></select></label><label>Date<input aria-label="Observed date" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required /></label><label>Entry type<select aria-label="Entry type" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="purchase">Purchase (adds stock)</option><option value="quote">Quote (history only)</option></select></label></div><button className="button primary full-width" disabled={saving}>{saving ? 'Saving…' : 'Save price'}</button></form>;
}
