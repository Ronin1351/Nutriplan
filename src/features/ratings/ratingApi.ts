import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, unwrapSupabase } from '../../lib/supabase/client';
import type { DatabaseRatingRow } from '../../types/database';
import type { Rating } from '../../types/domain';

export async function getUserRating(
  client: SupabaseClient = getSupabaseClient(),
  userId: string | number,
  recipeId: string | number,
): Promise<Rating | null> {
  const rows = await unwrapSupabase<DatabaseRatingRow[]>(
    client.from('ratings').select('*').eq('user_id', userId).eq('recipe_id', recipeId),
    'Get rating',
  );
  const row = rows[0];
  return row ? { userId: row.user_id, recipeId: row.recipe_id, rating: Number(row.rating) } : null;
}

export async function upsertRating(
  client: SupabaseClient,
  userId: string | number,
  recipeId: string | number,
  rating: number,
): Promise<Rating> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const existing = await getUserRating(client, userId, recipeId);
  const rows = existing
    ? await unwrapSupabase<DatabaseRatingRow[]>(
        client.from('ratings').update({ rating }).eq('user_id', userId).eq('recipe_id', recipeId).select(),
        'Update rating',
      )
    : await unwrapSupabase<DatabaseRatingRow[]>(
        client.from('ratings').insert({ user_id: userId, recipe_id: recipeId, rating }).select(),
        'Create rating',
      );

  const row = rows[0];
  return row
    ? { userId: row.user_id, recipeId: row.recipe_id, rating: Number(row.rating) }
    : { userId, recipeId, rating };
}
