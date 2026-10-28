import { describe, expect, it } from 'vitest';
import { createRecipeExport, parseRecipeExport } from './recipe-transfer';
import type { Recipe } from '../types/domain';

const recipe: Recipe = {
  id: 'private-id', name: 'Garlic Pasta', category: 'Pantry', servings: 2, prepTime: 20,
  isFavorite: true, image: null, ingredients: [
    { amount: 1, unit: 'cup', item: 'Pasta' },
    { amount: 1, unit: 'cup', item: 'pasta' },
  ], instructions: 'Boil pasta.', submittedBy: 'Personal', approved: true,
  createdAt: '2026-01-01T00:00:00.000Z', averageRating: 5, ratingCount: 1,
};

describe('recipe JSON transfer', () => {
  it('round trips portable recipe content without internal fields', () => {
    const exported = createRecipeExport([recipe]);
    expect(exported).not.toContain('private-id');
    expect(exported).not.toContain('averageRating');
    expect(parseRecipeExport(exported)).toEqual([expect.objectContaining({
      name: 'Garlic Pasta', servings: 2, ingredients: [{ amount: 2, unit: 'cup', item: 'Pasta' }],
    })]);
  });

  it('rejects malformed JSON and invalid recipe data', () => {
    expect(() => parseRecipeExport('{')).toThrow('not valid JSON');
    expect(() => parseRecipeExport(JSON.stringify({ recipes: [{ name: '' }] }))).toThrow('is invalid');
  });

  it('accepts a raw recipe array for simple manual transfers', () => {
    expect(parseRecipeExport(JSON.stringify([{
      name: 'Eggs', category: 'Dairy', servings: 1, prepTime: 5,
      image: null, ingredients: [{ amount: 2, unit: 'unit', item: 'Large eggs' }],
      instructions: 'Cook.', submittedBy: 'Personal',
    }]))[0].name).toBe('Eggs');
  });
});
