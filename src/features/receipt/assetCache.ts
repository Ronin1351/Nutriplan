import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const NATIVE_DIR = 'receipt-ocr-assets';

export interface AssetCache {
  getOrFetchAsset(url: string, cacheName: string): Promise<Uint8Array>;
}

interface AssetCacheOptions {
  fetcher?: typeof fetch;
  memory?: Map<string, Uint8Array>;
  native?: boolean;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function nativeFileName(url: string): string {
  return url.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'asset.bin';
}

export function createAssetCache(options: AssetCacheOptions = {}): AssetCache {
  const fetcher = options.fetcher ?? fetch;
  const memory = options.memory ?? new Map<string, Uint8Array>();
  const native = options.native ?? Capacitor.isNativePlatform();
  return {
    async getOrFetchAsset(url, cacheName) {
      const key = `${cacheName}:${url}`;
      const memoryHit = memory.get(key);
      if (memoryHit) return memoryHit.slice();
      const filename = nativeFileName(url);

      if (native) {
        try {
          const stored = await Filesystem.readFile({ path: `${NATIVE_DIR}/${filename}`, directory: Directory.Data });
          const bytes = typeof stored.data === 'string' ? fromBase64(stored.data) : new Uint8Array(await new Blob([stored.data]).arrayBuffer());
          memory.set(key, bytes);
          return bytes.slice();
        } catch { /* first native read or stale asset: fetch below */ }
      } else if (typeof caches !== 'undefined') {
        const browserCache = await caches.open(cacheName);
        const cached = await browserCache.match(url);
        if (cached) {
          const bytes = new Uint8Array(await cached.arrayBuffer());
          memory.set(key, bytes);
          return bytes.slice();
        }
      }

      const response = await fetcher(url);
      if (!response.ok) throw new Error(`OCR asset download failed (${response.status}).`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      memory.set(key, bytes);
      if (native) {
        await Filesystem.mkdir({ path: NATIVE_DIR, directory: Directory.Data, recursive: true }).catch(() => undefined);
        await Filesystem.writeFile({ path: `${NATIVE_DIR}/${filename}`, data: toBase64(bytes), directory: Directory.Data, recursive: true });
      } else if (typeof caches !== 'undefined') {
        const browserCache = await caches.open(cacheName);
        await browserCache.put(url, new Response(bytes));
      }
      return bytes.slice();
    },
  };
}
