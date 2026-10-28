import type { HistorySeries } from './historySelectors';

export default function PriceHistoryChart({ series }: { series: HistorySeries[] }) {
  const points = series.flatMap((entry) => entry.points);
  if (points.length === 0) return <p className="muted">No dated observations in this range.</p>;
  const min = Math.min(...points.map((point) => point.paidMinor));
  const max = Math.max(...points.map((point) => point.paidMinor));
  const span = Math.max(1, max - min);
  const width = 320;
  const height = 140;
  const coords = points.map((point, index) => ({ point, x: points.length === 1 ? width / 2 : 12 + (index / (points.length - 1)) * (width - 24), y: height - 18 - ((point.paidMinor - min) / span) * (height - 36) }));
  return <div className="price-chart"><svg role="img" aria-label="Price history chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="3" points={coords.map(({ x, y }) => `${x},${y}`).join(' ')} />{coords.map(({ point, x, y }) => <circle key={point.observationId} cx={x} cy={y} r="4" />)}</svg></div>;
}
