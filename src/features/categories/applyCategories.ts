import { suggestCategory, type CategoryRule } from './categoryClassifier';
import type { ReceiptDraft } from '../receipt/receiptParser';

export function applyCategories(draft: ReceiptDraft, rules: CategoryRule[]): ReceiptDraft {
  return {
    ...draft,
    items: draft.items.map((item) => ({ ...item, category: suggestCategory(item.name, rules) })),
  };
}
