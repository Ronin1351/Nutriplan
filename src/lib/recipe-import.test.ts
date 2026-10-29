import { describe, expect, it } from 'vitest';
import { RecipeImportError, parseRecipeContent, parseRecipeText } from './recipe-import';

describe('recipe import parsing', () => {
  it('prefers Schema.org Recipe JSON-LD and normalizes a draft', () => {
    const draft = parseRecipeContent(`
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Recipe","name":"Rice Bowl","recipeIngredient":["1 cup rice","2 eggs"],"recipeInstructions":[{"@type":"HowToStep","text":"Cook rice."}],"recipeYield":"2 servings","totalTime":"PT25M","image":"https://example.com/rice.jpg"}
      </script>
    `, 'https://example.com/rice');

    expect(draft).toMatchObject({
      name: 'Rice Bowl', servings: 2, prepTime: 25,
      imageUrl: 'https://example.com/rice.jpg', sourceUrl: 'https://example.com/rice', approved: false,
    });
    expect(draft.ingredients).toEqual([
      { amount: 1, unit: 'cup', item: 'rice' },
      { amount: 2, unit: '', item: 'eggs' },
    ]);
  });

  it('falls back to Recipe microdata when JSON-LD is absent', () => {
    const draft = parseRecipeContent(`
      <article itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Bean Salad</h1>
        <meta itemprop="recipeYield" content="4 servings">
        <meta itemprop="prepTime" content="PT10M">
        <ul><li itemprop="recipeIngredient">1 cup beans</li><li itemprop="recipeIngredient">salt</li></ul>
        <p itemprop="recipeInstructions">Mix and serve.</p>
      </article>
    `);

    expect(draft.name).toBe('Bean Salad');
    expect(draft.servings).toBe(4);
    expect(draft.prepTime).toBe(10);
    expect(draft.instructions).toBe('Mix and serve.');
  });

  it('parses copied plain-text recipe sections', () => {
    const draft = parseRecipeContent(`
      Salad Olivieh (Persian Potato Salad with Chicken)
      Ingredients
      1 pound russet potatoes
      3 large eggs
      2 cups frozen peas
      1/4 cup mayonnaise
      Instructions
      Cook the potatoes until tender.
      Dice the eggs and add them to the potatoes.
      Stir in the peas and mayonnaise.
    `);

    expect(draft.name).toBe('Salad Olivieh (Persian Potato Salad with Chicken)');
    expect(draft.ingredients).toEqual([
      { amount: 1, unit: 'lb', item: 'russet potatoes' },
      { amount: 3, unit: '', item: 'large eggs' },
      { amount: 2, unit: 'cup', item: 'frozen peas' },
      { amount: 0.25, unit: 'cup', item: 'mayonnaise' },
    ]);
    expect(draft.instructions).toContain('Cook the potatoes until tender.');
  });

  it('omits section headings that recipe sites mix into ingredient lists', () => {
    const draft = parseRecipeContent('<script type="application/ld+json">{"@type":"Recipe","name":"Bibimbap","recipeIngredient":["For the chicken","500 g chicken"],"recipeInstructions":["Cook."]}</script>');
    expect(draft.ingredients).toEqual([{ amount: 500, unit: 'g', item: 'chicken' }]);
  });

  it('rejects invalid or incomplete recipe content with an understandable error', () => {
    expect(() => parseRecipeContent('<html><title>Not a recipe</title><p>Hello</p></html>')).toThrowError(
      new RecipeImportError('missing-recipe', 'No complete recipe was found in this content.'),
    );
  });
});

describe('parseRecipeText', () => {
  it('parses a title, quantity-led ingredient lines and remaining instructions', () => {
    const draft = parseRecipeText('Pancakes\n2 cups flour\n1 egg\n1/2 tsp salt\nMix everything.\nFry until golden.');
    expect(draft.name).toBe('Pancakes');
    expect(draft.ingredients).toHaveLength(3);
    expect(draft.ingredients[0]).toMatchObject({ item: 'flour', amount: 2, unit: 'cup' });
    expect(draft.instructions).toBe('Mix everything.\nFry until golden.');
    expect(draft).toMatchObject({ servings: 4, prepTime: 30, imageUrl: '', submittedBy: 'Personal', approved: false });
  });

  it('turns text with no quantity-led lines into instructions with empty ingredients', () => {
    const draft = parseRecipeText('Grandma soup\nBoil bones.\nAdd salt to taste.');
    expect(draft.ingredients).toEqual([]);
    expect(draft.instructions).toBe('Boil bones.\nAdd salt to taste.');
  });

  it('throws missing-recipe for blank text', () => {
    expect(() => parseRecipeText('  \n ')).toThrow(RecipeImportError);
    expect(() => parseRecipeText('')).toThrow('No text was found in the photo.');
  });
});
