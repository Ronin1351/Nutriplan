import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../../lib/currency';
import { buildHistorySeries, summarizePrices } from './historySelectors';
import PriceHistoryChart from './PriceHistoryChart';
import type { PriceHistoryPoint, PriceStore } from './types';

export default function PriceHistoryPanel({ itemId, store, currency }: { itemId: string; store: PriceStore; currency: string }) {
  const [range, setRange] = useState<'1m' | '3m' | '12m' | 'all'>('12m');
  const [points, setPoints] = useState<PriceHistoryPoint[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => { let active = true; setState('loading'); const now = new Date(); const from = range === 'all' ? undefined : new Date(now.getFullYear(), now.getMonth() - Number(range.replace('m', '')), now.getDate()).toISOString().slice(0, 10); void store.getHistory(itemId, { from }).then((next) => { if (active) { setPoints(next); setState('ready'); } }).catch(() => active && setState('error')); return () => { active = false; }; }, [itemId, range, store]);
  const series = useMemo(() => buildHistorySeries(points, { currency }), [points, currency]);
  const summary = useMemo(() => summarizePrices(points, { currency }), [points, currency]);
  return <section className="price-history" aria-label="Price history"><div className="price-history-heading"><h3>Price history</h3><label><span className="sr-only">History range</span><select aria-label="History range" value={range} onChange={(event) => setRange(event.target.value as typeof range)}><option value="1m">1 month</option><option value="3m">3 months</option><option value="12m">12 months</option><option value="all">All history</option></select></label></div>{state === 'loading' && <p className="muted">Loading history…</p>}{state === 'error' && <p role="alert" className="validation-errors">Price history could not be loaded.</p>}{state === 'ready' && <>{summary && <p className="price-summary">Latest: <strong>{formatCurrency(summary.latest.paidMinor / (currency === 'JPY' ? 1 : 100), currency as never)}</strong> on {summary.latest.occurredOn}{summary.changePercent !== null && ` · ${summary.changePercent >= 0 ? '+' : ''}${summary.changePercent.toFixed(1)}%`}</p>}<PriceHistoryChart series={series} /><table className="history-table"><caption className="sr-only">Recorded price observations</caption><thead><tr><th>Date</th><th>Price</th><th>Type</th></tr></thead><tbody>{points.map((point) => <tr key={point.observationId}><td>{point.occurredOn}{point.dateEstimated ? ' · estimated' : ''}</td><td>{formatCurrency(point.paidMinor / (point.currency === 'JPY' ? 1 : 100), point.currency as never)}</td><td>{point.kind}</td></tr>)}</tbody></table></>}</section>;
}
