import { normalizeIngredients } from './ingredients';
import { classifyCategoryFromName, coalesceTime, parseDurationToMinutes } from './recipes';
import type { RecipeImportDraft } from '../types/domain';

export type RecipeImportErrorCode = 'missing-recipe' | 'malformed-content';

export class RecipeImportError extends Error {
  constructor(public readonly code: RecipeImportErrorCode, message: string) {
    super(message);
    this.name = 'RecipeImportError';
  }
}

function firstString(value: unknown): string {
  if (Array.isArray(value)) return firstString(value[0]);
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstString(record.url ?? record.contentUrl ?? record.name ?? '');
  }
  return '';
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((entry) => textList(entry));
  if (typeof value === 'string' || typeof value === 'number') return [String(value).trim()].filter(Boolean);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return textList(record.text ?? record.name ?? record.itemListElement ?? '');
  }
  return [];
}

function parseServings(value: unknown): number {
  const match = firstString(value).match(/\d+(?:[.,]\d+)?/);
  const servings = match ? Number(match[0].replace(',', '.')) : 4;
  return Number.isFinite(servings) && servings > 0 ? Math.round(servings) : 4;
}

function isRecipe(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const type = (value as Record<string, unknown>)['@type'];
  return Array.isArray(type) ? type.some((entry) => String(entry).toLowerCase() === 'recipe') : String(type ?? '').toLowerCase() === 'recipe';
}

function findJsonLdRecipe(document: Document): Record<string, unknown> | null {
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0, 20)) {
    try {
      const parsed = JSON.parse(script.textContent ?? '');
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [])];
      const recipe = candidates.find(isRecipe);
      if (recipe) return recipe;
    } catch {
      // Continue to microdata and bounded selectors.
    }
  }
  return null;
}

function parseRecipeValues(values: {
  name: string;
  ingredients: string[];
  instructions: string[];
  servings?: unknown;
  prepTime?: unknown;
  cookTime?: unknown;
  totalTime?: unknown;
  image?: unknown;
  sourceUrl?: string;
}): RecipeImportDraft {
  const name = values.name.trim();
  const ingredients = normalizeIngredients(values.ingredients);
  if (!name || ingredients.length === 0) {
    throw new RecipeImportError('missing-recipe', 'No complete recipe was found in this content.');
  }
  const prep = parseDurationToMinutes(values.prepTime);
  const cook = parseDurationToMinutes(values.cookTime);
  const total = parseDurationToMinutes(values.totalTime);
  return {
    name,
    category: classifyCategoryFromName(name),
    servings: parseServings(values.servings),
    prepTime: coalesceTime(total, prep, cook),
    ingredients,
    instructions: values.instructions.join('\n').trim(),
    imageUrl: firstString(values.image),
    submittedBy: 'Personal',
    approved: false,
    sourceUrl: values.sourceUrl,
  };
}

function fromJsonLd(recipe: Record<string, unknown>, sourceUrl?: string): RecipeImportDraft {
  return parseRecipeValues({
    name: firstString(recipe.name),
    ingredients: textList(recipe.recipeIngredient),
    instructions: textList(recipe.recipeInstructions),
    servings: recipe.recipeYield,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    totalTime: recipe.totalTime,
    image: recipe.image,
    sourceUrl,
  });
}

function fromMicrodata(document: Document, sourceUrl?: string): RecipeImportDraft | null {
  const root = document.querySelector('[itemscope][itemtype*="Recipe"]');
  if (!root) return null;
  const read = (prop: string) => Array.from(root.querySelectorAll(`[itemprop~="${prop}"]`)).map((element) => (element.getAttribute('content') ?? element.textContent ?? '').trim()).filter(Boolean);
  return parseRecipeValues({
    name: read('name')[0] ?? '', ingredients: read('recipeIngredient'), instructions: read('recipeInstructions'),
    servings: read('recipeYield')[0], prepTime: read('prepTime')[0], cookTime: read('cookTime')[0], totalTime: read('totalTime')[0], image: read('image')[0], sourceUrl,
  });
}

function fromBoundedSelectors(document: Document, sourceUrl?: string): RecipeImportDraft {
  const name = document.querySelector('h1')?.textContent?.trim() ?? document.title.trim();
  const ingredients = Array.from(document.querySelectorAll('li')).filter((element) => /\d|\b(salt|pepper|oil|flour|sugar|water|egg|milk)\b/i.test(element.textContent ?? '')).slice(0, 25).map((element) => element.textContent?.trim() ?? '').filter(Boolean);
  const instructions = Array.from(document.querySelectorAll('article p, [class*="instruction"], [id*="instruction"]')).slice(0, 20).map((element) => element.textContent?.trim() ?? '').filter(Boolean);
  return parseRecipeValues({ name, ingredients, instructions, image: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '', sourceUrl });
}

function fromPlainText(content: string, sourceUrl?: string): RecipeImportDraft {
  const lines = content.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
  const heading = (line: string, pattern: RegExp) => pattern.test(line.replace(/[:#]/g, '').trim());
  const ingredientStart = lines.findIndex((line) => heading(line, /^(ingredients?|what you need)\b/i));
  const instructionStart = lines.findIndex((line, index) => index > ingredientStart && heading(line, /^(instructions?|directions?|method|steps?)\b/i));
  const name = (ingredientStart > 0 ? lines.slice(0, ingredientStart) : lines).find((line) => !heading(line, /^(ingredients?|instructions?|directions?|method|steps?)\b/i)) ?? '';
  const ingredientLines = ingredientStart >= 0
    ? lines.slice(ingredientStart + 1, instructionStart >= 0 ? instructionStart : lines.length)
    : lines.filter((line) => /^(?:\d|[¼½¾⅓⅔])/.test(line));
  const instructionLines = instructionStart >= 0 ? lines.slice(instructionStart + 1) : [];
  return parseRecipeValues({ name, ingredients: ingredientLines, instructions: instructionLines, sourceUrl });
}

export function parseRecipeContent(content: string, sourceUrl?: string): RecipeImportDraft {
  if (!content.trim()) throw new RecipeImportError('malformed-content', 'Recipe content is empty.');
  if (!/<[a-z][\s\S]*>/i.test(content)) return fromPlainText(content, sourceUrl);
  try {
    const document = new DOMParser().parseFromString(content, 'text/html');
    const jsonLd = findJsonLdRecipe(document);
    if (jsonLd) return fromJsonLd(jsonLd, sourceUrl);
    return fromMicrodata(document, sourceUrl) ?? fromBoundedSelectors(document, sourceUrl);
  } catch (error) {
    if (error instanceof RecipeImportError) throw error;
    throw new RecipeImportError('malformed-content', 'Recipe content could not be parsed.');
  }
}

export async function importRecipeFromUrl(url: string): Promise<RecipeImportDraft> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new RecipeImportError('malformed-content', 'Enter a valid recipe URL.'); }
  if (!/^https?:$/.test(parsed.protocol)) throw new RecipeImportError('malformed-content', 'Enter a valid http(s) recipe URL.');
  const apiOrigin = (import.meta.env.VITE_IMPORT_API_BASE_URL ?? '').replace(/\/$/, '');
  const response = await fetch(`${apiOrigin}/api/recipe-import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: parsed.href }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new RecipeImportError(body.error ?? 'malformed-content', body.message ?? 'The recipe could not be imported.');
  return body as RecipeImportDraft;
}
