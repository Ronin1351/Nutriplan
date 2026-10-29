import type { PantryItem } from '../../types/domain';
import PriceHistoryPanel from './PriceHistoryPanel';
import type { PriceStore } from './types';

export default function ItemDetailPanel({ item, store, currency, onClose }: { item: PantryItem; store: PriceStore; currency: string; onClose: () => void }) {
  return <aside className="item-detail-panel" aria-label={`${item.item} details`}><button className="back-link" onClick={onClose}>← Back to pantry</button><div className="detail-hero"><div><p className="section-kicker">Stored on this device</p><h2>{item.item}</h2><p className="muted">{item.category} · {item.amount} {item.unit}</p></div></div><PriceHistoryPanel itemId={String(item.id)} store={store} currency={currency} /></aside>;
}
