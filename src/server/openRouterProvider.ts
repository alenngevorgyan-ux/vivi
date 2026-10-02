import type { ExperienceSemanticProvider, ModelUsage, SemanticReply, SemanticRequest } from '../engine/compiler/provider.ts';
import {
  DSL_SCHEMA_NAME,
  STRUCTURED_REPAIR_SYSTEM,
  STRUCTURED_SYSTEM_PROMPT,
  buildDslJsonSchema,
  structuredRepairPrompt,
  structuredUserPrompt,
} from '../engine/compiler/structuredContract.ts';
import { redactSecrets } from './redact.ts';

/**
 * OpenRouter as one interchangeable semantic provider. SERVER-ONLY: the key
 * is read from the server environment, sent only in the Authorization header
 * and never logged, returned or stored.
 *
 * Requests use strict JSON-schema structured output built from the DSL
 * vocabulary, `require_parameters` so the router only picks hosts that honour
 * the schema, `data_collection: deny`, a tight token cap and (where the model
 * allows it) reasoning switched off.
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_MODEL = 'qwen/qwen3.8-flash';

export type ReasoningMode = 'off' | 'minimal' | 'low' | 'default';

export interface OpenRouterOptions {
  apiKey: string;
  model?: string;
  /** Second model passed to OpenRouter's own `models` fallback (one request, no cascade). */
  fallbackModel?: string;
  appName?: string;
  siteUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  reasoning?: ReasoningMode;
  /** Restrict routing to zero-data-retention endpoints. Off by default: not every model has one. */
  zdr?: boolean;
  /** Optional provider sort (`price`, `latency`, `throughput`). Unset = OpenRouter's default balancing. */
  sort?: 'price' | 'latency' | 'throughput';
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Skip the public capability lookup (tests). */
  capabilities?: ModelCapabilities;
}

export interface ModelCapabilities {
  temperature: boolean;
  reasoning: boolean;
  structuredOutputs: boolean;
  /** Cheapest qualifying endpoint price, USD per token, for reporting only. */
  pricing?: { prompt: number; completion: number };
}

export type OpenRouterErrorCode =
  | 'unauthorized'
  | 'insufficient_credits'
  | 'rate_limited'
  | 'model_unavailable'
  | 'moderated'
  | 'bad_request'
  | 'upstream_error'
  | 'timeout'
  | 'network'
  | 'empty_reply';

/** A provider failure that is safe to log: status and a short code, never the key or the request. */
export class OpenRouterError extends Error {
  constructor(
    readonly code: OpenRouterErrorCode,
    readonly status: number | undefined,
    /** Short, redacted upstream message for DEV diagnostics. */
    readonly detail?: string
  ) {
    super(`openrouter ${status ?? '-'} ${code}`);
    this.name = 'OpenRouterError';
  }
}

function classify(status: number, body: string): OpenRouterErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 402) return 'insufficient_credits';
  if (status === 429) return 'rate_limited';
  if (status === 403) return 'moderated';
  if (status === 404) return 'model_unavailable';
  if (status === 408) return 'timeout';
  if (status === 400) return /no endpoints|not a valid model|model.*(not|un)available/i.test(body) ? 'model_unavailable' : 'bad_request';
  if (status === 502 || status === 503) return /no (endpoints|providers)/i.test(body) ? 'model_unavailable' : 'upstream_error';
  return 'upstream_error';
}

const capabilityCache = new Map<string, Promise<ModelCapabilities>>();

