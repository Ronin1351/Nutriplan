export const CURRENCY_SYMBOLS = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  INR: '₹',
  MXN: 'MX$',
} as const;

export type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '$';
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return `${symbol}0.00`;
  return currency === 'JPY' ? `${symbol}${Math.round(amount).toLocaleString()}` : `${symbol}${amount.toFixed(2)}`;
}
