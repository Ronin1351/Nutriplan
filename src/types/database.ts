import type { EntityId, Weekday } from './domain';

export interface DatabaseUserRow {
  id: EntityId;
  username: string;
  password?: string | null;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean | number | string | null;
}

export interface DatabaseIngredientRow {
  item?: string | null;
  amount?: number | string | null;
  unit?: string | null;
}

export interface DatabaseRecipeRow {
  id: EntityId;
  name: string;
  category?: string | null;
  servings?: number | string | null;
  prep_time?: number | string | null;
  ingredients?: unknown;
  instructions?: string | null;
  image_url?: string | null;
  submitted_by?: string | null;
  approved?: boolean | number | string | null;
  created_at?: string | null;
  average_rating?: number | string | null;
  rating_count?: number | string | null;
  source_url?: string | null;
}

export type DatabaseRecipeInsert = Omit<DatabaseRecipeRow, 'id'>;

export interface DatabaseUserRecipeRow {
  user_id: EntityId;
  recipe_id: EntityId;
}

export interface DatabaseRatingRow {
  user_id: EntityId;
  recipe_id: EntityId;
  rating: number | string;
}

export interface DatabasePantryRow {
  id: EntityId;
  user_id: EntityId;
  item: string;
  amount: number | string;
  unit: string;
  price: number | string;
  expiration_date?: string | null;
  category?: string | null;
  notes?: string | null;
  is_active?: boolean | number | string | null;
}

export type DatabasePantryInsert = Omit<DatabasePantryRow, 'id'>;

export interface DatabaseMealPlanRow {
  user_id: EntityId;
  day: Weekday;
  recipe_id: EntityId;
  position: number | string;
}