/** Public, unauthenticated catalogue lookup: which parameters the model's endpoints accept. */
export async function fetchModelCapabilities(
  model: string,
  { baseUrl = OPENROUTER_BASE_URL, fetchImpl = fetch }: { baseUrl?: string; fetchImpl?: typeof fetch } = {}
): Promise<ModelCapabilities> {
  const key = `${baseUrl}|${model}`;
  let pending = capabilityCache.get(key);
  if (!pending) {
    pending = (async () => {
      const res = await fetchImpl(`${baseUrl}/models/${model}/endpoints`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`capabilities ${res.status}`);
      const json = (await res.json()) as {
        data?: { endpoints?: Array<{ supported_parameters?: string[]; pricing?: { prompt?: string; completion?: string } }> };
      };
      const endpoints = (json.data?.endpoints ?? []).filter(e => {
        const p = e.supported_parameters ?? [];
        return p.includes('structured_outputs') && p.includes('response_format') && p.includes('max_tokens');
      });
      // A parameter is only sent when EVERY eligible endpoint accepts it: account privacy
      // policies (e.g. ZDR-only) can remove the endpoints that would have supported it.
      const supports = (param: string) => endpoints.length > 0 && endpoints.every(e => e.supported_parameters?.includes(param));
      const prices = endpoints
        .map(e => ({ prompt: Number(e.pricing?.prompt), completion: Number(e.pricing?.completion) }))
        .filter(p => Number.isFinite(p.prompt) && Number.isFinite(p.completion))
        .sort((a, b) => a.prompt + a.completion * 0.25 - (b.prompt + b.completion * 0.25));
      return {
        temperature: supports('temperature'),
        reasoning: supports('reasoning'),
        structuredOutputs: endpoints.length > 0,
        pricing: prices[0],
      };
    })().catch(err => {
      capabilityCache.delete(key);
      throw err;
    });
    capabilityCache.set(key, pending);
  }
  return pending;
}

/** Unknown capabilities: send only what every structured-output endpoint accepts. */
const CONSERVATIVE: ModelCapabilities = { temperature: false, reasoning: false, structuredOutputs: true };

function reasoningParam(mode: ReasoningMode): Record<string, unknown> | undefined {
  // `exclude` keeps reasoning text out of the reply; any reasoning tokens are still reported in usage.
  switch (mode) {
    case 'off':
      return { enabled: false };
    case 'minimal':
      return { effort: 'minimal', exclude: true };
    case 'low':
      return { effort: 'low', exclude: true };
    default:
      return undefined;
  }
}

interface ChatResponse {
  model?: string;
  provider?: string;
  error?: { code?: number | string; message?: string };
  choices?: Array<{ finish_reason?: string; native_finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

export function extractUsage(json: ChatResponse, latencyMs: number): ModelUsage | undefined {
  const u = json.usage;
  if (!u) return { latencyMs };
  return {
    inputTokens: u.prompt_tokens,
    outputTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens,
    costUsd: u.cost,
    latencyMs,
  };
}

export function createOpenRouterProvider(options: OpenRouterOptions): ExperienceSemanticProvider & {
  model: string;
  /** Exposed for tests: the exact JSON body that would be sent (without headers). */
  buildBody(system: string, user: string): Promise<Record<string, unknown>>;
} {
  const {
    apiKey,
    model = DEFAULT_OPENROUTER_MODEL,
    fallbackModel,
    appName = 'Vivi',
    siteUrl,
    temperature = 0.2,
    maxTokens = 700,
    timeoutMs = 20000,
    reasoning = 'off',
    zdr = false,
    sort,
    baseUrl = OPENROUTER_BASE_URL,
  } = options;
  const fetchImpl = options.fetch ?? fetch;
  if (!apiKey) throw new Error('OpenRouter provider needs an API key.');
  const schema = buildDslJsonSchema();

  const capabilities = async (): Promise<ModelCapabilities> => {
    if (options.capabilities) return options.capabilities;
    try {
      const primary = await fetchModelCapabilities(model, { baseUrl, fetchImpl });
      if (!fallbackModel) return primary;
      // With a router fallback every parameter must suit both models.
      const second = await fetchModelCapabilities(fallbackModel, { baseUrl, fetchImpl });
      return {
        temperature: primary.temperature && second.temperature,
        reasoning: primary.reasoning && second.reasoning,
        structuredOutputs: primary.structuredOutputs && second.structuredOutputs,
        pricing: primary.pricing,
      };
    } catch {
      return CONSERVATIVE;
    }
  };

  /**
   * Learned per model, at no cost (rejected requests are not billed): some
   * models make reasoning mandatory, so `off` becomes the lowest effort they
   * accept; some hosts reject `temperature` under the account's data policy.
   */
  const learned = { reasoning: reasoning as ReasoningMode, temperature: true };

  const buildBody = async (system: string, user: string): Promise<Record<string, unknown>> => {
    const caps = await capabilities();
    const reasoningConfig = caps.reasoning ? reasoningParam(learned.reasoning) : undefined;
    return {
      ...(fallbackModel ? { models: [model, fallbackModel] } : { model }),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: DSL_SCHEMA_NAME, strict: true, schema },
      },
      max_tokens: maxTokens,
      ...(caps.temperature && learned.temperature ? { temperature } : {}),
      ...(reasoningConfig ? { reasoning: reasoningConfig } : {}),
      provider: {
        require_parameters: true,
        data_collection: 'deny',
        ...(zdr ? { zdr: true } : {}),
        ...(sort ? { sort } : {}),
      },
      usage: { include: true },
    };
  };

