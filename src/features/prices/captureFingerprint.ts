import type { PriceCapture } from './types';

export async function captureFingerprint(input: PriceCapture): Promise<string> {
  const canonical = JSON.stringify({
    merchantName: input.merchantName?.trim().toLocaleLowerCase() ?? null,
    occurredOn: input.occurredOn,
    receiptNumber: input.receiptNumber?.trim() || null,
    currency: input.currency,
    kind: input.kind,
    lines: input.lines.map((line) => ({ lineId: line.lineId, ordinal: line.ordinal, itemName: line.itemName.trim().toLocaleLowerCase(), quantity: line.quantity, unit: line.unit, paidMinor: line.paidMinor })),
  });
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return canonical;
}
