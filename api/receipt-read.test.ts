import { describe, expect, it, vi } from 'vitest';
import { pollReadResult } from './receipt-read.js';

describe('pollReadResult', () => {
  it('waits for running before returning a succeeded result', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'running' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'succeeded', analyzeResult: { readResults: [] } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(pollReadResult('https://azure.test/op', 'key', { attempts: 2, intervalMs: 0 }))
      .resolves.toMatchObject({ status: 'succeeded' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not treat an unrelated response shape as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ recognitionResults: [] }))));

    await expect(pollReadResult('https://azure.test/op', 'key', { attempts: 1, intervalMs: 0 }))
      .rejects.toThrow('Azure OCR timed out');
  });
});
