import { deriveShoppingList } from '../../lib/shopping-list';
import type { MealPlan, PantryItem, Recipe } from '../../types/domain';

interface ShoppingListViewProps { recipes: Recipe[]; pantry: PantryItem[]; mealPlan: MealPlan; }

export default function ShoppingListView({ recipes, pantry, mealPlan }: ShoppingListViewProps) {
  const items = deriveShoppingList(recipes, mealPlan, pantry);
  const missing = items.filter((item) => item.toBuy > 0);
  const covered = items.filter((item) => item.toBuy === 0);
  return <section className="content-section"><div className="section-toolbar"><div><p className="section-kicker">From your meal plan</p><h2>Shopping list</h2></div></div>
    {items.length === 0 ? <div className="empty-state"><h3>Nothing to shop yet</h3><p>Plan a meal to build a shopping list from its ingredients.</p></div> : <div className="shopping-groups">
      <section><h3>Missing ingredients</h3>{missing.length === 0 ? <p className="empty-inline">Your pantry covers every planned ingredient.</p> : <ul className="shopping-items">{missing.map((item) => <li key={`${item.item}-${item.unit}`}><span><strong>{item.item}</strong><small>{item.needed} {item.unit} needed · {item.have} {item.unit} in pantry</small></span><strong>{item.toBuy} {item.unit} to buy</strong></li>)}</ul>}</section>
      {covered.length > 0 && <section><h3>Already in pantry</h3><ul className="shopping-items covered">{covered.map((item) => <li key={`${item.item}-${item.unit}`}><span><strong>{item.item}</strong><small>{item.needed} {item.unit} covered</small></span><span>✓ Ready</span></li>)}</ul></section>}
    </div>}
  </section>;
}
