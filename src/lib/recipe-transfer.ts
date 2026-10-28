import { mergeDuplicateIngredients } from './ingredients';
import { validateRecipe } from './recipes';
import type { NewRecipe, Recipe } from '../types/domain';

export interface RecipeExportFile {
  format: 'nutriplan-recipes';
  version: 1;
  exportedAt: string;
  recipes: NewRecipe[];
}

function portableRecipe(recipe: Recipe): NewRecipe {
  return {
    name: recipe.name,
    category: recipe.category,
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    image: recipe.image,
    ingredients: mergeDuplicateIngredients(recipe.ingredients),
    instructions: recipe.instructions,
    submittedBy: recipe.submittedBy,
    sourceUrl: recipe.sourceUrl,
  };
}

export function createRecipeExport(recipes: Recipe[]): string {
  const payload: RecipeExportFile = {
    format: 'nutriplan-recipes',
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes: recipes.map(portableRecipe),
  };
  return JSON.stringify(payload, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNewRecipe(value: unknown, index: number): NewRecipe {
  if (!isRecord(value)) throw new Error(`Recipe ${index + 1} must be an object.`);
  const recipe: NewRecipe = {
    name: typeof value.name === 'string' ? value.name.trim() : '',
    category: typeof value.category === 'string' && value.category.trim() ? value.category.trim() : 'Miscellaneous',
    servings: toNumber(value.servings),
    prepTime: toNumber(value.prepTime),
    image: typeof value.image === 'string' && value.image ? value.image : null,
    ingredients: Array.isArray(value.ingredients) ? value.ingredients.map((ingredient) => ({
      item: isRecord(ingredient) && typeof ingredient.item === 'string' ? ingredient.item : '',
      amount: isRecord(ingredient) ? toNumber(ingredient.amount) : 0,
      unit: isRecord(ingredient) && typeof ingredient.unit === 'string' ? ingredient.unit : 'unit',
    })) : [],
    instructions: typeof value.instructions === 'string' ? value.instructions.trim() : '',
    submittedBy: typeof value.submittedBy === 'string' && value.submittedBy.trim() ? value.submittedBy.trim() : 'Personal',
    sourceUrl: typeof value.sourceUrl === 'string' && value.sourceUrl ? value.sourceUrl : undefined,
  };
  recipe.ingredients = mergeDuplicateIngredients(recipe.ingredients);
  const errors = validateRecipe({ ...recipe, imageUrl: recipe.image ?? undefined });
  if (errors.length > 0) throw new Error(`Recipe ${index + 1}${recipe.name ? ` (${recipe.name})` : ''} is invalid: ${errors.join(' ')}`);
  return recipe;
}

export function parseRecipeExport(text: string): NewRecipe[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  const records = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.recipes) ? parsed.recipes : null;
  if (!records || records.length === 0) throw new Error('The JSON file does not contain any recipes.');
  return records.map(toNewRecipe);
}
