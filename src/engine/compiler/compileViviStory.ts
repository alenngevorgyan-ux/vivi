import { preprocessStory, type StoryHints } from './preprocess.ts';
import { deterministicDSL } from './deterministicProvider.ts';
import { serializeDSL, stripModelOnlyFields, validateDSL, type ViviExperienceDSL } from './dsl.ts';
import { compileExperience, type CompiledExperience } from './ExperienceCompiler.ts';
import { parseModelJson } from './modelContract.ts';
import { wireToDsl } from './structuredContract.ts';
import { addUsage, type ExperienceSemanticProvider, type ModelUsage } from './provider.ts';
import { COMPILER_VERSION, DSL_VERSION } from './vocabulary.ts';
import type { StoredPlayablePost } from '../runtime/generationPipeline.ts';

/**
 * compileViviStory — the single generation pipeline.
 *
 *   story → preprocess → semantic provider OR deterministic fallback
 *         → ViviExperienceDSL → validate (one repair at most) → ExperienceCompiler
 *         → ExperiencePlan → CanonicalScenario → StoredPlayablePost
 *
 * Pure and framework-free: the server calls it today, and the same function
 * is the boundary a future MCP tool or ChatGPT App would expose. It never
 * sends the author's real outcome to a model and never lets a model's output
 * decide what is true.
 */
export interface CompileStoryInput {
  story: string;
  actualOutcome?: string;
  category?: string;
  responseToPostId?: string;
  author?: string;
}

export interface CompileStoryOptions {
  provider?: ExperienceSemanticProvider | null;
  /** Semantic cache: identical stories reuse the model's DSL and only recompile. */
  cache?: Map<string, CachedSemantics>;
  now?: number;
}

export interface CachedSemantics {
  dsl: ViviExperienceDSL;
  model: string;
  upstream?: string;
  usage?: ModelUsage;
  repaired: boolean;
}

export interface CompileStoryReport {
  source: 'model' | 'deterministic';
  /** Configured semantic provider, e.g. `openrouter:qwen/qwen3.8-flash`. */
  providerId?: string;
  /** Model that actually answered (may differ from the configured one under router fallback). */
  model?: string;
  /** Upstream host that served the model, when the router reports it. */
  upstream?: string;
  /** Total usage, first pass plus repair. */
  usage?: ModelUsage;
  /** Usage of the repair turn alone, so repair cost can be measured independently. */
  repairUsage?: ModelUsage;
  /** The model's first reply validated without repair. Undefined when no model was called. */
  firstPassValid?: boolean;
  /** First-pass validation errors, kept even when the repair succeeded. */
  firstPassErrors?: string[];
  repaired: boolean;
  cacheHit: boolean;
  fallbackReason?: string;
  validationErrors?: string[];
  dslBytes: number;
  compileMs: number;
}

export interface CompileStoryResult {
  post: StoredPlayablePost;
  compiled: CompiledExperience;
  hints: StoryHints;
  report: CompileStoryReport;
}

/** Stored posts keep a short, non-sensitive reason, never a provider's full error payload. */
function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(message);
    const e = parsed?.error ?? parsed;
    if (e?.code || e?.status) return `${e.code ?? ''} ${e.status ?? ''}`.trim();
  } catch {
    // not JSON
  }
  return message.replace(/\s+/g, ' ').slice(0, 120);
}

function normalise(story: string): string {
  return story.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function semanticCacheKey(input: CompileStoryInput, providerId: string): string {
  // The real outcome is deliberately not part of the key: it never reaches the model.
  return `${DSL_VERSION}|${providerId}|${input.category ?? ''}|${normalise(input.story)}`;
}

export async function compileViviStory(
  input: CompileStoryInput,
  options: CompileStoryOptions = {}
): Promise<CompileStoryResult> {
  const story = input.story?.trim();
  if (!story) throw new Error('A story is required.');

  const hints = preprocessStory(story, { category: input.category, actualOutcome: input.actualOutcome });
  const provider = options.provider ?? null;

  let dsl: ViviExperienceDSL | null = null;
  let source: 'model' | 'deterministic' = 'deterministic';
  let model: string | undefined;
  let upstream: string | undefined;
  let usage: ModelUsage | undefined;
  let repairUsage: ModelUsage | undefined;
  let repaired = false;
  let cacheHit = false;
  let firstPassValid: boolean | undefined;
  let firstPassErrors: string[] | undefined;
  let fallbackReason: string | undefined;
  let validationErrors: string[] | undefined;

  const check = (text: string) => {
    try {
      return validateDSL(stripModelOnlyFields(wireToDsl(parseModelJson(text))));
    } catch (err) {
      return { ok: false as const, errors: [err instanceof Error ? err.message : 'Unparseable reply'] };
    }
  };

  if (provider) {
    const key = semanticCacheKey(input, provider.id);
    const cached = options.cache?.get(key);
    if (cached) {
      dsl = cached.dsl;
      model = cached.model;
      upstream = cached.upstream;
      usage = cached.usage;
      repaired = cached.repaired;
      source = 'model';
      cacheHit = true;
    } else {
      try {
        const request = { story, hints };
        const reply = await provider.compileStory(request);
        model = reply.model;
        upstream = reply.upstream;
        usage = reply.usage;
        let validation = check(reply.text);
        firstPassValid = validation.ok;
        if (!validation.ok) firstPassErrors = validation.errors;

        if (!validation.ok && provider.repair) {
          const fixed = await provider.repair(request, reply.text, validation.errors);
          repairUsage = fixed.usage;
          usage = addUsage(usage, fixed.usage);
          repaired = true;
          validation = check(fixed.text);
        }

        if (validation.ok) {
          dsl = validation.dsl;
          source = 'model';
          options.cache?.set(key, { dsl, model: model ?? provider.id, upstream, usage, repaired });
        } else {
          validationErrors = validation.errors;
          fallbackReason = `model DSL invalid after ${repaired ? 'repair' : 'first attempt'}`;
        }
      } catch (err) {
        fallbackReason = `provider error: ${shortError(err)}`;
      }
    }
  } else {
    fallbackReason = 'no semantic provider configured';
  }

  if (!dsl) {
    const fallback = validateDSL(deterministicDSL(hints));
    if (!fallback.ok) {
      // The fallback is code we own; an invalid program here is a bug, not bad input.
      throw new Error(`Deterministic DSL failed validation: ${fallback.errors.join('; ')}`);
    }
    dsl = fallback.dsl;
    source = 'deterministic';
  }

  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const compiled = compileExperience(dsl, {
    story,
    author: input.author,
    actualOutcome: input.actualOutcome,
    category: input.category,
    responseToPostId: input.responseToPostId,
    source,
    model,
    lang: hints.lang,
    createdAt: options.now,
    stamp: {
      ...(usage ? { usage } : {}),
      repaired,
      ...(fallbackReason ? { fallbackReason } : {}),
    },
  });
  const compileMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;

  return {
    post: compiled.post,
    compiled,
    hints,
    report: {
      source,
      ...(provider ? { providerId: provider.id } : {}),
      model,
      upstream,
      usage,
      repairUsage,
      firstPassValid,
      firstPassErrors,
      repaired,
      cacheHit,
      fallbackReason,
      validationErrors,
      dslBytes: new TextEncoder().encode(serializeDSL(dsl)).length,
      compileMs,
    },
  };
}

export { COMPILER_VERSION, DSL_VERSION };
