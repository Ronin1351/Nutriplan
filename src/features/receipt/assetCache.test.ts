import { describe, expect, it, vi } from 'vitest';
import { createAssetCache } from './assetCache';

describe('receipt asset cache', () => {
  it('returns cached bytes without fetching again', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const cache = createAssetCache({ fetcher, memory: new Map() });

    await expect(cache.getOrFetchAsset('/models/det.tar', 'receipt-models')).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await expect(cache.getOrFetchAsset('/models/det.tar', 'receipt-models')).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
