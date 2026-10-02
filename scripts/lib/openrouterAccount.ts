/**
 * Spend guard for live OpenRouter runs. Reads ONLY numeric usage fields of
 * the configured key (GET /api/v1/key); the key itself is never printed.
 */
export interface KeyUsage {
  usage: number;
  limit: number | null;
  limitRemaining: number | null;
}

export async function readKeyUsage(apiKey: string): Promise<KeyUsage | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { usage?: number; limit?: number | null; limit_remaining?: number | null } };
    return {
      usage: Number(json.data?.usage ?? 0),
      limit: json.data?.limit ?? null,
      limitRemaining: json.data?.limit_remaining ?? null,
    };
  } catch {
    return null;
  }
}
