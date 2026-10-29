import type { ReceiptOcrFragment } from './receiptOcr';
import type { PantryCategory } from '../../types/domain';

export type ReceiptFragment = ReceiptOcrFragment;

export interface ReceiptRow {
  text: string;
  fragments: ReceiptFragment[];
  confidence: number;
}

export interface ReceiptDraftItem {
  name: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
  category?: PantryCategory;
  confidence: number;
}

export interface ReceiptDraft {
  merchant: string;
  total: number | null;
  purchaseDate?: string | null;
  receiptNumber?: string | null;
  items: ReceiptDraftItem[];
  rawRows: string[];
}

interface Bounds { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number; height: number; }

function bounds(fragment: ReceiptFragment, skew = 0): Bounds {
  const xs = fragment.poly.map((point) => point[0] ?? 0);
  // De-rotate: subtract the tilt contribution of each point's x so a slanted line becomes level.
  const ys = fragment.poly.map((point) => (point[1] ?? 0) - (point[0] ?? 0) * skew);
  const left = xs.length ? Math.min(...xs) : 0; const right = xs.length ? Math.max(...xs) : 0; const top = ys.length ? Math.min(...ys) : 0; const bottom = ys.length ? Math.max(...ys) : 0;
  return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2, height: Math.max(1, bottom - top) };
}

/** Median slope of the fragments' top edges: the page tilt in y-per-x. Short fragments are ignored because their slope is noise. */
function estimateSkew(fragments: ReceiptFragment[]): number {
  const slopes = fragments.flatMap((fragment) => {
    const [a, b] = fragment.poly;
    if (!a || !b) return [];
    const dx = (b[0] ?? 0) - (a[0] ?? 0);
    if (Math.abs(dx) < 40) return [];
    return [((b[1] ?? 0) - (a[1] ?? 0)) / dx];
  }).sort((x, y) => x - y);
  if (slopes.length === 0) return 0;
  const slope = slopes[Math.floor(slopes.length / 2)];
  return Math.abs(slope) < 0.25 ? slope : 0;
}

function sameRow(a: Bounds, rowTop: number, rowBottom: number): boolean {
  const rowHeight = Math.max(1, rowBottom - rowTop);
  const overlap = Math.max(0, Math.min(a.bottom, rowBottom) - Math.max(a.top, rowTop));
  return overlap >= Math.min(a.height, rowHeight) * 0.4;
}

export function orderReceiptFragments(fragments: ReceiptFragment[]): ReceiptRow[] {
  const skew = estimateSkew(fragments);
  const ordered = [...fragments].filter((fragment) => fragment.text.trim()).map((fragment) => ({ fragment, box: bounds(fragment, skew) })).sort((a, b) => a.box.centerY - b.box.centerY);
  const rows: Array<{ members: typeof ordered; top: number; bottom: number }> = [];
  for (const entry of ordered) {
    const row = rows.find((candidate) => sameRow(entry.box, candidate.top, candidate.bottom));
    if (row) {
      row.members.push(entry);
      // Track the row's typical extent, not its first member, so one tall fragment cannot swallow the next line.
      row.top = (row.top * (row.members.length - 1) + entry.box.top) / row.members.length;
      row.bottom = (row.bottom * (row.members.length - 1) + entry.box.bottom) / row.members.length;
    } else {
      rows.push({ members: [entry], top: entry.box.top, bottom: entry.box.bottom });
    }
  }
  return rows.map((row) => {
    const sorted = row.members.sort((a, b) => a.box.left - b.box.left).map((entry) => entry.fragment);
    return { text: sorted.map((fragment) => fragment.text.trim()).join(' '), fragments: sorted, confidence: sorted.length ? Math.min(...sorted.map((fragment) => fragment.confidence)) : 0 };
  });
}

