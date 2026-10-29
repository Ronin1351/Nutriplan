import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import type { AppDataSource } from './dataSource';
import type { MealPlan, PantryItem, Recipe } from '../types/domain';
import type { AppCache } from '../lib/storage/cache';

const recipe: Recipe = {
  id: 'recipe-1',
  name: 'Tomato Soup',
  category: 'Dinner',
  servings: 2,
  prepTime: 20,
  isFavorite: false,
  image: null,
  ingredients: [{ item: 'tomato', amount: 4, unit: 'each' }],
  instructions: 'Simmer.',
  submittedBy: 'Personal',
  approved: true,
  createdAt: null,
  averageRating: 0,
  ratingCount: 0,
};

const pantryItem: PantryItem = {
  id: 'pantry-1',
  userId: 'personal-user',
  item: 'tomato',
  amount: 2,
  unit: 'each',
  price: 1.5,
  expirationDate: null,
  category: 'Produce',
  notes: 'Use soon',
  isActive: true,
};

function createDataSource(overrides: Partial<AppDataSource> = {}): AppDataSource {
  const mealPlan: MealPlan = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [],
  };
  return {
    listRecipes: vi.fn().mockResolvedValue([recipe]),
    createRecipe: vi.fn().mockResolvedValue({ ...recipe, id: 'recipe-2' }),
    updateRecipe: vi.fn().mockResolvedValue(recipe),
    listPantry: vi.fn().mockResolvedValue([pantryItem]),
    createPantryItem: vi.fn().mockResolvedValue(pantryItem),
    updatePantryItem: vi.fn().mockResolvedValue(pantryItem),
    removePantryItem: vi.fn().mockResolvedValue(undefined),
    savePantryNotes: vi.fn().mockResolvedValue(undefined),
    findStockCollision: vi.fn().mockResolvedValue(null),
    mergeStockInto: vi.fn().mockResolvedValue(pantryItem),
    loadCategoryRules: vi.fn().mockResolvedValue([]),
    saveCategoryRule: vi.fn().mockResolvedValue(undefined),
    listMealPlan: vi.fn().mockResolvedValue(mealPlan),
    replaceMealPlan: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('personal mobile app shell', () => {
  it('loads recipes and switches between compact mobile sections', async () => {
    const user = userEvent.setup();
    const dataSource = createDataSource();
    render(<App dataSource={dataSource} />);

    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByText('Tomato Soup')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Pantry/i }));

    expect(await screen.findByRole('heading', { name: 'Pantry' })).toBeInTheDocument();
    expect(screen.getByText('tomato')).toBeInTheDocument();
  });

  it('creates a recipe through the typed data source', async () => {
    const user = userEvent.setup();
    const dataSource = createDataSource();
    render(<App dataSource={dataSource} />);

    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add recipe/i }));
    await user.type(screen.getByLabelText('Recipe name'), 'Rice Bowl');
    await user.type(screen.getByLabelText('Ingredients'), '1 cup rice');
    await user.type(screen.getByLabelText('Instructions'), 'Cook rice.');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));

    expect(dataSource.createRecipe).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Rice Bowl',
      instructions: 'Cook rice.',
    }));
  });

  it('filters pantry items and saves edited notes', async () => {
    const user = userEvent.setup();
    const dataSource = createDataSource();
    render(<App dataSource={dataSource} />);

    await user.click(screen.getByRole('button', { name: /Pantry/i }));
    await user.type(screen.getByLabelText('Search pantry'), 'not-found');
    expect(screen.getByText('No pantry items match your search.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search pantry'));
    await user.click(screen.getByRole('button', { name: /Edit notes for tomato/i }));
    const notes = screen.getByLabelText('Notes for tomato');
    await user.clear(notes);
    await user.type(notes, 'Use today');
    await user.click(screen.getByRole('button', { name: 'Save notes' }));

    expect(dataSource.savePantryNotes).toHaveBeenCalledWith('pantry-1', 'Use today');
  });

  it('shows a retryable error when loading fails', async () => {
    const dataSource = createDataSource({
      listRecipes: vi.fn().mockRejectedValue(new Error('Network unavailable')),
    });
    render(<App dataSource={dataSource} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('adds and removes a recipe from a planner day and persists the plan', async () => {
    const user = userEvent.setup();
    const dataSource = createDataSource();
    render(<App dataSource={dataSource} />);

    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Plan' }));
    await user.selectOptions(screen.getByLabelText('Add meal to Monday'), 'recipe-1');

    expect(await screen.findByRole('button', { name: 'Remove Tomato Soup from Monday' })).toBeInTheDocument();
    expect(dataSource.replaceMealPlan).toHaveBeenCalledWith(expect.objectContaining({
      Monday: ['recipe-1'],
    }));

    await user.click(screen.getByRole('button', { name: 'Remove Tomato Soup from Monday' }));
    expect(dataSource.replaceMealPlan).toHaveBeenLastCalledWith(expect.objectContaining({ Monday: [] }));
  });

  it('shows missing shopping items derived from the saved planner and pantry', async () => {
    const user = userEvent.setup();
    const dataSource = createDataSource({
      listMealPlan: vi.fn().mockResolvedValue({
        Monday: ['recipe-1'], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [],
      }),
    });
    render(<App dataSource={dataSource} />);

    await screen.findByRole('heading', { name: 'Recipes' });
    await user.click(screen.getByRole('button', { name: 'Shopping' }));

    expect(await screen.findByRole('heading', { name: 'Shopping list' })).toBeInTheDocument();
    expect(screen.getByText('Missing ingredients')).toBeInTheDocument();
    expect(screen.getByText('tomato')).toBeInTheDocument();
    expect(screen.getByText('2 each to buy')).toBeInTheDocument();
  });

  it('previews pasted recipe content before saving the imported recipe', async () => {
    const user = userEvent.setup();
    const dataSource = createDataSource();
    render(<App dataSource={dataSource} />);

    await screen.findByRole('heading', { name: 'Recipes' });
    await user.click(screen.getByRole('button', { name: 'Import recipe' }));
    await user.click(screen.getByRole('button', { name: 'Paste content' }));
    await user.type(screen.getByLabelText('Recipe content'), '<h1>Toast</h1><ul><li>1 slice bread</li></ul>');
    await user.click(screen.getByRole('button', { name: 'Parse recipe' }));

    expect(await screen.findByRole('heading', { name: 'Review imported recipe' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Recipe name'));
    await user.type(screen.getByLabelText('Recipe name'), 'Morning Toast');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));

    expect(dataSource.createRecipe).toHaveBeenCalledWith(expect.objectContaining({ name: 'Morning Toast' }));
  });

  it('starts from cached data and shows offline status when remote reads fail', async () => {
    const dataSource = createDataSource({
      listRecipes: vi.fn().mockRejectedValue(new Error('Network unavailable')),
      listPantry: vi.fn().mockRejectedValue(new Error('Network unavailable')),
      listMealPlan: vi.fn().mockRejectedValue(new Error('Network unavailable')),
    });
    const cache: AppCache = {
      readSnapshot: vi.fn().mockResolvedValue({ recipes: [{ ...recipe, name: 'Offline Soup' }], pantry: [], mealPlan: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] }, settings: { theme: 'light', currency: 'PHP' } }),
      writeSnapshot: vi.fn().mockResolvedValue(undefined),
    };
    render(<App dataSource={dataSource} cache={cache} />);

    expect(await screen.findByText('Offline Soup')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
  });

  it('imports a recipe URL through the mobile-safe server endpoint', async () => {
    const user = userEvent.setup();
    const dataSource = createDataSource();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      name: 'Web Soup', category: 'Dinner', servings: 2, prepTime: 15,
      ingredients: [{ item: 'carrot', amount: 1, unit: 'each' }], instructions: 'Simmer.',
      imageUrl: '', submittedBy: 'Personal', approved: false, sourceUrl: 'https://example.com/soup',
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    render(<App dataSource={dataSource} />);

    await screen.findByRole('heading', { name: 'Recipes' });
    await user.click(screen.getByRole('button', { name: 'Import recipe' }));
    await user.type(screen.getByLabelText('Recipe URL'), 'https://example.com/soup');
    await user.click(screen.getByRole('button', { name: 'Parse recipe' }));

    expect(await screen.findByRole('heading', { name: 'Review imported recipe' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/recipe-import', expect.objectContaining({ method: 'POST' }));
    vi.unstubAllGlobals();
  });

  it('routes every orbital destination to its matching workspace', async () => {
    const user = userEvent.setup();
    render(<App dataSource={createDataSource()} />);

    await screen.findByRole('heading', { name: 'Recipes' });
    await user.click(screen.getByRole('button', { name: 'Pantry' }));
    expect(await screen.findByRole('heading', { name: 'Pantry' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Plan' }));
    expect(await screen.findByRole('heading', { name: /planner/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Shopping' }));
    expect(await screen.findByRole('heading', { name: 'Shopping list' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('heading', { name: 'Import recipe' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recipes' }));
    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
  });
});
