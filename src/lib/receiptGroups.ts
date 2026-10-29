import type { ReceiptSummary } from '../features/pantry/pantryInventoryService';

export interface ReceiptYearGroup { year: string; receipts: ReceiptSummary[]; totalMinor: number; }

export function groupReceiptsByYear(receipts: ReceiptSummary[]): ReceiptYearGroup[] {
  const byYear = new Map<string, ReceiptSummary[]>();
  for (const receipt of receipts) {
    const year = receipt.occurredOn.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), receipt]);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, entries]) => {
      const sorted = [...entries].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
      return { year, receipts: sorted, totalMinor: sorted.reduce((sum, receipt) => sum + receipt.totalMinor, 0) };
    });
}
