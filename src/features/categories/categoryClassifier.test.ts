import { describe, expect, it } from 'vitest';
import { normalizeCategoryText, suggestCategory } from './categoryClassifier';

describe('category classifier', () => {
  it('suggests categories from whole item-name tokens', () => {
    expect(suggestCategory('*ONION  LEAVES', [])).toBe('Produce');
    expect(suggestCategory('*MAG CHKN THIGHS', [])).toBe('Poultry');
    expect(suggestCategory('HAM', [])).toBe('Meat');
    expect(suggestCategory('SHAMPOO', [])).toBe('Household');
    expect(suggestCategory('SHAMPOO', [{ phrase: 'ham', category: 'Meat', updatedAt: 1 }])).toBe('Household');
  });

  it('normalizes receipt punctuation and spacing for learned exact rules', () => {
    expect(normalizeCategoryText('*MAG  CHKN THIGHS')).toBe('mag chkn thighs');
    expect(suggestCategory(' *MAG CHKN THIGHS ', [{ phrase: 'mag chkn thighs', category: 'Pantry', updatedAt: 1 }])).toBe('Pantry');
  });

  it('keeps unknown items uncategorized', () => {
    expect(suggestCategory('MYSTERY ITEM', [])).toBe('Uncategorized');
  });
});
