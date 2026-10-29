import { describe, expect, it } from 'vitest';
import { mergeDuplicateIngredients, parseIngredientLine } from './ingredients';
import { convertUnits, convertUnitsDetailed, convertUnitsStrictDetailed, normalizeUnit } from './units';
import { deriveShoppingList } from './shopping-list';
import { getExpirationStatus, mergePantryItems } from './pantry';
import {
  calculateRecipeCost,
  classifyCategoryFromName,
  coalesceTime,
  parseDurationToMinutes,
  validateCategory,
  validateRecipe,
} from './recipes';
import { formatCurrency } from './currency';
import type { PantryItem, Recipe } from '../types/domain';

it('does not treat counted units as compatible with mass units', () => {
  expect(convertUnitsStrictDetailed(1, 'units', 'kg')).toMatchObject({ convertible: false });
});

const baseRecipe: Recipe = {
  id: 'recipe-1',
  name: 'Soup',
  category: 'Dinner',
  servings: 2,
  prepTime: 15,
  isFavorite: false,
  image: null,
  ingredients: [{ item: 'flour', amount: 2, unit: 'cup' }],
  instructions: 'Cook.',
  submittedBy: 'alex',
  approved: true,
  createdAt: null,
  averageRating: 0,
  ratingCount: 0,
};

const basePantry: PantryItem = {
  id: 'pantry-1',
  userId: 'user-1',
  item: 'flour',
  amount: 4,
  unit: 'cup',
  price: 8,
  expirationDate: null,
  category: 'Baking',
  notes: null,
  isActive: true,
};

describe('ingredients and units', () => {
  it('parses mixed fractions, plural units, and the ingredient name', () => {
    expect(parseIngredientLine('1 1/2 cups flour')).toEqual({
      amount: 1.5,
      unit: 'cup',
      item: 'flour',
    });
  });

  it('canonicalizes common units and converts volume and density-aware mass', () => {
    expect(normalizeUnit('tablespoons')).toBe('tbsp');
    expect(convertUnits(2, 'cup', 'ml')).toBeCloseTo(473.18, 2);
    expect(convertUnits(1, 'cup', 'g', 'all purpose flour')).toBeCloseTo(120, 2);
    expect(convertUnits(1, 'piece', 'g', 'flour')).toBe(1);
    expect(parseIngredientLine('3 unit large eggs')).toEqual({ amount: 3, unit: 'unit', item: 'large eggs' });
    expect(convertUnitsDetailed(1, 'tbsp', 'g', 'olive oil')).toMatchObject({ approximate: true, convertible: true });
    expect(convertUnitsDetailed(1, 'lb', 'kg')).toMatchObject({ amount: expect.closeTo(0.453592, 5), approximate: false, convertible: true });
    expect(convertUnitsDetailed(1, 'tbsp', 'g', 'unknown item').convertible).toBe(false);
    expect(mergeDuplicateIngredients([
      { amount: 1, unit: 'unit', item: 'Chicken' },
      { amount: 2, unit: 'unit', item: 'chicken' },
      { amount: 500, unit: 'g', item: 'rice' },
      { amount: 1, unit: 'kg', item: 'rice' },
    ])).toEqual([
      { amount: 3, unit: 'units', item: 'Chicken' },
      { amount: 1500, unit: 'g', item: 'rice' },
    ]);
  });
});

