export type EntityId = string | number;

export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface User {
  id: EntityId;
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface Ingredient {
  item: string;
  amount: number;
  unit: string;
}

export interface Recipe {
  id: EntityId;
  name: string;
  category: string;
  servings: number;
  prepTime: number;
  isFavorite: boolean;
  image: string | null;
  ingredients: Ingredient[];
  instructions: string;
  submittedBy: string;
  approved: boolean;
  createdAt: string | null;
  averageRating: number;
  ratingCount: number;
  sourceUrl?: string;
}

export type NewRecipe = Omit<
  Recipe,
  'id' | 'isFavorite' | 'createdAt' | 'approved' | 'averageRating' | 'ratingCount'
> & { sourceUrl?: string };

export interface PantryItem {
  id: EntityId;
  userId: EntityId;
  item: string;
  amount: number;
  unit: string;
  price: number;
  expirationDate: string | null;
  category: string;
  notes: string | null;
  isActive: boolean;
  catalogItemId?: string;
}

export const PANTRY_CATEGORIES = [
  'Uncategorized', 'Produce', 'Meat', 'Poultry', 'Seafood', 'Dairy', 'Grains', 'Pantry', 'Beverages', 'Snacks', 'Household',
] as const;

export type PantryCategory = typeof PANTRY_CATEGORIES[number];

export type NewPantryItem = Omit<PantryItem, 'id'>;

export interface MealPlanEntry {
  userId: EntityId;
  day: Weekday;
  recipeId: EntityId;
  position: number;
}

export type NewMealPlanEntry = Omit<MealPlanEntry, 'userId'>;

export type MealPlan = Record<Weekday, EntityId[]>;

export interface ShoppingListItem {
  item: string;
  needed: number;
  have: number;
  toBuy: number;
  unit: string;
  sufficient: boolean;
  match: 'exact' | 'converted' | 'unresolved';
  explanation?: string;
}

export interface Rating {
  userId: EntityId;
  recipeId: EntityId;
  rating: number;
}

export interface ReceiptItem {
  name: string;
  category?: string;
  weight?: string;
  pricePerUnit?: string;
  totalPrice: number;
}

export interface RecipeImportDraft {
  name: string;
  category: string;
  servings: number;
  prepTime: number;
  ingredients: Ingredient[];
  instructions: string;
  imageUrl: string;
  submittedBy: string;
  approved: false;
  sourceUrl?: string;
}
