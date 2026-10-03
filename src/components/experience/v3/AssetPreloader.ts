/**
 * Scene asset preparation for the visual host's `preloadScene` contract.
 *
 * An asset counts as prepared only when its bytes were fetched, hash-matched against the pinned SHA-256 of the
 * Design inventory, and decoded. The renderer then draws from an object URL of exactly those verified bytes, so a
 * swapped, truncated or stale file can never be shown under an approved id. Failure rejects; nothing is retried
 * silently. Generic: it knows asset ids, URLs and hashes, never a story. The network is not touched here: the host
 * injects the byte fetcher, like every other side effect of the V3 runtime.
 */

/** Host-supplied byte loader (the dev entry injects a plain HTTP GET; a production host its own CDN client). */
export type AssetFetcher = (url: string) => Promise<ArrayBuffer>;

import type { StagingAsset } from './staging.ts';

export class AssetError extends Error {
  constructor(readonly asset: string, readonly code: 'fetch_failed' | 'hash_mismatch' | 'decode_failed' | 'unknown_asset' | 'aborted') {
    super(`${code}: ${asset}`);
  }
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of bytes: WebCrypto where the context allows it, otherwise a small portable implementation. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle) return hex(await subtle.digest('SHA-256', bytes));
  return sha256Portable(new Uint8Array(bytes));
}

function sha256Portable(m: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = m.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(m);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
  dv.setUint32(padded.length - 4, (len * 8) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, x => x.toString(16).padStart(8, '0')).join('');
}

export class AssetCache {
  private ready = new Map<string, string>();
  private inflight = new Map<string, Promise<string>>();
  private disposed = false;

  constructor(private readonly assets: Readonly<Record<string, StagingAsset>>, private readonly fetcher: AssetFetcher) {}

  /** The verified object URL of a prepared asset; undefined until prepared. */
  url(id: string): string | undefined {
    return this.ready.get(id);
  }
  has(id: string): boolean {
    return this.ready.has(id);
  }

  /** Prepare several assets; rejects with the first AssetError. The caller's signal abandons the wait. */
  async prepare(ids: readonly string[], signal?: AbortSignal): Promise<void> {
    await Promise.all(ids.map(id => this.one(id, signal)));
  }

  private one(id: string, signal?: AbortSignal): Promise<string> {
    const done = this.ready.get(id);
    if (done) return Promise.resolve(done);
    let p = this.inflight.get(id);
    if (!p) {
      p = this.load(id).finally(() => this.inflight.delete(id));
      this.inflight.set(id, p);
    }
    if (!signal) return p;
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new AssetError(id, 'aborted'));
      const onAbort = () => reject(new AssetError(id, 'aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      p!.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  private async load(id: string): Promise<string> {
    const a = this.assets[id];
    if (!a) throw new AssetError(id, 'unknown_asset');
    let bytes: ArrayBuffer;
    try {
      bytes = await this.fetcher(a.url);
    } catch {
      throw new AssetError(id, 'fetch_failed');
    }
    if ((await sha256Hex(bytes)) !== a.sha256) throw new AssetError(id, 'hash_mismatch');
    const type = a.url.endsWith('.png') ? 'image/png' : a.url.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new AssetError(id, 'decode_failed');
    }
    if (this.disposed) {
      URL.revokeObjectURL(url);
      throw new AssetError(id, 'aborted');
    }
    this.ready.set(id, url);
    return url;
  }

  dispose(): void {
    this.disposed = true;
    for (const u of this.ready.values()) URL.revokeObjectURL(u);
    this.ready.clear();
  }
}
