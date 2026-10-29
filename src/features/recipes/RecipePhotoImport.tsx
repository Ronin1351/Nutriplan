import { useEffect, useState } from 'react';
import { parseRecipeText, RecipeImportError } from '../../lib/recipe-import';
import type { NewRecipe, Recipe, RecipeImportDraft } from '../../types/domain';
import { createReceiptOcrWorkerController, type ReceiptOcrController } from '../receipt/receiptOcr';
import { orderReceiptFragments } from '../receipt/receiptParser';
import RecipeEditor from './RecipeEditor';

interface RecipePhotoImportProps {
  ocr?: ReceiptOcrController;
  onSave: (recipe: NewRecipe) => Promise<void>;
  onCancel: () => void;
}

type State = 'idle' | 'reading' | 'review' | 'error';

function toRecipe(draft: RecipeImportDraft): Recipe {
  return { id: 'photo-draft', name: draft.name, category: draft.category, servings: draft.servings, prepTime: draft.prepTime, isFavorite: false, image: null, ingredients: draft.ingredients, instructions: draft.instructions, submittedBy: draft.submittedBy, approved: false, createdAt: null, averageRating: 0, ratingCount: 0 };
}

function toNewRecipe(recipe: Recipe): NewRecipe {
  const { id: _id, isFavorite: _favorite, createdAt: _createdAt, approved: _approved, averageRating: _rating, ratingCount: _count, ...draft } = recipe;
  return draft;
}

export default function RecipePhotoImport({ ocr: providedOcr, onSave, onCancel }: RecipePhotoImportProps) {
  const [ocr, setOcr] = useState<ReceiptOcrController | null>(null);
  const [state, setState] = useState<State>('idle');
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = providedOcr ?? createReceiptOcrWorkerController();
    setOcr(controller);
    return () => { if (!providedOcr) controller.dispose(); };
  }, [providedOcr]);

  async function read(file: File | undefined) {
    if (!file || !ocr) return;
    setError(null);
    setState('reading');
    try {
      const result = await ocr.run(file);
      const text = orderReceiptFragments(result.fragments).map((row) => row.text).join('\n') || result.rawText;
      setDraft(toRecipe(parseRecipeText(text)));
      setState('review');
    } catch (cause) {
      setError(cause instanceof RecipeImportError || cause instanceof Error ? cause.message : 'The photo could not be read.');
      setState('error');
    }
  }

  if (state === 'review' && draft) {
    return <RecipeEditor recipe={draft} heading="Review scanned recipe" description="OCR guesses the title, ingredients and steps. Fix anything it misread before saving." allowEmptyInstructions onCancel={onCancel} onSave={async (value) => { await onSave(toNewRecipe(value as Recipe)); }} />;
  }

  return <section className="form-panel import-panel" aria-live="polite">
    <div className="form-heading"><div><h2>Scan a recipe</h2></div><button className="icon-button" aria-label="Close recipe scanner" onClick={() => { ocr?.cancel(); onCancel(); }}>×</button></div>
    <p className="muted">Photograph a printed or handwritten recipe. It is read on this device and opens in the editor for you to check.</p>
    {state === 'reading' ? <div className="state-panel" role="status" aria-busy="true"><span className="loading-dot" aria-hidden="true" /><h3>Reading recipe…</h3></div> : <div className="receipt-upload-actions">
      <label className="button primary" htmlFor="recipe-photo-camera">Take photo</label>
      <label className="button secondary" htmlFor="recipe-photo-upload">Upload photo</label>
      <input id="recipe-photo-camera" aria-label="Take recipe photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => void read(event.target.files?.[0])} />
      <input id="recipe-photo-upload" aria-label="Recipe photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void read(event.target.files?.[0])} />
    </div>}
    {error && <div className="validation-errors" role="alert">{error}</div>}
    <div className="form-actions"><button className="button secondary" onClick={() => { ocr?.cancel(); onCancel(); }}>Cancel</button></div>
  </section>;
}
