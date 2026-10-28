import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, unwrapSupabase } from '../../lib/supabase/client';
import type { DatabaseMealPlanRow } from '../../types/database';
import type { MealPlanEntry, NewMealPlanEntry } from '../../types/domain';

export async function listMealPlan(
  client: SupabaseClient = getSupabaseClient(),
  userId: string | number,
): Promise<MealPlanEntry[]> {
  const rows = await unwrapSupabase<DatabaseMealPlanRow[]>(
    client.from('meal_plans').select('*').eq('user_id', userId).order('day', { ascending: true }).order('position', { ascending: true }),
    'List meal plan',
  );

  return rows.map((row) => ({
    userId: row.user_id,
    day: row.day,
    recipeId: row.recipe_id,
    position: Number(row.position),
  }));
}

export async function replaceMealPlan(
  client: SupabaseClient,
  userId: string | number,
  entries: NewMealPlanEntry[],
): Promise<void> {
  await unwrapSupabase<DatabaseMealPlanRow[]>(
    client.from('meal_plans').delete().eq('user_id', userId),
    'Clear meal plan',
  );

  if (entries.length === 0) return;

  await unwrapSupabase<DatabaseMealPlanRow[]>(
    client.from('meal_plans').insert(
      entries.map((entry) => ({
        user_id: userId,
        day: entry.day,
        recipe_id: entry.recipeId,
        position: entry.position,
      })),
    ).select(),
    'Replace meal plan',
  );
}
