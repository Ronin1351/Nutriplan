// /api/receipt-read.js
// Vercel/Next.js API route (Node runtime). Reads binary body and calls Azure Read API.
// Env vars required: AZURE_VISION_ENDPOINT, AZURE_VISION_KEY
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).send('Method Not Allowed');
  }

  const endpoint = process.env.AZURE_VISION_ENDPOINT;
  const key = process.env.AZURE_VISION_KEY;
  if (!endpoint || !key) return res.status(500).send('Azure not configured');

  try {
    const buffer = await readRawBody(req);
    if (!buffer?.length) return res.status(400).send('Empty body');

    // Use Azure Read API (v3.2). You can update to the latest Image Analysis API if desired.
    const url = `${endpoint.replace(/\/+$/,'')}/vision/v3.2/read/analyze`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/octet-stream'
      },
      body: buffer
    });

    if (!r.ok) {
      const msg = await safeText(r);
      return res.status(r.status).send(msg || 'Azure analyze error');
    }

    // Poll for result via Operation-Location header
    const opLoc = r.headers.get('operation-location');
    if (!opLoc) return res.status(502).send('Missing operation-location');

    const result = await pollReadResult(opLoc, key);
    if (!result?.analyzeResult?.readResults && !result?.status) {
      return res.status(502).send('Invalid Azure response');
    }

    const text = extractTextV32(result);
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).send(err?.message || 'Server error');
  }
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

async function pollReadResult(opUrl, key, { attempts = 15, intervalMs = 800 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const r = await fetch(opUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': key }
    });
    const data = await r.json().catch(() => ({}));
    const status = data?.status || data?.recognitionResults ? 'succeeded' : data?.status;

    if (status === 'succeeded') return data;
    if (status === 'failed') throw new Error('Azure OCR failed');

    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error('Azure OCR timed out');
}

function extractTextV32(result) {
  try {
    const pages = result?.analyzeResult?.readResults || [];
    const lines = [];
    for (const p of pages) {
      for (const l of p.lines || []) {
        if (l.text) lines.push(l.text);
      }
    }
    return lines.join('\n');
  } catch {
    return JSON.stringify(result);
  }
}
