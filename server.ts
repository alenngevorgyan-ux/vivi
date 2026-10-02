import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));

// Lazy initialize Gemini SDK
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

import type { ExperiencePlan } from './src/engine/runtime/generationPipeline.ts';
import { compileViviStory, type CachedSemantics } from './src/engine/compiler/compileViviStory.ts';
import { createGeminiProvider } from './src/server/geminiProvider.ts';

/** Model semantics are cached by normalised story; the compiler re-runs on every request. */
const semanticCache = new Map<string, CachedSemantics>();

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

// API: story → compact DSL (model or deterministic) → Experience Compiler → playable post
app.post('/api/generate-story', async (req, res) => {
  try {
    const {
      prompt,
      whatReallyHappened = '',
      genre = 'Situations',
      author = 'Anonymous',
      responseToPostId,
      themeKey,
      inspirationPrompt,
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A story description is required.' });
    }

    const provider = process.env.GEMINI_API_KEY ? createGeminiProvider(process.env.GEMINI_API_KEY) : null;
    const result = await compileViviStory(
      {
        story: prompt,
        actualOutcome: typeof whatReallyHappened === 'string' ? whatReallyHappened : '',
        category: genre,
        responseToPostId,
        author,
      },
      { provider, cache: semanticCache }
    );

    const { post, compiled, report } = result;
    if (report.fallbackReason && provider) {
      console.warn('Vivi compiler fell back to deterministic semantics:', report.fallbackReason, report.validationErrors ?? '');
    }

    const gameSpec = experiencePlanToGameSpec(compiled.plan, author, genre);
    const playablePost = {
      ...post,
      legacyGameSpec: gameSpec,
      themeKey: themeKey || post.themeKey,
      inspirationPrompt: inspirationPrompt || prompt,
    };

    res.json({
      success: true,
      gameSpec,
      experiencePlan: compiled.plan,
      scenario: post.scenario,
      analysis: post.analysis,
      playablePost,
      dsl: compiled.dsl,
      compilerReport: report,
      responseToPostId,
      themeKey: playablePost.themeKey,
      inspirationPrompt: playablePost.inspirationPrompt,
    });
  } catch (error: any) {
    console.error('Error generating story:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate story.',
    });
  }
});

// API: Expand or generate an individual scene
app.post('/api/expand-scene', async (req, res) => {
  try {
    const { storyTitle, genre, currentSceneTitle, currentNarrative, userInstruction } = req.body;
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `
Story: "${storyTitle}" (${genre})
Current Scene: "${currentSceneTitle}"
Narrative so far: "${currentNarrative}"
User Request: "${userInstruction || 'Add deep dialogue, atmosphere, and 3 high-stakes choices'}"

Respond in JSON with:
{
  "extendedNarrative": "...",
  "dialogue": [{"speaker": "...", "text": "..."}],
  "suggestedChoices": [{"text": "...", "consequenceHint": "..."}]
}
`,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error expanding scene:', error);
    res.status(500).json({ error: error.message || 'Failed to expand scene' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
