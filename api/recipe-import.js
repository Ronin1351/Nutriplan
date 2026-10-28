const MAX_BYTES = 2.5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export function createRecipeImportHandler(fetcher = fetch) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).send('Method Not Allowed');
    }
    const url = req.body?.url;
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'invalid-url', message: 'Enter a valid recipe URL.' }); }
    if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ error: 'invalid-url', message: 'Enter a valid http(s) recipe URL.' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetcher(parsed.href, { signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml' } });
      if (!response.ok) return res.status(502).json({ error: 'fetch-failed', message: 'The recipe website could not be reached.' });
      const content = await readLimitedText(response);
      const draft = parseRecipePage(content, parsed.href);
      return res.status(200).json(draft);
    } catch (error) {
      if (error?.code === 'missing-recipe') return res.status(422).json({ error: 'missing-recipe', message: error.message });
      if (error?.name === 'AbortError') return res.status(504).json({ error: 'timeout', message: 'The recipe website took too long to respond.' });
      if (error instanceof TypeError) return res.status(502).json({ error: 'fetch-failed', message: 'The recipe website could not be reached. It may block server requests.' });
      return res.status(422).json({ error: 'malformed-content', message: 'The recipe page did not contain usable recipe data.' });
    } finally { clearTimeout(timeout); }
  };
}

async function readLimitedText(response) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) throw new Error('response-too-large');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) throw new Error('response-too-large');
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

function text(value) {
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value && typeof value === 'object') return text(value.text ?? value.name ?? value.url ?? '');
  return '';
}
function list(value) { return Array.isArray(value) ? value.flatMap(list) : [text(value)].filter(Boolean); }
function isRecipe(value) { const type = value?.['@type']; return Array.isArray(type) ? type.some((v) => String(v).toLowerCase() === 'recipe') : String(type ?? '').toLowerCase() === 'recipe'; }
function parseDuration(value) { const v = text(value); const iso = v.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i); if (iso) return Number(iso[1] || 0) * 60 + Number(iso[2] || 0); const n = v.match(/\d+(?:\.\d+)?/); return n ? Math.round(Number(n[0]) * (/h/i.test(v) ? 60 : 1)) : 0; }
function parseIngredients(values) { return list(values).map((line) => { const match = line.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(\w+)?\s*(.*)$/); if (!match) return { amount: 1, unit: '', item: line }; return { amount: match[1].includes('/') ? Number(match[1].split('/')[0]) / Number(match[1].split('/')[1]) : Number(match[1]), unit: match[2] || '', item: match[3] || line }; }); }
function normalize(recipe, sourceUrl) { const ingredients = parseIngredients(recipe.recipeIngredient); if (!text(recipe.name) || !ingredients.length) { const error = new Error('No complete recipe was found in this content.'); error.code = 'missing-recipe'; throw error; } const yieldText = text(recipe.recipeYield).match(/\d+/); return { name: text(recipe.name), category: 'Miscellaneous', servings: yieldText ? Number(yieldText[0]) : 4, prepTime: parseDuration(recipe.totalTime) || parseDuration(recipe.prepTime) + parseDuration(recipe.cookTime), ingredients, instructions: list(recipe.recipeInstructions).join('\n'), imageUrl: text(recipe.image), submittedBy: 'Personal', approved: false, sourceUrl }; }
function parseRecipePage(content, sourceUrl) { const scripts = [...content.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]; for (const match of scripts.slice(0, 20)) { try { const json = JSON.parse(match[1]); const candidates = Array.isArray(json) ? json : [json, ...(json?.['@graph'] || [])]; const recipe = candidates.find(isRecipe); if (recipe) return normalize(recipe, sourceUrl); } catch {} } const root = content.match(/<[^>]*itemscope[^>]*itemtype=["'][^"']*Recipe[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/i)?.[0] || ''; const name = root.match(/itemprop=["']name["'][^>]*>([^<]+)/i)?.[1]?.trim(); const ingredients = [...root.matchAll(/itemprop=["']recipeIngredient["'][^>]*>([^<]+)/gi)].map((m) => m[1].trim()); if (name && ingredients.length) return normalize({ name, recipeIngredient: ingredients, recipeInstructions: [root.match(/itemprop=["']recipeInstructions["'][^>]*>([^<]+)/i)?.[1] || ''] }, sourceUrl); const fallbackName = content.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim(); const fallbackIngredients = [...content.matchAll(/<li[^>]*>([^<]*(?:\d|salt|pepper|flour|sugar|water|egg|milk)[^<]*)<\/li>/gi)].slice(0, 25).map((m) => m[1].trim()); return normalize({ name: fallbackName, recipeIngredient: fallbackIngredients, recipeInstructions: [] }, sourceUrl); }

export default createRecipeImportHandler();
