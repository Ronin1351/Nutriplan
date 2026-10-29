import type { MealPlan, Recipe, Weekday } from '../../types/domain';

const DAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface MealPlannerViewProps { recipes: Recipe[]; mealPlan: MealPlan; onChange: (plan: MealPlan) => Promise<void>; onCook?: (recipe: Recipe) => Promise<void>; }

export default function MealPlannerView({ recipes, mealPlan, onChange, onCook }: MealPlannerViewProps) {
  async function add(day: Weekday, recipeId: string) {
    if (recipeId) await onChange({ ...mealPlan, [day]: [...mealPlan[day], recipeId] });
  }
  async function remove(day: Weekday, index: number) {
    await onChange({ ...mealPlan, [day]: mealPlan[day].filter((_, itemIndex) => itemIndex !== index) });
  }
  return <section className="content-section">
    <div className="section-toolbar"><div><p className="section-kicker">Plan ahead</p><h2>Seven-day planner</h2></div></div>
    <div className="planner-grid">{DAYS.map((day) => <article className="day-card" key={day}>
      <div className="day-card-heading"><h3>{day}</h3><span>{mealPlan[day].length} meal{mealPlan[day].length === 1 ? '' : 's'}</span></div>
      <label className="sr-only" htmlFor={`add-${day}`}>Add meal to {day}</label>
      <select id={`add-${day}`} aria-label={`Add meal to ${day}`} value="" onChange={(event) => void add(day, event.target.value)}>
        <option value="">Add meal…</option>{recipes.map((recipe) => <option key={String(recipe.id)} value={String(recipe.id)}>{recipe.name}</option>)}
      </select>
      {mealPlan[day].length === 0 ? <p className="empty-inline">No meals planned.</p> : <ul className="meal-list">{mealPlan[day].map((recipeId, index) => { const recipe = recipes.find((item) => String(item.id) === String(recipeId)); if (!recipe) return null; return <li key={`${String(recipeId)}-${index}`}><span>{recipe.name}</span><span className="meal-actions">{onCook && <button className="text-button" onClick={() => void onCook(recipe)}>Cook</button>}<button className="text-button danger" aria-label={`Remove ${recipe.name} from ${day}`} onClick={() => void remove(day, index)}>Remove</button></span></li>; })}</ul>}
    </article>)}</div>
  </section>;
}
