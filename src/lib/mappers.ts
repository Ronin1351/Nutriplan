import type {
  DatabaseIngredientRow,
  DatabasePantryInsert,
  DatabasePantryRow,
  DatabaseRecipeInsert,
  DatabaseRecipeRow,
  DatabaseUserRow,
} from '../types/database';
import type { Ingredient, NewPantryItem, NewRecipe, PantryItem, Recipe, User } from '../types/domain';

function toNumber(value: unknown, fallback: number): number {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function mapIngredient(value: unknown): Ingredient | null {
  if (!value || typeof value !== 'object') return null;

  const row = value as DatabaseIngredientRow;
  const item = row.item?.trim() ?? '';
  if (!item) return null;

  return {
    item,
    amount: toNumber(row.amount, 1),
    unit: row.unit?.trim() ?? '',
  };
}

function mapIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapIngredient).filter((ingredient): ingredient is Ingredient => ingredient !== null);
}

export function mapUserRow(row: DatabaseUserRow): User {
  const username = row.username.trim();

  return {
    id: row.id,
    username,
    name: row.name?.trim() || username,
    email: row.email?.trim() || '',
    avatarUrl: row.avatar_url?.trim() || null,
    isAdmin: toBoolean(row.is_admin),
  };
}

export function mapRecipeRow(row: DatabaseRecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.trim() || 'Miscellaneous',
    servings: Math.max(1, toNumber(row.servings, 4)),
    prepTime: Math.max(0, toNumber(row.prep_time, 30)),
    isFavorite: false,
    image: row.image_url?.trim() || null,
    ingredients: mapIngredients(row.ingredients),
    instructions: row.instructions ?? '',
    submittedBy: row.submitted_by ?? '',
    approved: toBoolean(row.approved),
    createdAt: row.created_at ?? null,
    averageRating: Math.max(0, toNumber(row.average_rating, 0)),
    ratingCount: Math.max(0, toNumber(row.rating_count, 0)),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
  };
}

export function mapPantryRow(row: DatabasePantryRow): PantryItem {
  return {
    id: row.id,
    userId: row.user_id,
    item: row.item,
    amount: toNumber(row.amount, 0),
    unit: row.unit,
    price: Math.max(0, toNumber(row.price, 0)),
    expirationDate: row.expiration_date ?? null,
    category: row.category?.trim() || 'Uncategorized',
    notes: row.notes ?? null,
    isActive: row.is_active !== false && row.is_active !== 0 && row.is_active !== 'false',
  };
}

export function toRecipeRow(recipe: Recipe): DatabaseRecipeRow {
  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    servings: recipe.servings,
    prep_time: recipe.prepTime,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    image_url: recipe.image,
    submitted_by: recipe.submittedBy,
    approved: recipe.approved,
    created_at: recipe.createdAt,
    average_rating: recipe.averageRating,
    rating_count: recipe.ratingCount,
    ...(recipe.sourceUrl ? { source_url: recipe.sourceUrl } : {}),
  };
}

export function toRecipeInsert(recipe: NewRecipe): DatabaseRecipeInsert {
  return {
    name: recipe.name,
    category: recipe.category,
    servings: recipe.servings,
    prep_time: recipe.prepTime,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    image_url: recipe.image,
    submitted_by: recipe.submittedBy,
    approved: false,
    created_at: null,
    average_rating: 0,
    rating_count: 0,
    ...(recipe.sourceUrl ? { source_url: recipe.sourceUrl } : {}),
  };
}

export function toPantryRow(item: PantryItem): DatabasePantryRow {
  return {
    id: item.id,
    user_id: item.userId,
    item: item.item,
    amount: item.amount,
    unit: item.unit,
    price: item.price,
    expiration_date: item.expirationDate,
    category: item.category,
    notes: item.notes,
    is_active: item.isActive,
  };
}

export function toPantryInsert(item: NewPantryItem): DatabasePantryInsert {
  return {
    user_id: item.userId,
    item: item.item,
    amount: item.amount,
    unit: item.unit,
    price: item.price,
    expiration_date: item.expirationDate,
    category: item.category,
    notes: item.notes,
    is_active: item.isActive,
  };
}
