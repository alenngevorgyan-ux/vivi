import type { StoryHints } from './preprocess.ts';

/**
 * A semantic provider turns a story into DSL text. The compiler does not care
 * which one produced it: OpenRouter or Gemini today, a small fine-tuned model
 * or a local classifier later. Implementations live outside the compiler
 * (src/server/) so the core never imports a vendor SDK.
 */
export interface SemanticRequest {
  story: string;
  hints: StoryHints;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /** Hidden reasoning tokens, billed as output; reported separately when the provider says so. */
  reasoningTokens?: number;
  /** Prompt tokens served from the provider's prompt cache. */
  cachedInputTokens?: number;
  /** Cost in USD as reported by the provider (never estimated here). */
  costUsd?: number;
  /** Wall-clock latency of the request(s), in ms. */
  latencyMs?: number;
}

export interface SemanticReply {
  /** Raw reply text, expected to hold one DSL JSON object (positional or wire form). */
  text: string;
  model: string;
  /** Upstream host that served the request, when the router reports it. */
  upstream?: string;
  /** Authoritative usage when the provider reports it. */
  usage?: ModelUsage;
  /** The reply was cut off by the output-token cap. */
  truncated?: boolean;
}

export interface ExperienceSemanticProvider {
  id: string;
  compileStory(request: SemanticRequest): Promise<SemanticReply>;
  /** One concise repair turn: only the invalid DSL and its errors are sent. */
  repair?(request: SemanticRequest, invalidJson: string, errors: string[]): Promise<SemanticReply>;
}

const USAGE_KEYS = ['inputTokens', 'outputTokens', 'totalTokens', 'reasoningTokens', 'cachedInputTokens', 'costUsd', 'latencyMs'] as const;

export function addUsage(a: ModelUsage | undefined, b: ModelUsage | undefined): ModelUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: ModelUsage = {};
  for (const k of USAGE_KEYS) {
    if (a[k] === undefined && b[k] === undefined) continue;
    out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  }
  return out;
}
