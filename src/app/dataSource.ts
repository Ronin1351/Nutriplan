import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addRecipeToCollection,
  createRecipe as createRecipeRecord,
  listRecipes,
  updateRecipe as updateRecipeRecord,
} from '../features/recipes/recipeApi';
import {
  createPantryItem as createPantryRecord,
  deletePantryItem,
  listPantry,
  savePantryNotes,
  updatePantryItem as updatePantryRecord,
} from '../features/pantry/pantryApi';
import { getSupabaseClient } from '../lib/supabase/client';
import { listMealPlan, replaceMealPlan } from '../features/meal-plan/mealPlanApi';
import type { MealPlan, NewMealPlanEntry, NewPantryItem, NewRecipe, PantryItem, Recipe } from '../types/domain';
import { createAppCache, type AppCache, type CacheSnapshot } from '../lib/storage/cache';
import { normalizeCategoryText, type CategoryRule } from '../features/categories/categoryClassifier';
import { createIndexedDbPriceStore } from '../features/prices/indexedDbPriceStore';
import type { PriceStore } from '../features/prices/types';

export interface AppDataSource {
  listRecipes(): Promise<Recipe[]>;
  createRecipe(input: NewRecipe): Promise<Recipe>;
  updateRecipe(recipe: Recipe): Promise<Recipe>;
  removeRecipe?(id: string | number): Promise<void>;
  listPantry(): Promise<PantryItem[]>;
  createPantryItem(input: NewPantryItem): Promise<PantryItem>;
  updatePantryItem(item: PantryItem): Promise<PantryItem>;
  removePantryItem(id: string | number): Promise<void>;
  savePantryNotes(id: string | number, notes: string | null): Promise<void>;
  loadCategoryRules(): Promise<CategoryRule[]>;
  saveCategoryRule(rule: CategoryRule): Promise<void>;
  listMealPlan(): Promise<MealPlan>;
  replaceMealPlan(plan: MealPlan): Promise<void>;
  prices?: PriceStore;
  isRemoteConfigured?: boolean;
}

export function createSupabaseDataSource(options: {
  client?: SupabaseClient;
  userId?: string | number;
  cache?: AppCache;
} = {}): AppDataSource {
  const resolveClient = () => options.client ?? getSupabaseClient();
  const userId = options.userId ?? import.meta.env.VITE_PERSONAL_USER_ID ?? 'personal-user';
  const cache = options.cache ?? createAppCache();
  const priceStore = typeof indexedDB !== 'undefined' ? createIndexedDbPriceStore() : undefined;
  let cacheSnapshot: CacheSnapshot = { recipes: [], pantry: [], mealPlan: emptyMealPlan(), settings: { theme: 'light', currency: 'PHP' }, categoryRules: [] };
  let cacheHydrated = false;
  const ensureCache = async () => { if (!cacheHydrated) { const existing = await cache.readSnapshot(); cacheSnapshot = { ...cacheSnapshot, ...(existing ?? {}), categoryRules: existing?.categoryRules ?? [] }; cacheHydrated = true; } };
  const persistCategoryRules = async (categoryRules: CategoryRule[]) => { await ensureCache(); const latest = await cache.readSnapshot(); cacheSnapshot = { ...cacheSnapshot, ...(latest ?? {}), categoryRules }; await cache.writeSnapshot(cacheSnapshot); };

  return {
    isRemoteConfigured: true,
    prices: priceStore,
    listRecipes: () => listRecipes(resolveClient()),
    createRecipe: async (input) => {
      const recipe = await createRecipeRecord(resolveClient(), input);
      if (recipe.id != null) {
        await addRecipeToCollection(resolveClient(), userId, recipe.id);
      }
      return recipe;
    },
    updateRecipe: (recipe) => updateRecipeRecord(resolveClient(), recipe),
    removeRecipe: async (id) => { await resolveClient().from('recipes').delete().eq('id', id); },
    listPantry: () => priceStore?.listStock() ?? listPantry(resolveClient(), userId),
    createPantryItem: (input) => priceStore?.createStock(input) ?? createPantryRecord(resolveClient(), input),
    updatePantryItem: (item) => priceStore?.updateStock(item) ?? updatePantryRecord(resolveClient(), item),
    removePantryItem: (id) => priceStore?.removeStock(id) ?? deletePantryItem(resolveClient(), id),
    savePantryNotes: (id, notes) => priceStore?.saveStockNotes(id, notes) ?? savePantryNotes(resolveClient(), id, notes),
    loadCategoryRules: async () => { await ensureCache(); return cacheSnapshot.categoryRules ?? []; },
    saveCategoryRule: async (rule) => { if (rule.category === 'Uncategorized') return; await ensureCache(); const phrase = normalizeCategoryText(rule.phrase); if (!phrase) return; await persistCategoryRules([...(cacheSnapshot.categoryRules ?? []).filter((entry) => normalizeCategoryText(entry.phrase) !== phrase), { ...rule, phrase }]); },
    listMealPlan: async () => {
      const entries = await listMealPlan(resolveClient(), userId);
      return entries.reduce<MealPlan>((plan, entry) => { plan[entry.day].push(entry.recipeId); return plan; }, emptyMealPlan());
    },
    replaceMealPlan: async (plan) => {
      const entries: NewMealPlanEntry[] = Object.entries(plan).flatMap(([day, recipeIds]) => recipeIds.map((recipeId, position) => ({ day: day as NewMealPlanEntry['day'], recipeId, position })));
      await replaceMealPlan(resolveClient(), userId, entries);
    },
  };
}

