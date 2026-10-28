import type { SupabaseClient } from '@supabase/supabase-js';
import { mapRecipeRow, toRecipeInsert, toRecipeRow } from '../../lib/mappers';
import { getSupabaseClient, unwrapSupabase } from '../../lib/supabase/client';
import type { DatabaseRecipeRow, DatabaseUserRecipeRow } from '../../types/database';
import type { NewRecipe, Recipe, User } from '../../types/domain';

const RECIPE_SELECT = 'id,name,category,servings,prep_time,ingredients,instructions,image_url,submitted_by,approved,created_at,average_rating,rating_count,source_url';

export async function listRecipes(
  client: SupabaseClient = getSupabaseClient(),
  user: User | null = null,
): Promise<Recipe[]> {
  if (user?.isAdmin) {
    const rows = await unwrapSupabase<DatabaseRecipeRow[]>(
      client.from('recipes').select(RECIPE_SELECT).order('created_at', { ascending: false }),
      'List recipes',
    );
    return rows.map(mapRecipeRow);
  }

  const approvedRequest = client.from('recipes').select(RECIPE_SELECT).eq('approved', true).order('created_at', { ascending: false });
  const approved = await unwrapSupabase<DatabaseRecipeRow[]>(
    user ? approvedRequest : approvedRequest.limit(20),
    'List approved recipes',
  );

  if (!user) return approved.map(mapRecipeRow);

  const pending = await unwrapSupabase<DatabaseRecipeRow[]>(
    client.from('recipes').select(RECIPE_SELECT).eq('submitted_by', user.username).eq('approved', false),
    'List pending recipes',
  );

  const uniqueRows = new Map<string | number, DatabaseRecipeRow>();
  [...approved, ...pending].forEach((row) => uniqueRows.set(row.id, row));
  return [...uniqueRows.values()].map(mapRecipeRow);
}

export async function createRecipe(
  client: SupabaseClient,
  recipe: NewRecipe,
): Promise<Recipe> {
  const rows = await unwrapSupabase<DatabaseRecipeRow[]>(
    client.from('recipes').insert(toRecipeInsert(recipe)).select(RECIPE_SELECT),
    'Create recipe',
  );
  const row = rows[0];
  if (!row) throw new Error('Create recipe: Supabase returned no recipe.');
  return mapRecipeRow(row);
}

export async function updateRecipe(client: SupabaseClient, recipe: Recipe): Promise<Recipe> {
  const rows = await unwrapSupabase<DatabaseRecipeRow[]>(
    client.from('recipes').update(toRecipeRow(recipe)).eq('id', recipe.id).select(RECIPE_SELECT),
    'Update recipe',
  );
  const row = rows[0];
  if (!row) throw new Error('Update recipe: Supabase returned no recipe.');
  return mapRecipeRow(row);
}

export async function addRecipeToCollection(
  client: SupabaseClient,
  userId: string | number,
  recipeId: string | number,
): Promise<void> {
  await unwrapSupabase<DatabaseUserRecipeRow[]>(
    client.from('user_recipes').insert({ user_id: userId, recipe_id: recipeId }).select(),
    'Add recipe to collection',
  );
}

export async function removeRecipeFromCollection(
  client: SupabaseClient,
  userId: string | number,
  recipeId: string | number,
): Promise<void> {
  await unwrapSupabase<DatabaseUserRecipeRow[]>(
    client.from('user_recipes').delete().eq('user_id', userId).eq('recipe_id', recipeId),
    'Remove recipe from collection',
  );
}
