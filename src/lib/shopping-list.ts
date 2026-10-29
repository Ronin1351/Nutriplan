import type { EntityId, PantryItem, Recipe, ShoppingListItem, Weekday } from '../types/domain';
import { convertUnitsStrictDetailed, normalizeUnit } from './units';

export type PartialMealPlan = Partial<Record<Weekday, EntityId[]>>;

export function deriveShoppingList(
  recipes: Recipe[],
  mealPlan: PartialMealPlan,
  pantry: PantryItem[],
): ShoppingListItem[] {
  const needed = new Map<string, { item: string; amount: number; unit: string }>();

  Object.values(mealPlan).flat().forEach((recipeId) => {
    const recipe = recipes.find((candidate) => String(candidate.id) === String(recipeId));
    recipe?.ingredients.forEach((ingredient) => {
      const key = ingredient.item.trim().toLocaleLowerCase();
      const current = needed.get(key) ?? { item: ingredient.item, amount: 0, unit: ingredient.unit };
      current.amount += ingredient.amount;
      needed.set(key, current);
    });
  });

  return [...needed.values()].map(({ item, amount, unit }) => {
    const matching = pantry.filter((candidate) => candidate.isActive && candidate.item.trim().toLocaleLowerCase() === item.trim().toLocaleLowerCase());
    let have = 0;
    let converted = false;
    let unresolved = false;
    for (const pantryItem of matching) {
      const result = convertUnitsStrictDetailed(pantryItem.amount, pantryItem.unit, unit, item);
      if (!result.convertible) { unresolved = true; continue; }
      have += result.amount;
      converted ||= normalizeUnit(pantryItem.unit) !== normalizeUnit(unit);
    }
    const toBuy = Math.max(0, amount - have);
    const match = unresolved && have === 0 ? 'unresolved' : converted ? 'converted' : 'exact';
    return { item, needed: amount, have, toBuy, unit, sufficient: toBuy === 0 && match !== 'unresolved', match };
  });
}
