import { describe, expect, it } from 'vitest';
import { createAppCache, type CacheBackend } from './cache';
import type { MealPlan, PantryItem, Recipe } from '../../types/domain';

const recipe: Recipe = { id: 'cached-recipe', name: 'Cached Soup', category: 'Dinner', servings: 2, prepTime: 20, isFavorite: false, image: null, ingredients: [], instructions: 'Cook.', submittedBy: 'Personal', approved: true, createdAt: null, averageRating: 0, ratingCount: 0 };
const mealPlan: MealPlan = { Monday: ['cached-recipe'], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };

function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => { values.set(key, value); } };
}

function memoryBackend(): CacheBackend & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return { values, async get(key) { return values.get(key) ?? null; }, async set(key, value) { values.set(key, value); } };
}

describe('local-first cache', () => {
  it('writes and reads a snapshot through the IndexedDB backend when available', async () => {
    const indexedDb = memoryBackend();
    const cache = createAppCache({ indexedDb, localStorage: storage() });
    await cache.writeSnapshot({ recipes: [recipe], pantry: [], mealPlan, settings: { theme: 'dark', currency: 'USD' } });

    expect(indexedDb.values.has('snapshot')).toBe(true);
    await expect(cache.readSnapshot()).resolves.toMatchObject({ recipes: [recipe], mealPlan, settings: { theme: 'dark', currency: 'USD' } });
  });

  it('falls back to localStorage when the IndexedDB backend fails', async () => {
    const local = storage();
    const broken: CacheBackend = { get: async () => { throw new Error('IndexedDB unavailable'); }, set: async () => { throw new Error('IndexedDB unavailable'); } };
    const cache = createAppCache({ indexedDb: broken, localStorage: local });
    await cache.writeSnapshot({ recipes: [recipe], pantry: [], mealPlan, settings: { theme: 'light', currency: 'PHP' } });

    expect(local.getItem('nutriplan.cache.snapshot')).not.toBeNull();
    await expect(cache.readSnapshot()).resolves.toMatchObject({ recipes: [recipe], settings: { currency: 'PHP' } });
  });
});
