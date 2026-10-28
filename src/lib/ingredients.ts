import type { Ingredient } from '../types/domain';
import { convertUnitsDetailed, normalizeUnit } from './units';

const FRACTIONS: Record<string, string> = {
  '½': '0.5',
  '¼': '0.25',
  '¾': '0.75',
  '⅓': '0.33',
  '⅔': '0.67',
};

const UNIT_ALIASES: Record<string, string> = {
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', l: 'L',
  unit: 'unit', units: 'unit', each: 'unit', ea: 'unit', piece: 'unit', pieces: 'unit',
};

export function parseIngredientLine(line: string): Ingredient {
  const normalized = line.replace(/[½¼¾⅓⅔]/g, (fraction) => FRACTIONS[fraction] ?? fraction);
  const amountMatch = normalized.match(/^((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+\.?\d*))/);
  let amount = 1;
  let remaining = normalized;

  if (amountMatch) {
    const amountText = amountMatch[1];
    if (/\d+\s+\d+\/\d+/.test(amountText)) {
      const [whole, fraction] = amountText.split(/\s+/);
      const [numerator, denominator] = fraction.split('/').map(Number);
      amount = Number(whole) + numerator / denominator;
    } else if (/\d+\/\d+/.test(amountText)) {
      const [numerator, denominator] = amountText.split('/').map(Number);
      amount = numerator / denominator;
    } else {
      amount = Number(amountText);
    }
    remaining = normalized.slice(amountMatch[0].length).trim();
  }

  const [firstToken = '', ...rest] = remaining.split(/\s+/);
  const unit = UNIT_ALIASES[firstToken.toLowerCase()] ?? '';
  const item = (unit ? rest.join(' ') : remaining).replace(/^of\s+/i, '').trim();

  return {
    amount: Math.round(amount * 100) / 100,
    unit,
    item,
  };
}

export function normalizeIngredients(lines: string[]): Ingredient[] {
  return lines
    .map(parseIngredientLine)
    .filter((ingredient) => ingredient.item.length > 0)
    .filter((ingredient) => !/^for\s+the\s+/i.test(ingredient.item.trim()));
}

export function mergeDuplicateIngredients(ingredients: Ingredient[]): Ingredient[] {
  const merged: Ingredient[] = [];
  for (const ingredient of ingredients) {
    const name = ingredient.item.trim();
    if (!name) continue;
    if (/^for\s+the\s+/i.test(name)) continue;
    const match = merged.find((entry) => entry.item.trim().toLowerCase() === name.toLowerCase());
    if (!match) { merged.push({ ...ingredient, item: name, unit: normalizeUnit(ingredient.unit) }); continue; }
    const converted = convertUnitsDetailed(ingredient.amount, ingredient.unit, match.unit, name);
    if (converted.convertible) match.amount = Number((match.amount + converted.amount).toFixed(3));
    else merged.push({ ...ingredient, item: name, unit: normalizeUnit(ingredient.unit) });
  }
  return merged;
}
