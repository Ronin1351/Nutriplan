import { useEffect, useState } from 'react';
import { normalizeIngredients } from '../../lib/ingredients';
import { validateRecipe } from '../../lib/recipes';
import type { NewRecipe, Recipe } from '../../types/domain';

interface RecipeFormProps {
  recipe?: Recipe | null;
  onSave: (recipe: NewRecipe | Recipe) => Promise<void>;
  onCancel: () => void;
}

export default function RecipeForm({ recipe, onSave, onCancel }: RecipeFormProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Miscellaneous');
  const [servings, setServings] = useState('4');
  const [prepTime, setPrepTime] = useState('30');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(recipe?.name ?? '');
    setCategory(recipe?.category ?? 'Miscellaneous');
    setServings(String(recipe?.servings ?? 4));
    setPrepTime(String(recipe?.prepTime ?? 30));
    setIngredients(recipe?.ingredients.map((item) => `${item.amount} ${item.unit} ${item.item}`.trim()).join('\n') ?? '');
    setInstructions(recipe?.instructions ?? '');
    setImageUrl(recipe?.image ?? '');
    setErrors([]);
  }, [recipe]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedIngredients = normalizeIngredients(ingredients.split('\n').filter(Boolean));
    const draft = {
      name: name.trim(),
      category,
      servings: Number(servings),
      prepTime: Number(prepTime),
      ingredients: parsedIngredients,
      instructions: instructions.trim(),
      imageUrl: imageUrl.trim(),
      submittedBy: 'Personal',
    };
    const validationErrors = validateRecipe(draft);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      if (recipe) {
        await onSave({ ...recipe, ...draft, image: draft.imageUrl || null });
      } else {
        await onSave({ ...draft, image: draft.imageUrl || null });
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unable to save recipe.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-panel" onSubmit={submit}>
      <div className="form-heading">
        <div>
          <p className="section-kicker">Recipe editor</p>
          <h2>{recipe ? 'Edit recipe' : 'Add recipe'}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Close recipe form">×</button>
      </div>
      {errors.length > 0 && <div className="validation-errors" role="alert"><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <label>Recipe name<input aria-label="Recipe name" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <div className="form-grid">
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Miscellaneous</option><option>Breakfast</option><option>Chicken</option><option>Beef</option><option>Pasta</option><option>Vegetarian</option><option>Vegan</option><option>Dessert</option><option>Seafood</option></select></label>
        <label>Servings<input type="number" min="1" value={servings} onChange={(event) => setServings(event.target.value)} /></label>
      </div>
      <label>Prep time (minutes)<input type="number" min="0" value={prepTime} onChange={(event) => setPrepTime(event.target.value)} /></label>
      <label>Ingredients<textarea aria-label="Ingredients" rows={5} placeholder="1 cup rice" value={ingredients} onChange={(event) => setIngredients(event.target.value)} /></label>
      <label>Instructions<textarea aria-label="Instructions" rows={5} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
      <label>Image URL (optional)<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save recipe'}</button></div>
    </form>
  );
}
