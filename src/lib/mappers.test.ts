import { describe, expect, it } from 'vitest';
import {
  mapPantryRow,
  mapRecipeRow,
  mapUserRow,
  toPantryRow,
  toRecipeRow,
} from './mappers';

describe('database mappers', () => {
  it('maps a user without exposing the legacy password field', () => {
    const user = mapUserRow({
      id: 'user-1',
      username: 'alex',
      password: 'legacy-secret',
      name: null,
      email: null,
      avatar_url: '',
      is_admin: undefined,
    });

    expect(user).toEqual({
      id: 'user-1',
      username: 'alex',
      name: 'alex',
      email: '',
      avatarUrl: null,
      isAdmin: false,
    });
    expect('password' in user).toBe(false);
  });

  it('maps recipe database fields to domain fields with safe defaults', () => {
    const recipe = mapRecipeRow({
      id: 7,
      name: 'Pasta',
      category: null,
      servings: '4',
      prep_time: '30',
      ingredients: [{ item: 'pasta', amount: '2', unit: 'cups' }],
      instructions: null,
      image_url: '',
      submitted_by: null,
      approved: 0,
      created_at: undefined,
      average_rating: '4.5',
      rating_count: '2',
    });

    expect(recipe).toEqual({
      id: 7,
      name: 'Pasta',
      category: 'Miscellaneous',
      servings: 4,
      prepTime: 30,
      isFavorite: false,
      image: null,
      ingredients: [{ item: 'pasta', amount: 2, unit: 'cups' }],
      instructions: '',
      submittedBy: '',
      approved: false,
      createdAt: null,
      averageRating: 4.5,
      ratingCount: 2,
    });
  });

  it('maps pantry numeric fields and preserves explicit inactive history rows', () => {
    const pantryItem = mapPantryRow({
      id: 'pantry-1',
      user_id: 'user-1',
      item: 'flour',
      amount: '0',
      unit: 'cup',
      price: '4.25',
      expiration_date: null,
      category: null,
      notes: undefined,
      is_active: false,
    });

    expect(pantryItem).toEqual({
      id: 'pantry-1',
      userId: 'user-1',
      item: 'flour',
      amount: 0,
      unit: 'cup',
      price: 4.25,
      expirationDate: null,
      category: 'Uncategorized',
      notes: null,
      isActive: false,
    });
  });

  it('maps domain recipes and pantry items back to database field names', () => {
    const recipeRow = toRecipeRow({
      id: 'recipe-1',
      name: 'Soup',
      category: 'Dinner',
      servings: 2,
      prepTime: 15,
      isFavorite: true,
      image: 'https://example.com/soup.jpg',
      ingredients: [{ item: 'carrot', amount: 1, unit: 'each' }],
      instructions: 'Cook.',
      submittedBy: 'alex',
      approved: false,
      createdAt: null,
      averageRating: 0,
      ratingCount: 0,
      sourceUrl: 'https://example.com/soup',
    });
    const pantryRow = toPantryRow({
      id: 'pantry-1',
      userId: 'user-1',
      item: 'carrot',
      amount: 1,
      unit: 'each',
      price: 0.5,
      expirationDate: '2026-11-01',
      category: 'Produce',
      notes: 'Fresh',
      isActive: true,
    });

    expect(recipeRow).toMatchObject({
      id: 'recipe-1',
      prep_time: 15,
      image_url: 'https://example.com/soup.jpg',
      submitted_by: 'alex',
      source_url: 'https://example.com/soup',
    });
    expect(recipeRow).not.toHaveProperty('isFavorite');
    expect(pantryRow).toEqual({
      id: 'pantry-1',
      user_id: 'user-1',
      item: 'carrot',
      amount: 1,
      unit: 'each',
      price: 0.5,
      expiration_date: '2026-11-01',
      category: 'Produce',
      notes: 'Fresh',
      is_active: true,
    });
  });
});
