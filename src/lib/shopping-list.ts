import type { EntityId, PantryItem, Recipe, ShoppingListItem, Weekday } from '../types/domain';

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
      const current = needed.get(ingredient.item) ?? { item: ingredient.item, amount: 0, unit: ingredient.unit };
      current.amount += ingredient.amount;
      needed.set(ingredient.item, current);
    });
  });

  return [...needed.values()].map(({ item, amount, unit }) => {
    const pantryItem = pantry.find((candidate) => candidate.item.toLowerCase() === item.toLowerCase());
    const have = pantryItem?.amount ?? 0;
    const toBuy = Math.max(0, amount - have);
    return { item, needed: amount, have, toBuy, unit, sufficient: toBuy === 0 };
  });
}
