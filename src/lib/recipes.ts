import type { Ingredient, PantryItem, Recipe } from '../types/domain';
import { convertUnits, normalizeUnit } from './units';

export interface RecipeDraftForValidation {
  name?: unknown;
  category?: unknown;
  servings?: unknown;
  prepTime?: unknown;
  instructions?: unknown;
  ingredients?: unknown;
  imageUrl?: unknown;
  submittedBy?: unknown;
}

const VALID_CATEGORIES = [
  'Beef', 'Breakfast', 'Chicken', 'Dessert', 'Goat', 'Lamb', 'Miscellaneous',
  'Pasta', 'Pork', 'Seafood', 'Side', 'Starter', 'Vegan', 'Vegetarian',
] as const;

export function validateCategory(category: unknown): string {
  if (typeof category !== 'string' || !category.trim()) return 'Miscellaneous';
  return VALID_CATEGORIES.find((valid) => valid.toLowerCase() === category.trim().toLowerCase()) ?? 'Miscellaneous';
}

export function classifyCategoryFromName(name: string): string {
  const value = name.toLowerCase();
  if (/\b(beef|steak|brisket|sirloin|ribeye|oxtail|meatloaf|burger|hamburger)\b/.test(value)) return 'Beef';
  if (/\b(chicken|poultry|drumstick|thigh|breast|wing|rooster|hen)\b/.test(value)) return 'Chicken';
  if (/\b(pork|bacon|ham|prosciutto|pancetta|chorizo|ribs?)\b/.test(value)) return 'Pork';
  if (/\b(lamb|mutton)\b/.test(value)) return 'Lamb';
  if (/\b(goat)\b/.test(value)) return 'Goat';
  if (/\b(tuna|salmon|shrimp|prawn|fish|cod|tilapia|mackerel|sardine|crab|clam|mussel|oyster)\b/.test(value)) return 'Seafood';
  if (/\b(vegan)\b/.test(value)) return 'Vegan';
  if (/\b(vegetarian|meatless)\b/.test(value)) return 'Vegetarian';
  if (/\b(pasta|spaghetti|fettuccine|penne|lasagna|mac( and)? cheese)\b/.test(value)) return 'Pasta';
  if (/\b(pancake|waffle|omelet|omelette|scramble|breakfast|oatmeal|granola|french toast)\b/.test(value)) return 'Breakfast';
  if (/\b(dessert|cake|brownie|cookie|pudding|custard|pie|tart|cheesecake|ice cream)\b/.test(value)) return 'Dessert';
  if (/\b(starter|appetizer|bruschetta|canap[eé]|dip|crudités)\b/.test(value)) return 'Starter';
  if (/\b(side|coleslaw|mashed potatoes|side salad)\b/.test(value)) return 'Side';
  return 'Miscellaneous';
}

export function validateRecipe(draft: RecipeDraftForValidation): string[] {
  const errors: string[] = [];
  const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  const servings = Number(draft.servings);
  const prepTime = Number(draft.prepTime);

  if (!nonEmpty(draft.name)) errors.push('Name is required.');
  if (draft.category != null && typeof draft.category !== 'string') errors.push('Category must be a string.');
  if (!Number.isFinite(servings) || servings <= 0) errors.push('Servings must be a positive number.');
  if (Number.isFinite(servings) && servings > 1000) errors.push('Servings is unrealistically large.');
  if (!Number.isFinite(prepTime) || prepTime < 0) errors.push('Prep time must be 0 or a positive number.');
  if (Number.isFinite(prepTime) && prepTime > 24 * 60) errors.push('Prep time exceeds 24 hours.');
  if (!nonEmpty(draft.instructions)) errors.push('Instructions are required.');

  if (!Array.isArray(draft.ingredients) || draft.ingredients.length === 0) {
    errors.push('At least one ingredient is required.');
  } else {
    draft.ingredients.forEach((ingredient, index) => {
      if (!ingredient || typeof ingredient !== 'object') {
        errors.push(`Ingredient #${index + 1} is malformed.`);
        return;
      }
      const row = ingredient as Record<string, unknown>;
      const itemValid = nonEmpty(row.item);
      const amount = Number(row.amount);
      if (!itemValid) errors.push(`Ingredient #${index + 1} requires an item name.`);
      if (!Number.isFinite(amount)) errors.push(`Ingredient #${index + 1} amount must be a number.`);
      if (Number.isFinite(amount) && amount < 0) errors.push(`Ingredient #${index + 1} amount cannot be negative.`);
      if (Number.isFinite(amount) && amount > 100000) errors.push(`Ingredient #${index + 1} amount is unrealistically large.`);
    });
  }

  if (draft.imageUrl) {
    try {
      const url = new URL(String(draft.imageUrl));
      if (!/^https?:$/.test(url.protocol)) errors.push('Image URL must use http(s).');
    } catch {
      errors.push('Image URL is invalid.');
    }
  }
  if (draft.submittedBy != null && typeof draft.submittedBy !== 'string') errors.push('submittedBy must be a string.');
  return errors;
}

