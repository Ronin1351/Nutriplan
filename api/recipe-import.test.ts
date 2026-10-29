import { describe, expect, it, vi } from 'vitest';
import { createRecipeImportHandler } from './recipe-import.js';

function response() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
    send(value: unknown) { this.body = value; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
  };
}

describe('recipe import endpoint', () => {
  it('returns a parsed draft from a fetched recipe page', async () => {
    const handler = createRecipeImportHandler(async () => new Response(
      '<script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeIngredient":["1 cup broth"],"recipeInstructions":"Simmer."}</script>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ));
    const res = response();
    await handler({ method: 'POST', body: { url: 'https://example.com/soup' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ name: 'Soup', sourceUrl: 'https://example.com/soup' });
  });

  it('reports invalid URLs and fetch failures without leaking raw server errors', async () => {
    const handler = createRecipeImportHandler(async () => { throw new TypeError('fetch failed'); });
    const invalid = response();
    await handler({ method: 'POST', body: { url: 'javascript:alert(1)' } }, invalid);
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).toMatchObject({ error: 'invalid-url' });

    const failed = response();
    await handler({ method: 'POST', body: { url: 'https://example.com/soup' } }, failed);
    expect(failed.statusCode).toBe(502);
    expect(failed.body).toMatchObject({ error: 'fetch-failed' });
  });

  it('returns the raw ingredient lines so the client can parse fractions and package sizes', async () => {
    const handler = createRecipeImportHandler(async () => new Response(
      '<script type="application/ld+json">{"@type":"Recipe","name":"Pasta Salad","recipeIngredient":["½\u00a0cup mayonnaise","1 (12 oz.) package elbow macaroni"],"recipeInstructions":"Mix."}</script>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ));
    const res = response();
    await handler({ method: 'POST', body: { url: 'https://example.com/pasta' } }, res);
    expect(res.body.ingredientLines).toEqual(['½\u00a0cup mayonnaise', '1 (12 oz.) package elbow macaroni']);
  });

  it('identifies itself as a browser so recipe sites do not refuse the request', async () => {
    const fetcher = vi.fn(async () => new Response('<script type="application/ld+json">{"@type":"Recipe","name":"Chili","recipeIngredient":["1 lb beef"],"recipeInstructions":"Cook."}</script>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const handler = createRecipeImportHandler(fetcher as unknown as typeof fetch);
    await handler({ method: 'POST', body: { url: 'https://www.allrecipes.com/recipe/1/' } }, response());
    const headers = (fetcher.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(headers['user-agent']).toMatch(/Mozilla\/5\.0/);
    expect(headers['accept-language']).toBeTruthy();
  });

  it('reports the HTTP status when a site refuses the request', async () => {
    const handler = createRecipeImportHandler(async () => new Response('blocked', { status: 403 }));
    const res = response();
    await handler({ method: 'POST', body: { url: 'https://www.allrecipes.com/recipe/1/' } }, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.message).toMatch(/403/);
  });

  it('explains a 402/403 as the site blocking automated reads and points to paste', async () => {
    const handler = createRecipeImportHandler(async () => new Response('pay', { status: 402 }));
    const res = response();
    await handler({ method: 'POST', body: { url: 'https://www.allrecipes.com/recipe/1/' } }, res);
    expect(res.body.message).toMatch(/does not allow apps to read its pages \(HTTP 402\)/);
    expect(res.body.message).toMatch(/Paste text/);
  });
});
