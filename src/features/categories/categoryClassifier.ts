import { PANTRY_CATEGORIES, type PantryCategory } from '../../types/domain';

export interface CategoryRule {
  phrase: string;
  category: PantryCategory;
  updatedAt: number;
}

const BUILT_IN_RULES: Array<{ category: PantryCategory; tokens: string[] }> = [
  { category: 'Poultry', tokens: ['chicken', 'chkn', 'poultry', 'drumstick', 'thigh', 'breast', 'wing', 'rooster', 'hen'] },
  { category: 'Meat', tokens: ['beef', 'steak', 'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'chorizo', 'ribs', 'lamb', 'mutton', 'goat'] },
  { category: 'Seafood', tokens: ['tuna', 'salmon', 'shrimp', 'prawn', 'fish', 'cod', 'tilapia', 'mackerel', 'sardine', 'crab', 'clam', 'mussel', 'oyster'] },
  { category: 'Produce', tokens: ['apple', 'onion', 'leaves', 'papaya', 'potato', 'calamansi', 'okra', 'pepper', 'tomato', 'banana', 'mango', 'lettuce', 'carrot', 'cabbage', 'garlic', 'ginger', 'fruit', 'vegetable'] },
  { category: 'Dairy', tokens: ['milk', 'cheese', 'yogurt', 'butter', 'cream'] },
  { category: 'Grains', tokens: ['rice', 'pasta', 'spaghetti', 'noodle', 'bread', 'flour', 'oatmeal', 'cereal'] },
  { category: 'Beverages', tokens: ['water', 'juice', 'coffee', 'tea', 'soda', 'gatorade', 'drink'] },
  { category: 'Snacks', tokens: ['chips', 'cracker', 'cookie', 'candy', 'chocolate', 'cheetos'] },
  { category: 'Household', tokens: ['toothbrush', 'shampoo', 'detergent', 'soap', 'sponge', 'pad'] },
];

export function normalizeCategoryText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function isPantryCategory(value: string): value is PantryCategory {
  return (PANTRY_CATEGORIES as readonly string[]).includes(value);
}

export function suggestCategory(itemName: string, rules: CategoryRule[]): PantryCategory {
  const normalizedName = normalizeCategoryText(itemName);
  const learnedRule = rules.find((rule) => normalizeCategoryText(rule.phrase) === normalizedName && rule.category !== 'Uncategorized');
  if (learnedRule) return learnedRule.category;
  const tokens = new Set(normalizedName.split(' ').filter(Boolean));
  return BUILT_IN_RULES.find((rule) => rule.tokens.some((token) => tokens.has(token)))?.category ?? 'Uncategorized';
}
