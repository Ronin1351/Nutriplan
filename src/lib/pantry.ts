import type { PantryItem } from '../types/domain';
import { convertUnits, normalizeUnit } from './units';

export interface ExpirationStatus {
  color: string;
  label: string;
  class: string;
  days: number | null;
  urgent: boolean;
}

function atLocalMidnight(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getExpirationStatus(expirationDate: string | null | undefined, today = new Date()): ExpirationStatus {
  if (!expirationDate) return { color: 'transparent', label: '', class: '', days: null, urgent: false };
  const days = Math.floor((atLocalMidnight(parseDateOnly(expirationDate)).getTime() - atLocalMidnight(today).getTime()) / 86400000);
  if (days < 0) return { color: '#ef5350', label: `❌ EXPIRED ${Math.abs(days)}d ago`, class: 'expired', days, urgent: true };
  if (days === 0) return { color: '#ff6b6b', label: '⚠️ EXPIRES TODAY', class: 'expires-today', days, urgent: true };
  if (days <= 3) return { color: '#ff8a80', label: `⚠️ ${days} day${days > 1 ? 's' : ''} left`, class: 'expires-soon', days, urgent: true };
  if (days <= 7) return { color: '#ffb74d', label: `⚠️ ${days} days left`, class: 'expires-warning', days, urgent: false };
  if (days <= 14) return { color: '#ffd93d', label: `${days} days left`, class: 'expires-caution', days, urgent: false };
  return { color: 'var(--text-secondary)', label: `${days} days`, class: 'fresh', days, urgent: false };
}

export function mergePantryItems(existing: PantryItem, incoming: PantryItem): PantryItem {
  const targetUnit = normalizeUnit(existing.unit);
  const incomingAmount = convertUnits(incoming.amount, incoming.unit, targetUnit, existing.item);
  const totalAmount = existing.amount + incomingAmount;
  const totalValue = existing.amount * existing.price + incomingAmount * incoming.price;
  return {
    ...existing,
    amount: totalAmount,
    unit: existing.unit,
    price: totalAmount ? totalValue / totalAmount : existing.price,
    isActive: true,
    expirationDate: incoming.expirationDate ?? existing.expirationDate,
    category: incoming.category || existing.category,
  };
}
