import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import type { ExperiencePlan } from './src/engine/runtime/generationPipeline.ts';
import { compileViviStory, type CachedSemantics } from './src/engine/compiler/compileViviStory.ts';
import { selectSemanticProvider } from './src/server/semanticProvider.ts';
import { createGenerationGuard, LIMITS } from './src/server/generationGuard.ts';
import { redactSecrets } from './src/server/redact.ts';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_DEV = process.env.NODE_ENV !== 'production';
const SECRETS = [process.env.OPENROUTER_API_KEY, process.env.GEMINI_API_KEY];

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

/* ---------------------------------------------------- startup validation */

// Semantic provider: chosen once from the server environment. Only names and
// model ids are logged — never a key.
const semantic = selectSemanticProvider(process.env);
for (const warning of semantic.warnings) console.warn(`[vivi] config: ${warning}`);
console.log(`[vivi] semantic provider: ${semantic.kind}${semantic.model ? ` (${semantic.model})` : ''}`);

const guard = createGenerationGuard({
  perClient: Number(process.env.GENERATION_RATE_PER_MIN) || 8,
  maxConcurrent: Number(process.env.GENERATION_MAX_CONCURRENT) || 4,
});
setInterval(() => guard.sweep(), 60_000).unref();

const logError = (label: string, err: unknown) =>
  console.error(label, redactSecrets(err instanceof Error ? `${err.name}: ${err.message}` : String(err), SECRETS));

/** Model semantics are cached by normalised story; the compiler re-runs on every request. */
const semanticCache = new Map<string, CachedSemantics>();
const SEMANTIC_CACHE_MAX = 500;

/** Legacy studio/editor shape, derived from the compiled plan for older views. */
function experiencePlanToGameSpec(plan: ExperiencePlan, author: string, genre: string): any {
  const nodes: Record<string, any> = {
    node_start: {
      id: 'node_start',
      title: plan.title,
      narrative: plan.synopsis,
      worldConfig: {
        template: plan.worldTemplate,
      },
      choices: plan.commitments.map((c, i) => ({
        id: c.id,
        text: c.label,
        nextNodeId: `node_end_${i + 1}`,
      })),
    },
  };

  plan.commitments.forEach((c, i) => {
    nodes[`node_end_${i + 1}`] = {
      id: `node_end_${i + 1}`,
      title: c.label,
      isEnding: true,
      endingSummary: c.outcome,
    };
  });

  return {
    id: plan.id,
    title: plan.title,
    author: author || 'Community Contributor',
    synopsis: plan.synopsis,
    description: plan.synopsis,
    genre: genre || 'Human Situations',
    tags: [genre || 'Real', 'Interactive'],
    estimatedPlaytime: `${plan.durationMinutes || 3} min`,
    whatReallyHappened: plan.authorTruth.status === 'author_supplied' ? plan.authorTruth.text : '',
    startNodeId: 'node_start',
    nodes,
  };
}

const clip = (value: unknown, max: number, fallback = ''): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : fallback;

// API: story → compact DSL (model or deterministic) → Experience Compiler → playable post
app.post('/api/generate-story', async (req, res) => {
  const { prompt, whatReallyHappened, genre, author, responseToPostId, themeKey, inspirationPrompt } = req.body ?? {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'A story description is required.' });
  }
  if (prompt.length > LIMITS.storyChars) {
    return res.status(413).json({ error: `Please keep the story under ${LIMITS.storyChars} characters.` });
  }
  if (typeof whatReallyHappened === 'string' && whatReallyHappened.length > LIMITS.outcomeChars) {
    return res.status(413).json({ error: `Please keep “what really happened” under ${LIMITS.outcomeChars} characters.` });
  }

  const slot = guard.acquire(req.ip ?? 'unknown');
  if (!slot.ok) {
    res.setHeader('Retry-After', String(slot.retryAfterSec));
    return res.status(slot.status).json({ error: 'Vivi is busy creating other stories. Please try again in a moment.', retryAfterSec: slot.retryAfterSec });
  }

  try {
    const safeGenre = clip(genre, LIMITS.genreChars, 'Situations') || 'Situations';
    const safeAuthor = clip(author, LIMITS.authorChars, 'Anonymous') || 'Anonymous';
    const result = await compileViviStory(
      {
        story: prompt,
        // The real outcome is stamped onto the post by the compiler; it is never sent to a model.
        actualOutcome: clip(whatReallyHappened, LIMITS.outcomeChars),
        category: safeGenre,
        responseToPostId: typeof responseToPostId === 'string' ? responseToPostId.slice(0, 120) : undefined,
        author: safeAuthor,
      },
      { provider: semantic.provider, cache: semanticCache }
    );
    if (semanticCache.size > SEMANTIC_CACHE_MAX) semanticCache.delete(semanticCache.keys().next().value!);

    const { post, compiled, report } = result;
    // Usage log: provider, tokens, cost, outcome — never story text.
    console.log(
      `[vivi] generate source=${report.source} model=${report.model ?? '-'} upstream=${report.upstream ?? '-'} in=${report.usage?.inputTokens ?? '-'} out=${report.usage?.outputTokens ?? '-'} reasoning=${report.usage?.reasoningTokens ?? '-'} cost=${report.usage?.costUsd ?? '-'} ms=${report.usage?.latencyMs ?? '-'} firstPass=${report.firstPassValid ?? '-'} repaired=${report.repaired} cache=${report.cacheHit}${report.fallbackReason && semantic.provider ? ` fallback="${redactSecrets(report.fallbackReason, SECRETS)}"` : ''}`
    );

    const gameSpec = experiencePlanToGameSpec(compiled.plan, safeAuthor, safeGenre);
    const playablePost = {
      ...post,
      legacyGameSpec: gameSpec,
      themeKey: clip(themeKey, 60) || post.themeKey,
      inspirationPrompt: clip(inspirationPrompt, LIMITS.storyChars) || prompt,
    };

    res.json({
      success: true,
      gameSpec,
      experiencePlan: compiled.plan,
      scenario: post.scenario,
      analysis: post.analysis,
      playablePost,
      dsl: compiled.dsl,
      // Full generation diagnostics only in development; production gets the bare minimum.
      compilerReport: IS_DEV ? { ...report, semanticProvider: semantic.kind } : { source: report.source, cacheHit: report.cacheHit },
      responseToPostId,
      themeKey: playablePost.themeKey,
      inspirationPrompt: playablePost.inspirationPrompt,
    });
  } catch (error) {
    logError('[vivi] generate failed:', error);
    res.status(500).json({ error: 'Vivi could not build this story right now. Please try again.' });
  } finally {
    slot.release();
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Malformed or oversized JSON bodies: a short message, never a stack trace.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err) return next();
  const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500;
  if (status === 500) logError('[vivi] request failed:', err);
  if (res.headersSent) return next(err);
  res.status(status).json({ error: status === 413 ? 'Request too large.' : status === 400 ? 'Malformed request.' : 'Something went wrong.' });
});

// Setup Vite in Dev or Serve Static in Prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Vivi Story Engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