  const call = async (system: string, user: string): Promise<SemanticReply> => {
    // Judge the retry by what THIS request sent: concurrent requests may have learned already.
    const sentReasoning = learned.reasoning;
    const sentTemperature = learned.temperature;
    try {
      return await send(system, user);
    } catch (err) {
      if (!(err instanceof OpenRouterError) || !err.detail) throw err;
      if (/reasoning is mandatory/i.test(err.detail) && sentReasoning === 'off') {
        learned.reasoning = 'minimal';
        return send(system, user);
      }
      if (/requested parameters/i.test(err.detail) && sentTemperature) {
        learned.temperature = false;
        return send(system, user);
      }
      throw err;
    }
  };

  const send = async (system: string, user: string): Promise<SemanticReply> => {
    const body = await buildBody(system, user);
    const started = Date.now();
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': appName,
          ...(siteUrl ? { 'HTTP-Referer': siteUrl } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') throw new OpenRouterError('timeout', undefined);
      throw new OpenRouterError('network', undefined, redactSecrets(err instanceof Error ? err.message : String(err), [apiKey]).slice(0, 160));
    }

    // OpenRouter sends 200 headers early and keeps the connection alive while the model
    // works, so the timeout usually fires while the BODY is being read.
    let raw: string;
    try {
      raw = await res.text();
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'TimeoutError' || name === 'AbortError') throw new OpenRouterError('timeout', res.status);
      throw new OpenRouterError('network', res.status, redactSecrets(err instanceof Error ? err.message : String(err), [apiKey]).slice(0, 160));
    }
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      throw new OpenRouterError(classify(res.status, raw), res.status, shortDetail(raw, apiKey));
    }

    let json: ChatResponse;
    try {
      json = JSON.parse(raw) as ChatResponse;
    } catch {
      throw new OpenRouterError(raw.trim() ? 'upstream_error' : 'empty_reply', res.status, 'non-JSON reply');
    }
    if (json.error) {
      const status = typeof json.error.code === 'number' ? json.error.code : res.status;
      throw new OpenRouterError(classify(status, json.error.message ?? ''), status, shortDetail(json.error.message ?? '', apiKey));
    }
    const choice = json.choices?.[0];
    const text = choice?.message?.content ?? '';
    if (!text) {
      throw new OpenRouterError(choice?.message?.refusal ? 'moderated' : 'empty_reply', res.status);
    }
    return {
      text,
      model: json.model ?? model,
      upstream: json.provider,
      usage: extractUsage(json, latencyMs),
      truncated: choice?.finish_reason === 'length',
    };
  };

  return {
    id: `openrouter:${model}${fallbackModel ? `+${fallbackModel}` : ''}`,
    model,
    buildBody,
    compileStory: (request: SemanticRequest) => call(STRUCTURED_SYSTEM_PROMPT, structuredUserPrompt(request.story, request.hints)),
    repair: (_request, invalidJson, errors) => call(STRUCTURED_REPAIR_SYSTEM, structuredRepairPrompt(invalidJson, errors)),
  };
}

function shortDetail(raw: string, apiKey: string): string {
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    message = parsed.error?.message ?? raw;
  } catch {
    // not JSON
  }
  return redactSecrets(message.replace(/\s+/g, ' '), [apiKey]).slice(0, 200);
}
