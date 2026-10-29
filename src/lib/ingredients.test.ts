import { describe, expect, it } from 'vitest';
import { normalizeIngredients, parseIngredientLine } from './ingredients';

describe('parseIngredientLine on recipe-site ingredient text', () => {
  it('reads a vulgar fraction after leading or non-breaking whitespace', () => {
    expect(parseIngredientLine(' ½ cup mayonnaise')).toEqual({ amount: 0.5, unit: 'cup', item: 'mayonnaise' });
    expect(parseIngredientLine('½ cup sour cream')).toEqual({ amount: 0.5, unit: 'cup', item: 'sour cream' });
    expect(parseIngredientLine(' ½ teaspoon black pepper')).toEqual({ amount: 0.5, unit: 'tsp', item: 'black pepper' });
    expect(parseIngredientLine('1 ½ cups milk')).toEqual({ amount: 1.5, unit: 'cup', item: 'milk' });
    expect(parseIngredientLine('1½ cups milk')).toEqual({ amount: 1.5, unit: 'cup', item: 'milk' });
  });

  it('turns a package size in parentheses into the amount and unit', () => {
    expect(parseIngredientLine('1 (12 oz.) package elbow macaroni or any pasta cut')).toEqual({ amount: 12, unit: 'oz', item: 'elbow macaroni or any pasta cut' });
    expect(parseIngredientLine('2 (15 oz.) cans sliced black olives, drained')).toEqual({ amount: 30, unit: 'oz', item: 'sliced black olives, drained' });
  });

  it('treats count nouns as units and drops notes in parentheses', () => {
    expect(parseIngredientLine('1 packet Hidden Valley™ Original Ranch™ Seasoning Mix')).toEqual({ amount: 1, unit: 'unit', item: 'Hidden Valley Original Ranch Seasoning Mix' });
    expect(parseIngredientLine('1 (8 or 9 slices) package bacon, cooked and crumbled')).toEqual({ amount: 1, unit: 'unit', item: 'bacon, cooked and crumbled' });
    expect(parseIngredientLine('2 cans sliced olives')).toEqual({ amount: 2, unit: 'unit', item: 'sliced olives' });
    expect(parseIngredientLine('3 cloves garlic, minced')).toEqual({ amount: 3, unit: 'unit', item: 'garlic, minced' });
  });

  it('drops alternative lines that start with "or"', () => {
    expect(normalizeIngredients(['1 packet ranch seasoning', 'or 3 tbsp ranch seasoning from a jar', '½ cup milk']).map((ingredient) => ingredient.item)).toEqual(['ranch seasoning', 'milk']);
  });

  it('handles the Hidden Valley page as published', () => {
    expect(parseIngredientLine('1 box (12 oz.) elbow macaroni or any pasta cut')).toEqual({ amount: 12, unit: 'oz', item: 'elbow macaroni or any pasta cut' });
    expect(parseIngredientLine('1 package (8 or 9 slices) precooked bacon')).toEqual({ amount: 1, unit: 'unit', item: 'precooked bacon' });
    expect(parseIngredientLine('2 small cans sliced olives (or one large one)')).toEqual({ amount: 2, unit: 'unit', item: 'sliced olives' });
    expect(parseIngredientLine('1 packet Hidden Valley™ Original Ranch™ Seasoning, Dressing & Recipe Mix')).toEqual({ amount: 1, unit: 'unit', item: 'Hidden Valley Original Ranch Seasoning, Dressing & Recipe Mix' });
    expect(parseIngredientLine('½ teaspoon garlic powder')).toEqual({ amount: 0.5, unit: 'tsp', item: 'garlic powder' });
    expect(parseIngredientLine('2 cups sliced yellow and red grape tomatoes')).toEqual({ amount: 2, unit: 'cup', item: 'sliced yellow and red grape tomatoes' });
  });
});