function localId(prefix: string): string {
  try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

export function createLocalDataSource(cache: AppCache = createAppCache()): AppDataSource {
  let snapshot: CacheSnapshot = { recipes: [], pantry: [], mealPlan: emptyMealPlan(), settings: { theme: 'light', currency: 'PHP' }, categoryRules: [] };
  let hydrated = false;
  const priceStore = typeof indexedDB !== 'undefined' ? createIndexedDbPriceStore() : undefined;
  let priceStockMigrated = false;
  const ensureHydrated = async () => { if (!hydrated) { const existing = await cache.readSnapshot(); snapshot = { ...snapshot, ...(existing ?? {}), categoryRules: existing?.categoryRules ?? [] }; hydrated = true; } };
  const ensurePriceStock = async () => {
    await ensureHydrated();
    if (!priceStore || priceStockMigrated) return;
    const existing = await priceStore.listStock();
    if (existing.length === 0 && snapshot.pantry.length > 0) for (const item of snapshot.pantry) await priceStore.createStock(item);
    priceStockMigrated = true;
  };
  const persist = () => cache.writeSnapshot(snapshot);
  return {
    isRemoteConfigured: false,
    prices: priceStore,
    listRecipes: async () => { await ensureHydrated(); return snapshot.recipes; },
    createRecipe: async (input) => { await ensureHydrated(); const recipe: Recipe = { ...input, id: localId('recipe'), isFavorite: false, createdAt: new Date().toISOString(), approved: true, averageRating: 0, ratingCount: 0 }; snapshot = { ...snapshot, recipes: [recipe, ...snapshot.recipes] }; await persist(); return recipe; },
    updateRecipe: async (recipe) => { await ensureHydrated(); snapshot = { ...snapshot, recipes: snapshot.recipes.map((item) => item.id === recipe.id ? recipe : item) }; await persist(); return recipe; },
    removeRecipe: async (id) => { await ensureHydrated(); snapshot = { ...snapshot, recipes: snapshot.recipes.filter((item) => item.id !== id) }; await persist(); },
    listPantry: async () => { await ensurePriceStock(); return priceStore ? priceStore.listStock() : snapshot.pantry; },
    createPantryItem: async (input) => { if (priceStore) return priceStore.createStock(input); await ensureHydrated(); const item: PantryItem = { ...input, id: localId('pantry') }; snapshot = { ...snapshot, pantry: [...snapshot.pantry, item] }; await persist(); return item; },
    updatePantryItem: async (item) => { if (priceStore) return priceStore.updateStock(item); await ensureHydrated(); snapshot = { ...snapshot, pantry: snapshot.pantry.map((entry) => entry.id === item.id ? item : entry) }; await persist(); return item; },
    removePantryItem: async (id) => { if (priceStore) return priceStore.removeStock(id); await ensureHydrated(); snapshot = { ...snapshot, pantry: snapshot.pantry.filter((item) => item.id !== id) }; await persist(); },
    savePantryNotes: async (id, notes) => { if (priceStore) return priceStore.saveStockNotes(id, notes); await ensureHydrated(); snapshot = { ...snapshot, pantry: snapshot.pantry.map((item) => item.id === id ? { ...item, notes } : item) }; await persist(); },
    loadCategoryRules: async () => { await ensureHydrated(); return snapshot.categoryRules ?? []; },
    saveCategoryRule: async (rule) => { if (rule.category === 'Uncategorized') return; await ensureHydrated(); const latest = await cache.readSnapshot(); snapshot = { ...snapshot, ...(latest ?? {}) }; const phrase = normalizeCategoryText(rule.phrase); if (!phrase) return; snapshot = { ...snapshot, categoryRules: [...(snapshot.categoryRules ?? []).filter((entry) => normalizeCategoryText(entry.phrase) !== phrase), { ...rule, phrase }] }; await persist(); },
    listMealPlan: async () => { await ensureHydrated(); return snapshot.mealPlan; },
    replaceMealPlan: async (plan) => { await ensureHydrated(); snapshot = { ...snapshot, mealPlan: plan }; await persist(); },
  };
}

export function emptyMealPlan(): MealPlan {
  return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
}
