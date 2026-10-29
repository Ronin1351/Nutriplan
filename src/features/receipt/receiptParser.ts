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

const MONEY = String.raw`(?:₱|PHP|P)?\s*(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})`;
const totalPattern = /^(?:(?:NET\s+)?TOTAL|SUBTOTAL|GRAND TOTAL|TOTAL PAID|AMOUNT DUE|BALANCE DUE)\b/i;
const ignoredSummaryPattern = /^(?:CHANGE|E\s*WALLET|PAYMENT|CASH|VAT|VATS?\/?N|SALES TRANSACTION|THANK|CASHIER|TERMINAL|TRANS|REF|RECEIPT|OR\s*#)\b/i;
const headerPattern = /^(?:TIN|MIN|PN|SN|S\/N|DATE|TIME|INVOICE|OR|STORE|BRANCH|TEL|TELEPHONE)\b\s*[:#]?/i;
const detailRowPattern = new RegExp(String.raw`^(\d+(?:\.\d+)?)\s*[x×@]\s*(\d+(?:\.\d+)?)(?:\s+${MONEY})?\s*$`, 'i');
const nameDetailPattern = new RegExp(String.raw`^(.*?[A-Za-z].*?)\s+(\d+\.\d{3})\s*[x×@]?\s*(\d+(?:\.\d+)?)\s+${MONEY}\s*$`, 'i');
const nameTotalPattern = new RegExp(String.raw`^(.*?[A-Za-z].*?)\s+${MONEY}\s*$`, 'i');
const trailingMoneyPattern = new RegExp(String.raw`${MONEY}\s*$`, 'i');

function money(whole: string, cents: string): number {
  return Number(`${whole.replace(/,/g, '')}.${cents}`);
}

/** Repairs the OCR noise seen on thermal receipts before any pattern runs. */
export function normalizeRowText(text: string): string {
  return text
    .replace(/(?<=\d)[Oo](?=[\d.])|(?<=[\d.])[Oo](?=\d)/g, '0')
    .replace(/(\d)\s*\.\s*(\d{2})\b/g, '$1.$2')
    .replace(/(\d+\.\d{3})(\d{2,4}\.\d{2})/g, '$1 @ $2')
    .replace(/\s*@\s*/g, ' @ ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarker(name: string): string {
  return name.replace(/^\s*[*#]+\s*/, '').replace(/\s+/g, ' ').trim();
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
  let sawTotal = false;
  const rawRows = rows.map((row) => row.text);

  const normalized = rows.map((row) => normalizeRowText(row.text));
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const text = normalized[index];
    if (!text) continue;

    if (totalPattern.test(text)) {
      const amounts = [...text.matchAll(new RegExp(MONEY, 'gi'))].map((match) => money(match[1], match[2]));
      if (amounts.length) total = /^TOTAL PAID\b/i.test(text) ? amounts[0] : amounts[amounts.length - 1];
      sawTotal = true;
      pendingName = null;
      continue;
    }
    if (sawTotal || ignoredSummaryPattern.test(text)) continue;

    if (!merchant && items.length === 0 && !pendingName && /[A-Za-z]/.test(text) && !trailingMoneyPattern.test(text) && !nameDetailPattern.test(text)) {
      // The first plain text line is the merchant, unless it is immediately followed by a quantity line (then it is the first item).
      const next = normalized[index + 1] ?? '';
      if (!detailRowPattern.test(next)) { merchant = stripMarker(text); continue; }
    }
    if (headerPattern.test(text)) continue;

    const detail = text.match(detailRowPattern);
    if (detail) {
      const quantity = Number(detail[1]);
      const unitPrice = Number(detail[2]);
      const printedTotal = detail[3] !== undefined ? money(detail[3], detail[4]) : undefined;
      const totalPrice = printedTotal ?? Number((quantity * unitPrice).toFixed(2));
      if (pendingName) {
        items.push({ name: pendingName.name, quantity, unitPrice, totalPrice, confidence: Math.min(pendingName.confidence, row.confidence) });
        pendingName = null;
      } else if (items.length) {
        const previous = items[items.length - 1];
        items[items.length - 1] = { ...previous, quantity, unitPrice, totalPrice: printedTotal ?? previous.totalPrice, confidence: Math.min(previous.confidence, row.confidence) };
      }
      continue;
    }

    const nameDetail = text.match(nameDetailPattern);
    if (nameDetail) {
      items.push({ name: stripMarker(nameDetail[1]), quantity: Number(nameDetail[2]), unitPrice: Number(nameDetail[3]), totalPrice: money(nameDetail[4], nameDetail[5]), confidence: row.confidence });
      pendingName = null;
      continue;
    }

    const nameTotal = text.match(nameTotalPattern);
    if (nameTotal) {
      const quantityMatch = nameTotal[1].match(/^(\d+(?:\.\d+)?)\s*[x×]\s*/i);
      const name = stripMarker(quantityMatch ? nameTotal[1].slice(quantityMatch[0].length) : nameTotal[1]);
      if (name) { items.push({ name, quantity: quantityMatch ? Number(quantityMatch[1]) : 1, totalPrice: money(nameTotal[2], nameTotal[3]), confidence: row.confidence }); pendingName = null; }
      continue;
    }

    if (/[A-Za-z]{2,}/.test(text) && !/\d{5,}/.test(text)) {
      // A bare description line: its quantity and price should follow on the next row.
      pendingName = { name: stripMarker(text), confidence: row.confidence };
    }
  }

  return { merchant, total, purchaseDate: null, receiptNumber: null, items, rawRows };
}
