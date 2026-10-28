import { useEffect, useState } from 'react';
import { applyCategories } from '../categories/applyCategories';
import { PANTRY_CATEGORIES, type PantryCategory } from '../../types/domain';
import type { CategoryRule } from '../categories/categoryClassifier';
import { isReceiptItemPriceConsistent, orderReceiptFragments, parseReceiptRows, type ReceiptDraft } from './receiptParser';
import { createReceiptOcrWorkerController, type ReceiptOcrController } from './receiptOcr';

interface ReceiptScannerProps {
  ocr?: ReceiptOcrController;
  categoryRules?: CategoryRule[];
  onSave: (draft: ReceiptDraft) => Promise<void>;
  onCancel: () => void;
}

type ScannerState = 'idle' | 'preparing' | 'reading' | 'review' | 'empty' | 'error';

export default function ReceiptScanner({ ocr: providedOcr, categoryRules = [], onSave, onCancel }: ReceiptScannerProps) {
  const [ocr, setOcr] = useState<ReceiptOcrController | null>(null);
  const [state, setState] = useState<ScannerState>('idle');
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const controller = providedOcr ?? createReceiptOcrWorkerController();
    setOcr(controller);
    return () => {
      if (!providedOcr) controller.dispose();
    };
  }, [providedOcr]);

  useEffect(() => {
    if (!startedAt || (state !== 'preparing' && state !== 'reading')) return;
    const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, state]);

  async function readReceipt(file: File) {
    if (!ocr) return;
    setError(null);
    setState('preparing');
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    try {
      const result = await ocr.run(file, (phase) => setState(phase === 'initializing' ? 'preparing' : 'reading'));
      const parsed = applyCategories(parseReceiptRows(orderReceiptFragments(result.fragments)), categoryRules);
      setDraft({ ...parsed, rawRows: parsed.rawRows.length ? parsed.rawRows : result.rawText ? [result.rawText] : [] });
      setState(parsed.items.length || result.rawText ? 'review' : 'empty');
    } catch (cause) {
      if (cause instanceof Error && 'code' in cause && (cause as { code?: string }).code === 'cancelled') return;
      setError(cause instanceof Error ? cause.message : 'Receipt OCR failed.');
      setState('error');
    } finally {
      setStartedAt(null);
    }
  }

  function cancel() {
    ocr?.cancel();
    onCancel();
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  }

  function handleImageSelection(file: File | undefined) {
    if (file) void readReceipt(file);
  }

  return <section className="form-panel receipt-scanner" aria-live="polite">
    <div className="form-heading"><div><p className="section-kicker">Private on-device OCR</p><h2>{state === 'review' ? 'Review receipt' : 'Scan receipt'}</h2></div><button className="icon-button" aria-label="Close receipt scanner" onClick={cancel}>×</button></div>
    {state === 'idle' && <div className="receipt-upload"><p className="muted">Take a clear receipt photo or choose one from your device. It stays on this device while PaddleOCR reads it.</p><div className="receipt-upload-actions"><label className="button primary" htmlFor="receipt-camera">Take photo</label><label className="button secondary" htmlFor="receipt-image">Choose image</label></div><input id="receipt-camera" aria-label="Take receipt photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => handleImageSelection(event.target.files?.[0])} /><input id="receipt-image" aria-label="Receipt image" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => handleImageSelection(event.target.files?.[0])} /></div>}
    {(state === 'preparing' || state === 'reading') && <div className="state-panel receipt-progress" role="status" aria-live="polite" aria-busy="true"><span className="loading-dot" aria-hidden="true" /><h3>{state === 'preparing' ? 'Preparing OCR…' : 'Reading receipt…'}</h3><p>Running locally in a background worker. Elapsed: {elapsedSeconds}s.</p>{elapsedSeconds >= 90 ? <p className="validation-errors">This is taking longer than expected. Cancel and retry with a tighter, brighter receipt crop.</p> : elapsedSeconds >= 8 && <p className="muted">Still working — receipt OCR can take longer on the first run while the local model warms up.</p>}<button className="button secondary" onClick={cancel}>Cancel scan</button></div>}
    {state === 'error' && <div className="validation-errors" role="alert">{error}</div>}
    {state === 'empty' && <div className="empty-state"><h3>No readable text found</h3><p>Try a brighter, flatter photo with the receipt filling the frame.</p></div>}
    {draft && (state === 'review' || state === 'empty') && <div className="receipt-review">
      <div className="receipt-summary"><label><span>Merchant</span><input aria-label="Merchant" value={draft.merchant} onChange={(event) => setDraft({ ...draft, merchant: event.target.value })} /></label><label className="receipt-total-field"><span>Receipt total</span><div className="money-input"><span aria-hidden="true">₱</span><input aria-label="Receipt total" type="number" min="0" step="0.01" value={draft.total ?? ''} onChange={(event) => setDraft({ ...draft, total: event.target.value ? Number(event.target.value) : null })} /></div></label></div>
      <div className="receipt-items"><div className="receipt-items-title"><div><h3>Detected items</h3><p className="muted">Check each line before saving it to your pantry.</p></div><span className="receipt-count">{draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}</span></div>{draft.items.length === 0 ? <p className="muted">No item rows were confidently detected. Use the OCR text below to recover them manually.</p> : <><div className="receipt-item-header" aria-hidden="true"><span>Item</span><span>Category</span><span>Qty</span><span>Unit price</span><span>Line total</span></div>{draft.items.map((item, index) => <div className="receipt-item-editor" key={`${item.name}-${index}`}><span className="receipt-row-number" aria-hidden="true">{index + 1}</span><label><span className="sr-only">Item {index + 1}</span><input aria-label={`Item ${index + 1}`} value={item.name} onChange={(event) => setDraft({ ...draft, items: draft.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry) })} /></label><label><span className="sr-only">Category {index + 1}</span><select className={item.category === 'Uncategorized' ? 'needs-category' : undefined} aria-label={`Category ${index + 1}`} value={item.category ?? 'Uncategorized'} onChange={(event) => setDraft({ ...draft, items: draft.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, category: event.target.value as PantryCategory } : entry) })}>{PANTRY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label><span className="sr-only">Quantity {index + 1}</span><input aria-label={`Quantity ${index + 1}`} type="number" min="0.01" step="0.001" value={item.quantity} onChange={(event) => setDraft({ ...draft, items: draft.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry) })} /></label><label><span className="sr-only">Unit price {index + 1}</span><div className="money-input"><span aria-hidden="true">₱</span><input aria-label={`Unit price ${index + 1}`} type="number" min="0" step="0.01" value={item.unitPrice ?? Number((item.totalPrice / item.quantity).toFixed(2))} onChange={(event) => setDraft({ ...draft, items: draft.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, unitPrice: Number(event.target.value) } : entry) })} /></div></label><label><span className="sr-only">Total {index + 1}</span><div className="money-input"><span aria-hidden="true">₱</span><input aria-label={`Total ${index + 1}`} type="number" min="0" step="0.01" value={item.totalPrice} onChange={(event) => setDraft({ ...draft, items: draft.items.map((entry, entryIndex) => entryIndex === index ? { ...entry, totalPrice: Number(event.target.value) } : entry) })} /></div>{item.unitPrice !== undefined && !isReceiptItemPriceConsistent(item) && <span className="receipt-price-warning">Check math</span>}</label></div>)}</>}</div>
      <label>OCR text<textarea aria-label="OCR text" rows={5} value={draft.rawRows.join('\n')} onChange={(event) => setDraft({ ...draft, rawRows: event.target.value.split('\n') })} /></label>
      <div className="form-actions"><button className="button secondary" onClick={cancel}>Cancel</button><button className="button primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save receipt'}</button></div>
    </div>}
    {(state === 'error' || state === 'empty') && <div className="form-actions"><button className="button secondary" onClick={cancel}>Cancel</button><label className="button primary" htmlFor="receipt-camera-retry">Take another photo</label><label className="button secondary" htmlFor="receipt-image-retry">Choose another image</label><input id="receipt-camera-retry" aria-label="Take another receipt photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => handleImageSelection(event.target.files?.[0])} /><input id="receipt-image-retry" aria-label="Choose another receipt image" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => handleImageSelection(event.target.files?.[0])} /></div>}
  </section>;
}
