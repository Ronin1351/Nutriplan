import type { PriceHistoryPoint, PriceHistoryQuery, PriceSummary } from './types';

export interface HistorySeries { currency: string; basis: string; points: PriceHistoryPoint[]; }

export function buildHistorySeries(points: PriceHistoryPoint[], query: PriceHistoryQuery = {}): HistorySeries[] {
  const filtered = points.filter((point) => !query.currency || point.currency === query.currency).filter((point) => !query.source || point.kind === query.source);
  const groups = new Map<string, PriceHistoryPoint[]>();
  for (const point of filtered) {
    const basis = point.packageUnit ? point.packageUnit.toLowerCase() : point.unit.toLowerCase();
    const key = `${point.currency}:${basis}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return [...groups.entries()].map(([key, grouped]) => { const [currency, basis] = key.split(':'); return { currency, basis, points: [...grouped].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.capturedAt.localeCompare(b.capturedAt)) }; });
}

export function summarizePrices(points: PriceHistoryPoint[], query: PriceHistoryQuery = {}): PriceSummary | null {
  const selected = buildHistorySeries(points, query).flatMap((series) => series.points).sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.capturedAt.localeCompare(b.capturedAt));
  const latest = selected.at(-1); if (!latest) return null;
  const previous = selected.at(-2) ?? null;
  return { latest, previous, changeMinor: previous ? latest.paidMinor - previous.paidMinor : null, changePercent: previous && previous.paidMinor !== 0 ? ((latest.paidMinor - previous.paidMinor) / previous.paidMinor) * 100 : null };
}