export function parseDurationToMinutes(value: unknown): number | null {
  if (value == null || !String(value).trim()) return null;
  let text = String(value).trim();
  if (/^P/i.test(text)) {
    const match = text.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i);
    if (!match) return null;
    return Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0) + (match[4] ? Math.round(Number(match[4]) / 60) : 0);
  }
  text = text.toLowerCase().replace(/[–—−]/g, '-').replace(/about|approx\.?|approximately|roughly|~|≈/g, '').trim();
  const compact = text.match(/^(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)?\s*(\d+)?\s*m?(?:in(?:ute)?s?)?$/i);
  if (compact) return Math.round(Number(compact[1].replace(',', '.')) * 60) + Number(compact[2] || 0);
  const minutes = text.match(/^(\d+(?:[.,]\d+)?)\s*m(?:in(?:ute)?s?)?$/i);
  if (minutes) return Math.round(Number(minutes[1].replace(',', '.')));
  const hours = text.match(/^(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)?$/i);
  if (hours) return Math.round(Number(hours[1].replace(',', '.')) * 60);
  const hourMatch = text.match(/(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)/i);
  const minuteMatch = text.match(/(\d+(?:[.,]\d+)?)\s*m(?:in(?:ute)?s?)/i);
  if (hourMatch || minuteMatch) return Math.round(Number(hourMatch?.[1]?.replace(',', '.') || 0) * 60 + Number(minuteMatch?.[1]?.replace(',', '.') || 0));
  return /^\d+(?:[.,]\d+)?$/.test(text) ? Math.round(Number(text.replace(',', '.'))) : null;
}

export function coalesceTime(total: number | null, prep: number | null, cook: number | null): number {
  const valid = (value: number | null): value is number => typeof value === 'number' && Number.isFinite(value);
  const clamp = (value: number) => Math.min(24 * 60, Math.max(0, Math.round(value)));
  if (valid(total) && total > 0) return clamp(total);
  const sum = (valid(prep) ? prep : 0) + (valid(cook) ? cook : 0);
  if (sum > 0) return clamp(sum);
  if (valid(prep) && prep >= 0) return clamp(prep);
  if (valid(cook) && cook >= 0) return clamp(cook);
  return 0;
}

export interface RecipeCost {
  total: number;
  breakdown: Array<{ item: string; amount: number; unit: string; cost: number }>;
  missingItems: string[];
}

export function calculateRecipeCost(recipe: Recipe | null, pantry: PantryItem[]): RecipeCost {
  if (!recipe || !Array.isArray(recipe.ingredients)) return { total: 0, breakdown: [], missingItems: [] };
  const result: RecipeCost = { total: 0, breakdown: [], missingItems: [] };

  recipe.ingredients.forEach((ingredient) => {
    const itemName = ingredient.item.toLowerCase().trim();
    if (!itemName) return;
    const pantryItem = pantry.find((item) => item.item.toLowerCase() === itemName);
    if (!pantryItem || !pantryItem.price || pantryItem.amount <= 0) {
      result.missingItems.push(itemName);
      return;
    }
    const amount = Number(ingredient.amount) || 0;
    const unit = normalizeUnit(ingredient.unit);
    const pantryUnit = normalizeUnit(pantryItem.unit);
    const convertedAmount = convertUnits(amount, unit, pantryUnit, itemName);
    const cost = convertedAmount * (pantryItem.price / pantryItem.amount);
    result.total += cost;
    result.breakdown.push({ item: ingredient.item, amount, unit, cost });
  });
  return result;
}
