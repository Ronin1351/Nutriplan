import { useRef, useState } from 'react';
import RecipeEditor from './RecipeEditor';
import RecipeImportPanel from './RecipeImportPanel';
import RecipeAddMenu, { type RecipeAddChoice } from './RecipeAddMenu';
import RecipePhotoImport from './RecipePhotoImport';
import { formatCurrency } from '../../lib/currency';
import { calculateRecipeCost } from '../../lib/recipes';
import { createRecipeExport, parseRecipeExport } from '../../lib/recipe-transfer';
import type { NewRecipe, PantryItem, Recipe } from '../../types/domain';

interface RecipesViewProps {
  recipes: Recipe[];
  pantry: PantryItem[];
  currency: Parameters<typeof formatCurrency>[1];
  onCreate: (recipe: NewRecipe) => Promise<void>;
  onUpdate: (recipe: Recipe) => Promise<void>;
  onRemove: (id: string | number) => Promise<void>;
  onImport: (recipe: NewRecipe) => Promise<void>;
  onImportRecipes: (recipes: NewRecipe[]) => Promise<void>;
}

export default function RecipesView({ recipes, pantry, currency, onCreate, onUpdate, onRemove, onImport, onImportRecipes }: RecipesViewProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null | undefined>(undefined);
  const [importing, setImporting] = useState<'url' | 'paste' | 'photo' | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const visibleRecipes = recipes.filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase()) || recipe.category.toLowerCase().includes(query.toLowerCase()));

  function exportRecipes() {
    const blob = new Blob([createRecipeExport(recipes)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nutriplan-recipes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importRecipesFile(file: File) {
    setTransferBusy(true);
    setTransferError(null);
    try {
      const imported = parseRecipeExport(await file.text());
      await onImportRecipes(imported);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'The recipe file could not be imported.');
    } finally {
      setTransferBusy(false);
      if (importInput.current) importInput.current.value = '';
    }
  }

  if (editingRecipe !== undefined) {
    return <RecipeEditor recipe={editingRecipe} onSave={async (value) => { if ('id' in value) await onUpdate(value); else await onCreate(value); setEditingRecipe(undefined); }} onDelete={async (id) => { await onRemove(id); setEditingRecipe(undefined); setSelectedRecipe(null); }} onCancel={() => setEditingRecipe(undefined)} />;
  }

  if (importing === 'photo') return <RecipePhotoImport onSave={async (recipe) => { await onImport(recipe); setImporting(null); }} onCancel={() => setImporting(null)} />;
  if (importing) return <RecipeImportPanel initialMode={importing} onSave={async (recipe) => { await onImport(recipe); setImporting(null); }} onCancel={() => setImporting(null)} />;

  function choose(choice: RecipeAddChoice) {
    if (choice === 'new') setEditingRecipe(null);
    else if (choice === 'json') importInput.current?.click();
    else setImporting(choice);
  }

  if (selectedRecipe) {
    const cost = calculateRecipeCost(selectedRecipe, pantry);
    return (
      <section className="content-section">
        <button className="back-link" onClick={() => setSelectedRecipe(null)}>← All recipes</button>
        <article className="detail-panel">
          <div className="detail-hero"><div className="recipe-mark">{selectedRecipe.name.slice(0, 1).toUpperCase()}</div><div><p className="section-kicker">{selectedRecipe.category}</p><h2>{selectedRecipe.name}</h2><p className="muted">{selectedRecipe.servings} servings · {selectedRecipe.prepTime} minutes</p></div></div>
          <h3>Ingredients</h3><ul className="ingredient-list">{selectedRecipe.ingredients.map((ingredient) => <li key={`${ingredient.item}-${ingredient.amount}`}><span>{ingredient.amount} {ingredient.unit}</span><strong>{ingredient.item}</strong></li>)}</ul>
          <h3>Instructions</h3><p className="instructions">{selectedRecipe.instructions}</p>
          <div className="cost-line"><span>Estimated pantry cost</span><strong>{formatCurrency(cost.total, currency)}</strong></div>
          {cost.missingItems.length > 0 && <p className="muted">Missing from pantry: {cost.missingItems.join(', ')}</p>}
          <button className="button primary full-width" onClick={() => setEditingRecipe(selectedRecipe)}>Edit recipe</button>
        </article>
      </section>
    );
  }

  return (
    <section className="content-section">
      <div className="section-toolbar"><div><h2>Recipes</h2></div><div className="toolbar-actions"><RecipeAddMenu onSelect={choose} /><div className="dropdown"><button className="button secondary" aria-label="More actions" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>⋯</button>{moreOpen && <div className="dropdown-menu" role="menu"><button role="menuitem" disabled={recipes.length === 0} onClick={() => { setMoreOpen(false); exportRecipes(); }}>Export JSON</button></div>}</div><input ref={importInput} className="sr-only" type="file" accept="application/json,.json" aria-label="Import recipes JSON file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importRecipesFile(file); }} /></div></div>
      {transferError && <div className="validation-errors" role="alert">{transferError}</div>}
      {transferBusy && <p className="muted" role="status">Importing recipes…</p>}
      <label className="search-field">Search recipes<input aria-label="Search recipes" placeholder="Search by name or category" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {recipes.length === 0 ? <div className="empty-state"><span>◌</span><h3>No recipes yet</h3><p>Add your first recipe to start planning meals.</p></div> : visibleRecipes.length === 0 ? <div className="empty-state"><h3>No recipes match your search.</h3></div> : <div className="recipe-list">{visibleRecipes.map((recipe) => <article className="recipe-card" key={recipe.id}><button className="recipe-card-main" onClick={() => setSelectedRecipe(recipe)}><div className="recipe-mark">{recipe.name.slice(0, 1).toUpperCase()}</div><div><p className="card-category">{recipe.category}</p><h3>{recipe.name}</h3><p className="muted">{recipe.servings} servings · {recipe.prepTime} min</p></div><span className="chevron" aria-hidden="true">›</span></button><div className="card-ingredients">{recipe.ingredients.slice(0, 3).map((ingredient) => `${ingredient.amount} ${ingredient.unit} ${ingredient.item}`).join(' · ')}</div></article>)}</div>}
    </section>
  );
}