const amountPattern = /(?:(?:₱|PHP|P)\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|\d+(?:\.\d{1,2})/gi;
const totalPattern = /^(?:(?:NET\s+)?TOTAL|SUBTOTAL|GRAND TOTAL|TOTAL PAID|AMOUNT DUE|BALANCE DUE)\b/i;
const ignoredSummaryPattern = /^(?:CHANGE|E\s+WALLET|PAYMENT|VAT|VATS?\/?N|SALES TRANSACTION)\b/i;
const compactDetailPattern = /(\d+\.\d{3})\s*@?\s*(\d{2,4}(?:\.\d{1,2})?)\s+(\d{1,4}(?:,\d{3})?\.\d{2})\s*$/i;
const compactContinuationDetailPattern = /^(\d+\.\d{3})\s*@?\s*(\d{2,4}(?:\.\d{1,2})?)\s+(\d{1,4}(?:,\d{3})?\.\d{2})\s*$/i;
const compactContinuationPattern = /^(\d+\.\d{3})\s*@?\s*(\d{2,4}(?:\.\d{1,2})?)\s*$/i;

function numbers(text: string): number[] {
  return [...text.matchAll(amountPattern)].map((match) => Number(match[0].replace(/₱|PHP|P|\s|,/gi, ''))).filter(Number.isFinite);
}

function cleanName(text: string): string {
  return text.replace(/^\s*\*+\s*/, '').replace(amountPattern, '').replace(/^\s*\d+(?:\.\d+)?\s*[x×]\s*/i, '').replace(/\s+/g, ' ').trim();
}

function isContinuation(text: string): boolean {
  return /^\d+(?:\.\d+)?\s*[x×@]/i.test(text.trim()) || compactContinuationDetailPattern.test(text.trim()) || compactContinuationPattern.test(text.trim());
}

function continuationQuantity(text: string): number | null {
  const match = text.trim().match(/^(\d+(?:\.\d+)?)(?:\s*[x×@]|(?=\d{2,4}\.\d{2}))/i);
  if (!match) return null;
  const quantity = Number(match[1]);
  return Number.isFinite(quantity) ? quantity : null;
}

export function isReceiptItemPriceConsistent(item: ReceiptDraftItem): boolean {
  if (item.unitPrice === undefined) return true;
  return Math.abs(item.quantity * item.unitPrice - item.totalPrice) <= 0.03;
}

export function isReceiptSubtotalConsistent(total: number | null, items: ReceiptDraftItem[]): boolean {
  if (total === null || !Number.isFinite(total)) return true;
  const capturedSubtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  return Math.abs(capturedSubtotal - total) <= 0.03;
}

export function parseReceiptRows(rows: ReceiptRow[]): ReceiptDraft {
  const items: ReceiptDraftItem[] = [];
  let merchant = '';
  let total: number | null = null;
  let pendingName: { name: string; confidence: number } | null = null;
  const rawRows = rows.map((row) => row.text);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const text = row.text.trim();
    if (!text) continue;
    const values = numbers(text);
    if (totalPattern.test(text)) {
      if (values.length) total = /^TOTAL PAID\b/i.test(text) ? values[0] : values.at(-1)!;
      continue;
    }
    if (ignoredSummaryPattern.test(text)) {
      continue;
    }
    const compactDetail = text.match(compactDetailPattern);
    if (compactDetail) {
      const name = text.slice(0, compactDetail.index).replace(/^\s*\*+\s*/, '').trim();
      const quantity = Number(compactDetail[1]);
      const unitPrice = Number(compactDetail[2]);
      const totalPrice = Number(compactDetail[3].replace(/,/g, ''));
      if (name && Number.isFinite(quantity) && Number.isFinite(unitPrice) && Number.isFinite(totalPrice)) {
        items.push({ name, quantity, unitPrice, totalPrice, confidence: row.confidence });
        continue;
      }
    }
    if (!merchant && values.length === 0) {
      if (index === 0 && !isContinuation(rows[index + 1]?.text ?? '')) merchant = text;
      else pendingName = { name: text.replace(/^\s*\*+\s*/, ''), confidence: row.confidence };
      continue;
    }
    if (isContinuation(text) && (items.length || pendingName)) {
      const quantity = continuationQuantity(text) ?? 1;
      const compactContinuationDetail = text.match(compactContinuationDetailPattern);
      const compactContinuation = text.match(compactContinuationPattern);
      const price = compactContinuationDetail ? Number(compactContinuationDetail[2]) : compactContinuation ? Number(compactContinuation[2]) : values.at(-1);
      const printedTotal = compactContinuationDetail ? Number(compactContinuationDetail[3].replace(/,/g, '')) : undefined;
      if (price !== undefined && pendingName) {
        items.push({ name: pendingName.name, quantity, unitPrice: price, totalPrice: printedTotal ?? Number((quantity * price).toFixed(2)), confidence: Math.min(pendingName.confidence, row.confidence) });
        pendingName = null;
      } else if (price !== undefined && items.length) {
        const previous = items[items.length - 1];
        items[items.length - 1] = { ...previous, quantity, unitPrice: price, ...(printedTotal === undefined ? {} : { totalPrice: printedTotal }), confidence: Math.min(previous.confidence, row.confidence) };
      }
      continue;
    }
    if (values.length && cleanName(text)) {
      const quantityMatch = text.match(/^(\d+(?:\.\d+)?)\s*[x×]/i);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
      items.push({ name: cleanName(text), quantity, totalPrice: values.at(-1)!, confidence: row.confidence });
    }
  }

  return { merchant, total, purchaseDate: null, receiptNumber: null, items, rawRows };
}
