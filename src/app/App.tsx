import { useCallback, useEffect, useRef, useState } from 'react';
import OrbitalNav, { type OrbitalSection } from './navigation/OrbitalNav';
import { createLocalDataSource, createSupabaseDataSource, type AppDataSource, emptyMealPlan } from './dataSource';
import RecipesView from '../features/recipes/RecipesView';
import PantryView from '../features/pantry/PantryView';
import MealPlannerView from '../features/meal-plan/MealPlannerView';
import ShoppingListView from '../features/shopping-list/ShoppingListView';
import ReceiptsView from '../features/receipts/ReceiptsView';
import type { ReceiptDraft } from '../features/receipt/receiptParser';
import type { MealPlan, NewPantryItem, NewRecipe, PantryItem, Recipe } from '../types/domain';
import { CURRENCY_SYMBOLS, type CurrencyCode } from '../lib/currency';
import { createAppCache, type AppCache, type CacheSnapshot } from '../lib/storage/cache';
import { isSupabaseConfigured } from '../lib/supabase/client';
import { normalizeCategoryText, type CategoryRule } from '../features/categories/categoryClassifier';
import { receiptDraftToCapture } from '../features/prices/receiptCapture';
import type { PriceCapture } from '../features/prices/types';

const CURRENCIES = Object.keys(CURRENCY_SYMBOLS) as CurrencyCode[];

interface AppProps {
  dataSource?: AppDataSource;
  cache?: AppCache;
}