describe('recipe logic', () => {
  it('validates required fields and numeric limits', () => {
    const errors = validateRecipe({
      name: '',
      category: 'Unknown',
      servings: 0,
      prepTime: 1441,
      ingredients: [{ item: '', amount: -1, unit: '' }],
      instructions: '',
      imageUrl: 'javascript:alert(1)',
      submittedBy: 42,
    });

    expect(errors).toEqual(expect.arrayContaining([
      'Name is required.',
      'Servings must be a positive number.',
      'Prep time exceeds 24 hours.',
      'Instructions are required.',
      'Ingredient #1 requires an item name.',
      'Ingredient #1 amount cannot be negative.',
      'Image URL must use http(s).',
      'submittedBy must be a string.',
    ]));
  });

  it('infers and validates the legacy recipe categories', () => {
    expect(classifyCategoryFromName('Chicken Pasta')).toBe('Chicken');
    expect(classifyCategoryFromName('Chocolate Cake')).toBe('Dessert');
    expect(classifyCategoryFromName('Mystery Dish')).toBe('Miscellaneous');
    expect(validateCategory('pAsTa')).toBe('Pasta');
    expect(validateCategory('not-a-category')).toBe('Miscellaneous');
  });

  it('normalizes ISO and free-text durations using minutes', () => {
    expect(parseDurationToMinutes('PT1H15M')).toBe(75);
    expect(parseDurationToMinutes('1 hr 30 min')).toBe(90);
    expect(parseDurationToMinutes('90 minutes')).toBe(90);
    expect(parseDurationToMinutes('unknown')).toBeNull();
    expect(coalesceTime(0, 20, 15)).toBe(35);
    expect(coalesceTime(45, 20, 15)).toBe(45);
  });

  it('calculates proportional recipe cost and reports missing ingredients', () => {
    const result = calculateRecipeCost(
      {
        ...baseRecipe,
        ingredients: [
          { item: 'flour', amount: 2, unit: 'cup' },
          { item: 'salt', amount: 1, unit: 'tsp' },
        ],
      },
      [basePantry],
    );

    expect(result.total).toBeCloseTo(4, 2);
    expect(result.breakdown).toHaveLength(1);
    expect(result.missingItems).toEqual(['salt']);
  });
});

describe('pantry and shopping-list logic', () => {
  it('merges duplicate pantry quantities using a weighted-average price', () => {
    const merged = mergePantryItems(basePantry, {
      ...basePantry,
      id: 'pantry-2',
      amount: 2,
      price: 5,
    });

    expect(merged.amount).toBe(6);
    expect(merged.price).toBeCloseTo(7, 2);
  });

  it('classifies expiration status relative to a supplied day', () => {
    const today = new Date(2026, 9, 29);

    expect(getExpirationStatus('2026-10-29', today)).toMatchObject({
      days: 0,
      class: 'expires-today',
      urgent: true,
    });
    expect(getExpirationStatus('2026-11-12', today)).toMatchObject({
      days: 14,
      class: 'expires-caution',
      urgent: false,
    });
  });

  it('derives needed quantities from planned recipes and pantry stock', () => {
    const shopping = deriveShoppingList(
      [{ ...baseRecipe, ingredients: [{ item: 'flour', amount: 6, unit: 'cup' }] }],
      { Monday: ['recipe-1'] },
      [{ ...basePantry, amount: 1 }, { ...basePantry, id: 'pantry-2', amount: 3 }],
    );

    expect(shopping).toEqual([
      { item: 'flour', needed: 6, have: 4, toBuy: 2, unit: 'cup', sufficient: false, match: 'exact' },
    ]);
  });

  it('marks incompatible pantry units unresolved instead of subtracting them', () => {
    const shopping = deriveShoppingList(
      [{ ...baseRecipe, ingredients: [{ item: 'flour', amount: 1, unit: 'kg' }] }],
      { Monday: ['recipe-1'] },
      [{ ...basePantry, amount: 4, unit: 'units' }],
    );

    expect(shopping[0]).toMatchObject({ have: 0, toBuy: 1, sufficient: false, match: 'unresolved' });
  });
});

describe('currency logic', () => {
  it('formats supported currencies and handles invalid amounts', () => {
    expect(formatCurrency(12.5, 'PHP')).toBe('₱12.50');
    expect(formatCurrency(1234.5, 'JPY')).toBe(`¥${Math.round(1234.5).toLocaleString()}`);
    expect(formatCurrency(Number.NaN, 'USD')).toBe('$0.00');
  });
});
