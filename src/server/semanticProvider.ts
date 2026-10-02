import type { ExperienceSemanticProvider } from '../engine/compiler/provider.ts';
import { createGeminiProvider } from './geminiProvider.ts';
import { DEFAULT_OPENROUTER_MODEL, createOpenRouterProvider, type ReasoningMode } from './openRouterProvider.ts';

/**
 * Which semantic provider the server uses. One env change switches it; the
 * compiler never knows which vendor answered.
 *
 *   SEMANTIC_PROVIDER=auto (default)  OpenRouter key → OpenRouter
 *                                     else Gemini key → Gemini
 *                                     else deterministic
 *   SEMANTIC_PROVIDER=openrouter | gemini | deterministic   force one
 */
export type SemanticProviderKind = 'openrouter' | 'gemini' | 'deterministic';

export interface SemanticProviderSelection {
  kind: SemanticProviderKind;
  provider: ExperienceSemanticProvider | null;
  /** Model id for display; never a credential. */
  model?: string;
  /** Configuration problems worth a startup warning (no values, only names). */
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const REASONING_MODES: ReasoningMode[] = ['off', 'minimal', 'low', 'default'];

function num(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function selectSemanticProvider(env: Env = process.env): SemanticProviderSelection {
  const warnings: string[] = [];
  const requested = (env.SEMANTIC_PROVIDER ?? 'auto').trim().toLowerCase();
  const openRouterKey = env.OPENROUTER_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();

  for (const name of Object.keys(env)) {
    if (/^VITE_/.test(name) && /(KEY|SECRET|TOKEN)/i.test(name)) {
      warnings.push(`${name} looks like a secret in a VITE_ variable: Vite ships VITE_* values to the browser.`);
    }
  }

  if (!['auto', 'openrouter', 'gemini', 'deterministic'].includes(requested)) {
    warnings.push(`SEMANTIC_PROVIDER="${requested}" is not recognised; using auto.`);
  }

  const wantOpenRouter = requested === 'openrouter' || (!['gemini', 'deterministic'].includes(requested) && !!openRouterKey);
  const wantGemini = requested === 'gemini' || (requested !== 'deterministic' && !wantOpenRouter && !!geminiKey);

  if (requested === 'deterministic') return { kind: 'deterministic', provider: null, warnings };

  if (wantOpenRouter) {
    if (!openRouterKey) {
      warnings.push('SEMANTIC_PROVIDER=openrouter but OPENROUTER_API_KEY is not set: using deterministic semantics.');
      return { kind: 'deterministic', provider: null, warnings };
    }
    if (!openRouterKey.startsWith('sk-or-')) warnings.push('OPENROUTER_API_KEY does not look like an OpenRouter key.');
    const model = env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
    const reasoning = (env.OPENROUTER_REASONING?.trim() || 'off') as ReasoningMode;
    if (!REASONING_MODES.includes(reasoning)) warnings.push(`OPENROUTER_REASONING must be one of ${REASONING_MODES.join('|')}.`);
    const sort = env.OPENROUTER_PROVIDER_SORT?.trim();
    const provider = createOpenRouterProvider({
      apiKey: openRouterKey,
      model,
      fallbackModel: env.OPENROUTER_FALLBACK_MODEL?.trim() || undefined,
      appName: env.OPENROUTER_APP_NAME?.trim() || 'Vivi',
      siteUrl: env.OPENROUTER_SITE_URL?.trim() || undefined,
      temperature: num(env.OPENROUTER_TEMPERATURE, 0.2, 0, 2),
      maxTokens: num(env.OPENROUTER_MAX_TOKENS, 700, 200, 2000),
      timeoutMs: num(env.OPENROUTER_TIMEOUT_MS, 20000, 2000, 120000),
      reasoning: REASONING_MODES.includes(reasoning) ? reasoning : 'off',
      zdr: env.OPENROUTER_ZDR === 'true',
      sort: sort === 'price' || sort === 'latency' || sort === 'throughput' ? sort : undefined,
    });
    return { kind: 'openrouter', provider, model: provider.id.replace(/^openrouter:/, ''), warnings };
  }

  if (wantGemini) {
    if (!geminiKey) {
      warnings.push('SEMANTIC_PROVIDER=gemini but GEMINI_API_KEY is not set: using deterministic semantics.');
      return { kind: 'deterministic', provider: null, warnings };
    }
    const provider = createGeminiProvider(geminiKey, env.GEMINI_MODEL?.trim() || undefined);
    return { kind: 'gemini', provider, model: provider.id.replace(/^gemini:/, ''), warnings };
  }

  return { kind: 'deterministic', provider: null, warnings };
}
