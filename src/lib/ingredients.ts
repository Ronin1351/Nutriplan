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
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', l: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L',
  unit: 'unit', units: 'unit', each: 'unit', ea: 'unit', piece: 'unit', pieces: 'unit',
  // Count nouns from recipe sites: they describe how the item is packaged, not a measure.
  packet: 'unit', packets: 'unit', package: 'unit', packages: 'unit', pkg: 'unit',
  can: 'unit', cans: 'unit', jar: 'unit', jars: 'unit', bottle: 'unit', bottles: 'unit',
  bag: 'unit', bags: 'unit', box: 'unit', boxes: 'unit', envelope: 'unit', envelopes: 'unit',
  stick: 'unit', sticks: 'unit', bunch: 'unit', bunches: 'unit', head: 'unit', heads: 'unit',
  clove: 'unit', cloves: 'unit', slice: 'unit', slices: 'unit', sprig: 'unit', sprigs: 'unit',
  pinch: 'unit', pinches: 'unit', dash: 'unit', dashes: 'unit',
};

const PACKAGE_WORDS = /^(?:packages?|pkgs?|cans?|jars?|bottles?|bags?|boxe?s?|packets?|envelopes?|containers?|cartons?)\b\s*/i;

function cleanLine(line: string): string {
  return line
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\t]/g, ' ')
    .replace(/[™®©]/g, '')
    .replace(/(\d)\s*([½¼¾⅓⅔])/g, '$1 $2')
    .replace(/[½¼¾⅓⅔]/g, (fraction) => FRACTIONS[fraction] ?? fraction)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drops bracketed asides such as "(or one large one)" and a leading "of". */
function stripNotes(text: string): string {
  return text.replace(/\s*\((?:or|optional|about|approx|approximately|see|note)[^)]*\)/gi, '').replace(/^of\s+/i, '').replace(/\s+/g, ' ').trim();
}

function parseAmount(text: string): number {
  if (/^\d+\s+\d+\/\d+$/.test(text)) { const [whole, fraction] = text.split(/\s+/); const [n, d] = fraction.split('/').map(Number); return Number(whole) + n / d; }
  if (/^\d+\s+0\.\d+$/.test(text)) { const [whole, part] = text.split(/\s+/); return Number(whole) + Number(part); }
  if (/^\d+\/\d+$/.test(text)) { const [n, d] = text.split('/').map(Number); return n / d; }
  return Number(text);
}

export function parseIngredientLine(line: string): Ingredient {
  const normalized = cleanLine(line);
  const amountMatch = normalized.match(/^((?:\d+\s+\d+\/\d+)|(?:\d+\s+0\.\d+)|(?:\d+\/\d+)|(?:\d+\.?\d*))/);
  let amount = 1;
  let remaining = normalized;
  if (amountMatch) { amount = parseAmount(amountMatch[1]); remaining = normalized.slice(amountMatch[0].length).trim(); }

  // Size adjectives before a count noun ("2 small cans") carry no measure.
  const adjective = remaining.match(/^(?:small|medium|large|extra[- ]large)\s+(\w+)/i);
  if (adjective && UNIT_ALIASES[adjective[1].toLowerCase()]) remaining = remaining.slice(adjective[0].length - adjective[1].length);
  // "1 (12 oz.) package elbow macaroni" or "1 box (12 oz.) elbow macaroni": the parenthetical size is the real measure, times the count.
  const leadingPackage = remaining.match(PACKAGE_WORDS)?.[0] ?? '';
  const afterPackage = remaining.slice(leadingPackage.length);
  const packageSize = afterPackage.match(/^\(\s*(\d+(?:\.\d+)?)\s*-?\s*([A-Za-z]+)\.?\s*\)\s*/);
  const sizeUnit = packageSize ? UNIT_ALIASES[packageSize[2].toLowerCase()] : undefined;
  if (packageSize && sizeUnit && sizeUnit !== 'unit') {
    const rest = afterPackage.slice(packageSize[0].length).replace(PACKAGE_WORDS, '').trim();
    return { amount: Math.round(amount * Number(packageSize[1]) * 100) / 100, unit: sizeUnit, item: stripNotes(rest) };
  }
  // Any other parenthetical right after the amount or package word is a note ("(8 or 9 slices)"), not a measure.
  remaining = (leadingPackage + afterPackage.replace(/^\([^)]*\)\s*/, '')).trim();

  const [firstToken = '', ...rest] = remaining.split(/\s+/);
  const unit = UNIT_ALIASES[firstToken.toLowerCase().replace(/\.$/, '')] ?? '';
  const item = stripNotes(unit ? rest.join(' ') : remaining);

  return { amount: Math.round(amount * 100) / 100, unit, item };
}

export function normalizeIngredients(lines: string[]): Ingredient[] {
  return lines
    .filter((line) => !/^\s*or\b/i.test(line))
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
