import { formatCurrency } from '../../lib/currency';
import { getExpirationStatus } from '../../lib/pantry';
import { groupByCategory, sortPantry, type PantrySort } from '../../lib/pantrySort';
import type { PantryItem } from '../../types/domain';

interface PantryStockListProps {
  items: PantryItem[];
  sort: PantrySort;
  currency: Parameters<typeof formatCurrency>[1];
  canOpen: boolean;
  notesId: string | number | null;
  notes: string;
  onOpen: (item: PantryItem) => void;
  onEdit: (item: PantryItem) => void;
  onNotes: (item: PantryItem) => void;
  onNotesChange: (value: string) => void;
  onNotesCancel: () => void;
  onNotesSave: (item: PantryItem) => Promise<void>;
  onRemove: (id: string | number) => Promise<void>;
}

export default function PantryStockList({ items, sort, currency, canOpen, notesId, notes, onOpen, onEdit, onNotes, onNotesChange, onNotesCancel, onNotesSave, onRemove }: PantryStockListProps) {
  const sorted = sortPantry(items, sort);
  const groups = sort === 'category' ? groupByCategory(sorted) : [{ category: null, items: sorted }];
  return <div className="pantry-list">
    {groups.map((group) => <section key={group.category ?? 'all'} className="pantry-group">
      {group.category !== null && <h3 className="category-header">{group.category}</h3>}
      {group.items.map((item) => {
        const expiration = getExpirationStatus(item.expirationDate);
        return <article className="pantry-card" key={item.id}>
          <button className="pantry-card-opener" onClick={() => canOpen && onOpen(item)}>
            <div className="pantry-card-top"><div><p className="card-category">{item.category}</p><h3>{item.item}</h3></div><strong>{formatCurrency(item.amount * item.price, currency)}</strong></div>
            <div className="pantry-meta"><span>{item.amount} {item.unit}</span><span>{formatCurrency(item.price, currency)} / {item.unit}</span>{expiration.label && <span className={expiration.urgent ? 'warning-text' : 'muted'}>{expiration.label}</span>}</div>
          </button>
          <div className="card-actions">
            <button className="text-button" aria-label={`Edit ${item.item}`} onClick={() => onEdit(item)}>Edit</button>
            <button className="text-button" aria-label={`Edit notes for ${item.item}`} onClick={() => onNotes(item)}>Notes</button>
            <button className="text-button danger" aria-label={`Remove ${item.item}`} onClick={() => void onRemove(item.id)}>Remove</button>
          </div>
          {notesId === item.id && <div className="notes-editor"><label>Notes for {item.item}<textarea aria-label={`Notes for ${item.item}`} rows={3} value={notes} onChange={(event) => onNotesChange(event.target.value)} /></label><div className="form-actions"><button className="button secondary" onClick={onNotesCancel}>Cancel</button><button className="button primary" onClick={() => void onNotesSave(item)}>Save notes</button></div></div>}
        </article>;
      })}
    </section>)}
  </div>;
}