function preference(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App({ dataSource, cache: providedCache }: AppProps) {
  const [cache] = useState<AppCache>(() => providedCache ?? createAppCache());
  const [source] = useState<AppDataSource>(() => dataSource ?? (isSupabaseConfigured() ? createSupabaseDataSource({ cache }) : createLocalDataSource(cache)));
  const [localSource] = useState<AppDataSource>(() => createLocalDataSource(cache));
  const [activeSection, setActiveSection] = useState<OrbitalSection>('plan');
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [mealPlan, setMealPlan] = useState<MealPlan>(emptyMealPlan);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [theme, setTheme] = useState(() => preference('theme', 'dark'));
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = preference('nutriplan.currency', 'PHP') as CurrencyCode;
    return CURRENCIES.includes(saved) ? saved : 'PHP';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const hydrated = useRef(false);
  // Keep cache defaults current without making the cache writer change identity
  // on every state update. Changing its identity was re-triggering loadData,
  // which remounted the active view and made the lower panel flicker.
  const cacheDefaults = useRef({ categoryRules, theme, currency });
  cacheDefaults.current = { categoryRules, theme, currency };

  const writeCache = useCallback((snapshot: Omit<CacheSnapshot, 'settings'> & { settings?: CacheSnapshot['settings'] }) => cache.writeSnapshot({ ...snapshot, categoryRules: snapshot.categoryRules ?? cacheDefaults.current.categoryRules, settings: snapshot.settings ?? { theme: cacheDefaults.current.theme, currency: cacheDefaults.current.currency } }), [cache]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const cached = await cache.readSnapshot();
    if (cached) {
      hydrated.current = true;
      setRecipes(cached.recipes);
      setPantry(cached.pantry);
      setMealPlan(cached.mealPlan);
      setCategoryRules(cached.categoryRules ?? []);
      if (cached.settings?.theme) setTheme(cached.settings.theme);
      if (cached.settings?.currency && CURRENCIES.includes(cached.settings.currency as CurrencyCode)) setCurrency(cached.settings.currency as CurrencyCode);
      setLoading(false);
    }
    // A cached snapshot is only a warm start: the local store is the truth for the pantry.
    try {
      const [loadedRecipes, loadedPantry, loadedMealPlan, loadedCategoryRules] = await Promise.all([source.listRecipes(), source.listPantry(), source.listMealPlan(), source.loadCategoryRules?.() ?? Promise.resolve([])]);
      setRecipes(loadedRecipes);
      setPantry(loadedPantry);
      setMealPlan(loadedMealPlan);
      setCategoryRules(loadedCategoryRules);
      setOnline(true);
      hydrated.current = true;
      await writeCache({ recipes: loadedRecipes, pantry: loadedPantry, mealPlan: loadedMealPlan, categoryRules: loadedCategoryRules });
    } catch (loadError) {
      if (cached) { setOnline(false); setError(null); } else setError(loadError instanceof Error ? loadError.message : 'Unable to load Nutriplan.');
    } finally {
      setLoading(false);
    }
  }, [cache, source, writeCache]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    const handleOnline = () => setOnline(true); const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem('theme', theme); } catch { /* private browsing */ }
    if (hydrated.current) void writeCache({ recipes, pantry, mealPlan });
  }, [mealPlan, pantry, recipes, theme, writeCache]);
  useEffect(() => {
    try { window.localStorage.setItem('nutriplan.currency', currency); } catch { /* private browsing */ }
    if (hydrated.current) void writeCache({ recipes, pantry, mealPlan });
  }, [currency, mealPlan, pantry, recipes, writeCache]);

  async function createRecipe(recipe: NewRecipe) {
    let created: Recipe;
    try { created = await source.createRecipe(recipe); } catch { setOnline(false); created = await localSource.createRecipe(recipe); }
    const next = [created, ...recipes]; setRecipes(next); await writeCache({ recipes: next, pantry, mealPlan });
  }

  async function importRecipes(importedRecipes: NewRecipe[]) {
    const created: Recipe[] = [];
    for (const recipe of importedRecipes) {
      try { created.push(await source.createRecipe(recipe)); } catch { setOnline(false); created.push(await localSource.createRecipe(recipe)); }
    }
    const next = [...created, ...recipes];
    setRecipes(next);
    await writeCache({ recipes: next, pantry, mealPlan });
  }

  async function updateRecipe(recipe: Recipe) {
    let updated: Recipe;
    try { updated = await source.updateRecipe(recipe); } catch { setOnline(false); updated = await localSource.updateRecipe(recipe); }
    const next = recipes.map((item) => item.id === updated.id ? updated : item); setRecipes(next); await writeCache({ recipes: next, pantry, mealPlan });
  }

  async function removeRecipe(id: string | number) {
    try { await source.removeRecipe?.(id); } catch { setOnline(false); await localSource.removeRecipe?.(id); }
    const next = recipes.filter((item) => item.id !== id); setRecipes(next); await writeCache({ recipes: next, pantry, mealPlan });
  }

  async function createPantryItem(item: NewPantryItem) {
    let created: PantryItem;
    try { created = await source.createPantryItem(item); } catch { setOnline(false); created = await localSource.createPantryItem(item); }
    const next = [...pantry, created]; setPantry(next); await writeCache({ recipes, pantry: next, mealPlan });
  }

  async function updatePantryItem(item: PantryItem) {
    let updated: PantryItem;
    try { updated = await source.updatePantryItem(item); } catch { setOnline(false); updated = await localSource.updatePantryItem(item); }
    const next = pantry.map((entry) => entry.id === updated.id ? updated : entry); setPantry(next); await writeCache({ recipes, pantry: next, mealPlan });
  }

  async function removePantryItem(id: string | number) {
    try { await source.removePantryItem(id); } catch { setOnline(false); await localSource.removePantryItem(id); }
    const next = pantry.filter((item) => item.id !== id); setPantry(next); await writeCache({ recipes, pantry: next, mealPlan });
  }

  async function savePantryNotes(id: string | number, notes: string | null) {
    try { await source.savePantryNotes(id, notes); } catch { setOnline(false); await localSource.savePantryNotes(id, notes); }
    const next = pantry.map((item) => item.id === id ? { ...item, notes } : item); setPantry(next); await writeCache({ recipes, pantry: next, mealPlan });
  }

  async function saveMealPlan(plan: MealPlan) {
    try { await source.replaceMealPlan(plan); } catch { setOnline(false); await localSource.replaceMealPlan(plan); }
    setMealPlan(plan); await writeCache({ recipes, pantry, mealPlan: plan });
  }

  async function cookRecipe(recipe: Recipe) {
    if (!source.inventory) {
      setError('Cooking is unavailable until local inventory storage is enabled.');
      return;
    }
    try {
      const operationId = `cook-${crypto.randomUUID()}`;
      const result = await source.inventory.consumeRecipe({ operationId, recipe });
      const refreshed = await source.listPantry();
      setPantry(refreshed);
      await writeCache({ recipes, pantry: refreshed, mealPlan });
      const missing = result.results.filter((item) => item.missing > 0);
      if (missing.length > 0) setError(`Cooked ${recipe.name}. Still missing: ${missing.map((item) => `${item.missing} ${item.unit} ${item.item}`).join(', ')}.`);
    } catch (cookError) {
      setError(cookError instanceof Error ? cookError.message : 'Unable to consume pantry stock.');
    }
  }

  const clearPendingReceipt = useCallback(() => setPendingReceiptId(null), []);

  async function recordQuote(capture: PriceCapture) {
    if (!source.prices) { setError('Price quotes need local inventory storage.'); return; }
    await source.prices.saveCapture(capture);
    await refreshPantryFromPriceStore();
  }

  async function findStockCollision(item: PantryItem) {
    try { return await source.findStockCollision(item); } catch { return null; }
  }

  async function mergeStock(sourceId: string, targetId: string) {
    await source.mergeStockInto(sourceId, targetId);
    await refreshPantryFromPriceStore();
  }

  async function refreshPantryFromPriceStore() {
    if (!source.prices) return;
    const refreshed = await source.listPantry();
    setPantry(refreshed);
    await writeCache({ recipes, pantry: refreshed, mealPlan });
  }

  async function importReceipt(draft: ReceiptDraft) {
    if (source.prices) {
      await source.prices.saveCapture(receiptDraftToCapture(draft, currency));
      const refreshed = await source.listPantry();
      setPantry(refreshed);
      await writeCache({ recipes, pantry: refreshed, mealPlan });
      return;
    }
    const imported: PantryItem[] = [];
    for (const item of draft.items) {
      const input: NewPantryItem = { userId: 'personal-user', item: item.name, amount: item.quantity, unit: 'units', price: item.unitPrice ?? item.totalPrice / item.quantity, expirationDate: null, category: item.category ?? 'Uncategorized', notes: draft.merchant || null, isActive: true };
      let created: PantryItem;
      try { created = await source.createPantryItem(input); } catch { setOnline(false); created = await localSource.createPantryItem(input); }
      imported.push(created);
      if (item.category && item.category !== 'Uncategorized') {
        const rule = { phrase: item.name, category: item.category, updatedAt: Date.now() } satisfies CategoryRule;
        await source.saveCategoryRule?.(rule);
        const normalizedRule = { ...rule, phrase: normalizeCategoryText(rule.phrase) };
        setCategoryRules((current) => [...current.filter((entry) => normalizeCategoryText(entry.phrase) !== normalizedRule.phrase), normalizedRule]);
      }
    }
    const next = [...pantry, ...imported];
    setPantry(next);
    await writeCache({ recipes, pantry: next, mealPlan });
  }

  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="brand-lockup"><img className="brand-icon" src="/nutriplan-logo.png" alt="" aria-hidden="true" /><div><strong>Nutriplan</strong><span>Personal kitchen planner</span></div></div>
        <div className="header-controls"><span className={online ? 'connection-status online' : 'connection-status offline'} role="status">{online ? 'Online' : 'Offline · cached data'}</span><label className="currency-control"><span className="sr-only">Currency</span><select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label><button className="theme-button" aria-label="Toggle theme" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button></div>
      </header>
      <OrbitalNav activeSection={activeSection} onChange={setActiveSection} />
      <main className="app-main">
        {loading ? <div className="state-panel"><span className="loading-dot" aria-hidden="true" /><h1>Loading your kitchen…</h1><p>Getting your recipes and pantry ready.</p></div> : error ? <div className="state-panel error-state" role="alert"><span aria-hidden="true">!</span><h1>Couldn’t load your kitchen</h1><p>{error}</p><button className="button primary" onClick={() => { setError(null); void loadData(); }}>Retry</button></div> : activeSection === 'plan' ? <MealPlannerView recipes={recipes} mealPlan={mealPlan} onChange={saveMealPlan} onCook={cookRecipe} /> : activeSection === 'shopping' ? <ShoppingListView recipes={recipes} pantry={pantry} mealPlan={mealPlan} /> : activeSection === 'pantry' ? <PantryView pantry={pantry} currency={currency} onCreate={createPantryItem} onUpdate={updatePantryItem} onRemove={removePantryItem} onSaveNotes={savePantryNotes} onQuote={recordQuote} onFindCollision={findStockCollision} onMerge={mergeStock} onOpenReceipt={(eventId) => { setPendingReceiptId(eventId); setActiveSection('receipts'); }} priceStore={source.prices} inventory={source.inventory} /> : activeSection === 'recipes' ? <RecipesView recipes={recipes} pantry={pantry} currency={currency} onCreate={createRecipe} onUpdate={updateRecipe} onRemove={removeRecipe} onImport={createRecipe} onImportRecipes={importRecipes} /> : source.inventory ? <ReceiptsView inventory={source.inventory} currency={currency} categoryRules={categoryRules} onSaveReceipt={importReceipt} onChanged={refreshPantryFromPriceStore} openEventId={pendingReceiptId} onOpened={clearPendingReceipt} /> : <section className="content-section"><div className="section-toolbar"><div><h2>Receipts</h2></div></div><div className="empty-state"><h3>Receipts need device storage</h3><p>Receipt history is kept on this device and is unavailable in this environment.</p></div></section>}
      </main>
    </div>
  );
}
