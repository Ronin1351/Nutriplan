import type { ReceiptDraft } from '../receipt/receiptParser';
import type { PriceCapture } from './types';

function manilaDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function operationId(): string {
  return `receipt-${crypto.randomUUID()}`;
}

export function receiptDraftToCapture(draft: ReceiptDraft, currency: string): PriceCapture {
  const occurredOn = draft.purchaseDate || manilaDate();
  return {
    operationId: operationId(), kind: 'purchase', source: 'receipt', occurredOn, dateEstimated: !draft.purchaseDate, capturedAt: new Date().toISOString(), currency, merchantName: draft.merchant || null, receiptNumber: draft.receiptNumber || null,
    lines: draft.items.map((item, ordinal) => ({ lineId: `receipt-line-${ordinal + 1}`, ordinal, itemName: item.name, category: item.category, quantity: String(item.quantity), unit: 'units', paidMinor: Math.round(item.totalPrice * (currency.toUpperCase() === 'JPY' ? 1 : 100)), packageQuantity: null, packageUnit: null })),
  };
}
