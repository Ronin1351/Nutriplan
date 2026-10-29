import { useEffect, useState } from 'react';
import { formatCurrency, type CurrencyCode } from '../../lib/currency';
import { groupReceiptsByYear } from '../../lib/receiptGroups';
import type { CategoryRule } from '../categories/categoryClassifier';
import { minorToMajor } from '../prices/pantryPriceAdapter';
import ReceiptScanner, { type ReceiptScannerMode } from '../receipt/ReceiptScanner';
import type { ReceiptDraft } from '../receipt/receiptParser';
import type { InventoryService, ReceiptDetail, ReceiptSummary } from '../pantry/pantryInventoryService';

interface ReceiptsViewProps {
  inventory: InventoryService;
  currency: CurrencyCode;
  categoryRules?: CategoryRule[];
  onSaveReceipt: (draft: ReceiptDraft) => Promise<void>;
  /** Called after a receipt or line is deleted so stock derived from it can be refreshed. */
  onChanged?: () => Promise<void> | void;
  openEventId?: string | null;
  onOpened?: () => void;
}

export default function ReceiptsView({ inventory, currency, categoryRules = [], onSaveReceipt, onChanged, openEventId, onOpened }: ReceiptsViewProps) {
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ReceiptScannerMode | null>(null);

  async function refresh() {
    try { setReceipts(await inventory.listReceipts()); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load receipt history.'); }
  }

  useEffect(() => { void refresh(); }, [inventory]);

  useEffect(() => {
    if (!openEventId) return;
    let cancelled = false;
    inventory.getReceipt(openEventId).then((detail) => { if (!cancelled) { setReceipt(detail); onOpened?.(); } }).catch(() => { if (!cancelled) onOpened?.(); });
    return () => { cancelled = true; };
  }, [openEventId, inventory, onOpened]);

  async function openReceipt(id: string) { setReceipt(await inventory.getReceipt(id)); }

  async function deleteReceipt(entry: ReceiptSummary) {
    if (!window.confirm('Delete this receipt and return its unconsumed stock?')) return;
    try { await inventory.deleteReceipt(entry.id, entry.revision); setReceipt(null); await refresh(); await onChanged?.(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete receipt.'); }
  }

  async function deleteLine(detail: ReceiptDetail, lineId: string, itemName: string) {
    if (!window.confirm(`Delete ${itemName} from this receipt?`)) return;
    try { await inventory.deleteReceiptLine(detail.id, lineId, detail.revision); setReceipt(await inventory.getReceipt(detail.id)); await refresh(); await onChanged?.(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete receipt line.'); }
  }

  const groups = groupReceiptsByYear(receipts);
  const money = (minor: number, code: string) => formatCurrency(minorToMajor(minor, code), currency);

  if (scannerMode) {
    return <section className="content-section"><ReceiptScanner mode={scannerMode} categoryRules={categoryRules} onSave={async (draft) => { await onSaveReceipt(draft); setScannerMode(null); await refresh(); }} onCancel={() => setScannerMode(null)} /></section>;
  }

  return (
    <section className="content-section">
      <div className="section-toolbar"><div><h2>Receipts</h2></div><div className="toolbar-actions dropdown">
        <button className="button primary" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Add receipt</button>
        {menuOpen && <div className="dropdown-menu" role="menu">
          <button role="menuitem" onClick={() => { setMenuOpen(false); setScannerMode('camera'); }}>Take photo</button>
          <button role="menuitem" onClick={() => { setMenuOpen(false); setScannerMode('upload'); }}>Upload photo</button>
        </div>}
      </div></div>
      {error && <p className="error-text" role="alert">{error}</p>}
      {receipt && <div className="form-panel receipt-detail">
        <div className="form-heading"><div><h3>{receipt.merchantName ?? 'Manual purchase'} · {receipt.occurredOn}</h3></div><button className="icon-button" onClick={() => setReceipt(null)} aria-label="Close receipt detail">×</button></div>
        <ul className="shopping-items">{receipt.lines.map((line) => <li key={line.id}><span><strong>{line.itemName}</strong><small>{line.quantity} {line.unit}</small></span><span><strong>{money(line.paidMinor, receipt.currency)}</strong><button className="text-button danger" onClick={() => void deleteLine(receipt, line.id, line.itemName)}>Delete line</button></span></li>)}</ul>
        <div className="form-actions"><button className="button secondary danger" onClick={() => void deleteReceipt(receipt)}>Delete receipt</button></div>
      </div>}
      {groups.length === 0 ? <div className="empty-state"><h3>No receipts yet</h3><p>Add a receipt to keep purchase history and stock in sync.</p></div> : groups.map((group, index) => <details key={group.year} className="year-group" open={index === 0}>
        <summary><span>{group.year}</span><span className="muted">{group.receipts.length} receipt{group.receipts.length === 1 ? '' : 's'} · {money(group.totalMinor, group.receipts[0].currency)}</span></summary>
        <ul className="shopping-items">{group.receipts.map((entry) => <li key={entry.id}>
          <button className="text-button" onClick={() => void openReceipt(entry.id)}><span><strong>{entry.merchantName ?? 'Manual purchase'}</strong><small>{entry.occurredOn}{entry.dateEstimated ? ' · estimated date' : ''} · {entry.lineCount} item{entry.lineCount === 1 ? '' : 's'} · {money(entry.totalMinor, entry.currency)}</small></span></button>
          <button className="text-button danger" onClick={() => void deleteReceipt(entry)}>Delete</button>
        </li>)}</ul>
      </details>)}
    </section>
  );
}
