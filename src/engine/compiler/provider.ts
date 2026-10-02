import type { StoryHints } from './preprocess.ts';

/**
 * A semantic provider turns a story into DSL text. The compiler does not care
 * which one produced it: Gemini today, an OpenAI model, a small fine-tuned
 * model or a local classifier later. Implementations live outside the
 * compiler (see server.ts) so the core never imports a vendor SDK.
 */
export interface SemanticRequest {
  story: string;
  hints: StoryHints;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface SemanticReply {
  /** Raw reply text, expected to hold one DSL JSON object. */
  text: string;
  model: string;
  /** Authoritative usage when the provider reports it. */
  usage?: ModelUsage;
}

export interface ExperienceSemanticProvider {
  id: string;
  compileStory(request: SemanticRequest): Promise<SemanticReply>;
  /** One concise repair turn: only the invalid DSL and its errors are sent. */
  repair?(request: SemanticRequest, invalidJson: string, errors: string[]): Promise<SemanticReply>;
}

export function addUsage(a: ModelUsage | undefined, b: ModelUsage | undefined): ModelUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  const sum = (x?: number, y?: number) => (x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0));
  return {
    inputTokens: sum(a.inputTokens, b.inputTokens),
    outputTokens: sum(a.outputTokens, b.outputTokens),
    totalTokens: sum(a.totalTokens, b.totalTokens),
  };
}
