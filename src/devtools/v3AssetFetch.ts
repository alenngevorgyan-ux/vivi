/**
 * Dev-only byte fetcher for the V3 visual player's AssetCache: a plain uncached HTTP GET of a bundled asset URL.
 * The runtime never fetches by itself; hosts inject this (a production host would inject its own asset client).
 */
export async function devFetchAsset(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`asset request failed: ${res.status}`);
  return res.arrayBuffer();
}
