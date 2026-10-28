import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createRecipe,
  listRecipes,
} from '../../features/recipes/recipeApi';
import { listPantry, updatePantryItem } from '../../features/pantry/pantryApi';
import { replaceMealPlan } from '../../features/meal-plan/mealPlanApi';
import { upsertRating } from '../../features/ratings/ratingApi';
import type { User } from '../../types/domain';

type ResponseValue = { data: unknown; error: { message: string } | null };

function createQueryBuilder(response: ResponseValue) {
  const builder: any = {};
  const chain = () => builder;

  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
    builder[method] = vi.fn(chain);
  }

  builder.then = (resolve: (value: ResponseValue) => unknown) => Promise.resolve(response).then(resolve);
  return builder;
}

function createClient(responses: Record<string, ResponseValue>) {
  const builders = new Map<string, ReturnType<typeof createQueryBuilder>>();
  const client = {
    from: vi.fn((table: string) => {
      const existing = builders.get(table);
      if (existing) return existing;
      const builder = createQueryBuilder(responses[table] ?? { data: [], error: null });
      builders.set(table, builder);
      return builder;
    }),
  };

  return { client: client as unknown as SupabaseClient, builders };
}

const user: User = {
  id: 'user-1',
  username: 'alex',
  name: 'Alex',
  email: 'alex@example.com',
  avatarUrl: null,
  isAdmin: false,
};

describe('typed Supabase repositories', () => {
  it('returns an empty guest recipe list without inventing records', async () => {
    const { client } = createClient({ recipes: { data: [], error: null } });

    await expect(listRecipes(client)).resolves.toEqual([]);
  });

  it('merges approved recipes and the signed-in user pending recipes', async () => {
    const { client } = createClient({
      recipes: {
        data: [
          {
            id: 'recipe-1',
            name: 'Soup',
            category: 'Dinner',
            servings: 2,
            prep_time: 15,
            ingredients: [],
            instructions: 'Cook.',
            image_url: null,
            submitted_by: 'alex',
            approved: true,
            created_at: null,
            average_rating: 0,
            rating_count: 0,
          },
        ],
        error: null,
      },
    });

    const recipes = await listRecipes(client, user);

    expect(recipes).toHaveLength(1);
    expect(recipes[0].prepTime).toBe(15);
  });

  it('creates a recipe with database field names and maps the returned row', async () => {
    const { client, builders } = createClient({
      recipes: {
        data: [
          {
            id: 'recipe-1',
            name: 'Soup',
            category: 'Dinner',
            servings: 2,
            prep_time: 15,
            ingredients: [{ item: 'carrot', amount: 1, unit: 'each' }],
            instructions: 'Cook.',
            image_url: null,
            submitted_by: 'alex',
            approved: false,
            created_at: null,
            average_rating: 0,
            rating_count: 0,
          },
        ],
        error: null,
      },
    });

    await createRecipe(client, {
      name: 'Soup',
      category: 'Dinner',
      servings: 2,
      prepTime: 15,
      ingredients: [{ item: 'carrot', amount: 1, unit: 'each' }],
      instructions: 'Cook.',
      image: null,
      submittedBy: 'alex',
      sourceUrl: 'https://example.com/soup',
    });

    expect(builders.get('recipes')?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Soup',
        prep_time: 15,
        image_url: null,
        submitted_by: 'alex',
        approved: false,
        source_url: 'https://example.com/soup',
      }),
    );
  });

  it('maps pantry rows and writes updates with snake_case fields', async () => {
    const { client, builders } = createClient({
      pantry: {
        data: [
          {
            id: 'pantry-1',
            user_id: 'user-1',
            item: 'flour',
            amount: '2',
            unit: 'cup',
            price: '4.25',
            expiration_date: null,
            category: 'Pantry',
            notes: null,
            is_active: true,
          },
        ],
        error: null,
      },
    });

    const items = await listPantry(client, 'user-1');
    await updatePantryItem(client, items[0]);

    expect(items[0].amount).toBe(2);
    expect(builders.get('pantry')?.update).toHaveBeenCalledWith(
      expect.objectContaining({ expiration_date: null, is_active: true }),
    );
  });

  it('replaces a user meal plan by deleting old rows and inserting new entries', async () => {
    const { client, builders } = createClient({ meal_plans: { data: [], error: null } });

    await replaceMealPlan(client, 'user-1', [
      { day: 'Monday', recipeId: 'recipe-1', position: 0 },
    ]);

    expect(builders.get('meal_plans')?.delete).toHaveBeenCalled();
    expect(builders.get('meal_plans')?.insert).toHaveBeenCalledWith([
      { user_id: 'user-1', day: 'Monday', recipe_id: 'recipe-1', position: 0 },
    ]);
  });

  it('rejects ratings outside the one-to-five range before writing', async () => {
    const { client } = createClient({ ratings: { data: [], error: null } });

    await expect(upsertRating(client, 'user-1', 'recipe-1', 6)).rejects.toThrow(
      'Rating must be between 1 and 5',
    );
  });

  it('propagates Supabase errors instead of returning partial data', async () => {
    const { client } = createClient({
      pantry: { data: null, error: { message: 'permission denied' } },
    });

    await expect(listPantry(client, 'user-1')).rejects.toThrow('permission denied');
  });
});
