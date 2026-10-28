import type { CaptureLine, ComparablePrice, PriceHistoryPoint } from './types';

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY']);

export function toMinorUnits(value: string, currency: string): number {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) throw new Error('Price must be a non-negative decimal.');
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
  const [, fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) throw new Error(`${currency} does not support that fractional amount.`);
  const result = Number(trimmed) * 10 ** decimals;
  if (!Number.isSafeInteger(result)) throw new Error('Price is outside the supported range.');
  return result;
}

export function comparablePrice(line: CaptureLine, currency: string): ComparablePrice | null {
  if (!Number.isSafeInteger(line.paidMinor) || line.paidMinor < 0) return null;
  const quantity = Number(line.packageQuantity ?? line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = (line.packageUnit ?? line.unit).toLowerCase();
  if (unit === 'kg') return { minor: line.paidMinor / quantity, basis: 'kg', currency };
  if (unit === 'g') return { minor: line.paidMinor / (quantity / 1000), basis: 'kg', currency };
  if (unit === 'l') return { minor: line.paidMinor / quantity, basis: 'l', currency };
  if (unit === 'ml') return { minor: line.paidMinor / (quantity / 1000), basis: 'l', currency };
  if (unit === 'each' || unit === 'unit' || unit === 'units') return { minor: line.paidMinor / quantity, basis: 'each', currency };
  return null;
}

export function selectLatest(points: PriceHistoryPoint[]): PriceHistoryPoint | null {
  return [...points].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.capturedAt.localeCompare(b.capturedAt) || a.observationId.localeCompare(b.observationId)).at(-1) ?? null;
}
