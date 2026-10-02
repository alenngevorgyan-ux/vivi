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

import {
  validateExperiencePlan,
  generateDeterministicExperiencePlan,
  compileExperiencePlanToScenario,
  type ExperiencePlan,
  type StoryAnalysis,
  type StoredPlayablePost,
} from './src/engine/runtime/generationPipeline.ts';

// System instruction for Experience Plan Generator
const EXPERIENCE_PLAN_SYSTEM_INSTRUCTION = `
You are the scenario compiler for VIVI, a platform where real human situations become tiny playable 2D worlds that people enter and explore physically.

Analyze the user's situation and generate a JSON response with two objects:
1. "analysis": StoryAnalysis {
   "setting": string,
   "people": string[],
   "emotionalCore": string,
   "centralTension": string,
   "pivotalMoment": string,
   "importantObjects": string[],
   "actualOutcome": string | null, // ONLY if provided by user! Never invent!
   "experienceGrammar": string,
   "themeKey": string
}

2. "plan": ExperiencePlan {
   "id": string, // "exp_..."
   "title": string,
   "synopsis": string,
   "worldTemplate": "apartment_night" | "office_night" | "hallway_night" | "neighborhood_sunset" | "bar_or_party" | "train_station" | "city_rain" | "family_home" | "hotel_or_rental" | "bedroom_night",
   "durationMinutes": 3,
   "cast": [
     {
       "role": string,
       "character": "young_adult_masc_01" | "adult_fem_01" | "young_adult_masc_02" | "elder_masc_01",
       "slot": string, // semantic slot
       "pose": "idle" | "wait" | "confront" | "read" | "leave"
     }
   ],
   "beats": [
     { "id": "beat_arrival", "type": "arrival", "trigger": "time_elapsed", "triggerPayload": 0, "title": "Arrival", "description": "..." },
     { "id": "beat_cue", "type": "cue", "trigger": "time_elapsed", "triggerPayload": 6000, "title": "The Cue", "description": "...", "isCue": true },
     { "id": "beat_pressure", "type": "pressure", "trigger": "time_elapsed", "triggerPayload": 22000, "title": "Pressure", "description": "...", "isPressure": true },
     { "id": "beat_commit", "type": "commitment", "trigger": "player_committed", "title": "Decision", "description": "..." }
   ],
   "interactions": [
     {
       "id": "act_1",
       "targetSlot": string, // MUST be semantic slot name (e.g. phone_table, bathroom_door, sofa, front_door, presentation_screen, etc.)
       "label": string, // 1-45 chars max
       "observation": string,
       "commitLabel": string
     },
     {
       "id": "act_2",
       "targetSlot": string,
       "label": string,
       "observation": string,
       "commitLabel": string
     }
   ],
   "modifiers": [
     {
       "id": "mod_1",
       "kind": "timer" | "message" | "sound" | "door" | "npcPressure" | "lighting" | "arrival",
       "atMs": number,
       "anchor": string,
       "payload": string,
       "visibleToPlayer": true
     }
   ],
   "commitments": [
     { "id": "act_1", "targetSlot": string, "label": string, "outcome": string },
     { "id": "act_2", "targetSlot": string, "label": string, "outcome": string }
   ],
   "authorTruth": {
     "status": "author_supplied" | "withheld",
     "text": string // ONLY IF USER SUPPLIED WHAT ACTUALLY HAPPENED! Omit or leave empty if user did not provide reality.
   },
   "crowdQuestion": string,
   "responsePrompt": string
}

CRITICAL RULES:
- Raw x/y coordinates are STRICTLY FORBIDDEN. Only use semantic slots: 'phone_table', 'bathroom_door', 'sofa', 'presentation_screen', 'player_laptop', 'director', 'intercom', 'elevator', 'front_door', 'bench', 'bus_stop', 'station_board', 'platform_edge', 'dining_table', 'decision_center'.
- ZERO AUTHOR TRUTH FABRICATION: If the user did not specify what really happened in real life, authorTruth.status MUST be "withheld". DO NOT invent or make up what happened in reality.
- Respond ONLY with clean, valid JSON containing {"analysis": ..., "plan": ...}.
`;

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

// API: Generate GameSpec & ExperiencePlan using Gemini (with retry & schema validation) or Deterministic Fallback
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

    const hasRealOutcome = typeof whatReallyHappened === 'string' && whatReallyHappened.trim().length > 5;
    const cleanRealOutcome = hasRealOutcome ? whatReallyHappened.trim() : '';

    let generatedPlan: ExperiencePlan | null = null;
    let storyAnalysis: StoryAnalysis | null = null;

    // Try Gemini if API key is present
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = getGeminiClient();
        const userPrompt = `
Transform this human situation into an ExperiencePlan for a 2D Vivi world in JSON:
User Story: "${prompt}"
${cleanRealOutcome ? `What Really Happened in Real Life: "${cleanRealOutcome}"` : 'What Really Happened in Real Life: [Not provided by author]'}
Genre Category: ${genre}
Author: ${author}

Design 1 grounded playable scene within the supported Vivi world templates and semantic slots.
Stage objects and people so the player can physically move, inspect, hesitate, and make a consequential choice.
If what really happened was not provided, set authorTruth.status to "withheld".
`;

        const requestGemini = async (extraInstruction?: string) => {
          const contents = extraInstruction
            ? `${userPrompt}\n\nATTENTION TO PREVIOUS VALIDATION ERRORS:\n${extraInstruction}`
            : userPrompt;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: {
              systemInstruction: EXPERIENCE_PLAN_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              temperature: 0.8,
            },
          });

          const responseText = response.text || '';
          const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          return JSON.parse(cleanJson);
        };

        // Attempt 1
        let parsed = await requestGemini();
        let planCandidate = parsed.plan || parsed;
        let validation = validateExperiencePlan(planCandidate);

        // Retry once if invalid
        if (!validation.valid) {
          console.warn('Initial ExperiencePlan failed validation:', validation.errors);
          const errorMsg = validation.errors.join('; ');
          parsed = await requestGemini(`Please fix the following schema errors: ${errorMsg}. Remember: NO raw coordinates (x/y), between 2-5 commitments, and valid semantic slots.`);
          planCandidate = parsed.plan || parsed;
          validation = validateExperiencePlan(planCandidate);
        }

        if (validation.valid) {
          generatedPlan = validation.plan;
          storyAnalysis = parsed.analysis || null;
          // Enforce zero truth fabrication
          if (!hasRealOutcome) {
            generatedPlan.authorTruth = { status: 'withheld' };
          } else {
            generatedPlan.authorTruth = {
              status: 'author_supplied',
              text: cleanRealOutcome,
              sourceLabel: 'со слов автора',
            };
          }
        }
      } catch (geminiErr: any) {
        console.warn('Gemini generation failed or timed out, using deterministic pipeline fallback:', geminiErr?.message);
      }
    }

    // Deterministic fallback if Gemini was skipped or failed validation
    if (!generatedPlan) {
      const fallbackResult = generateDeterministicExperiencePlan(prompt, cleanRealOutcome, genre, author);
      generatedPlan = fallbackResult.plan;
      storyAnalysis = fallbackResult.analysis;
    }

    const gameSpec = experiencePlanToGameSpec(generatedPlan, author, genre);
    const scenario = compileExperiencePlanToScenario(
      generatedPlan,
      storyAnalysis || {
        setting: generatedPlan.worldTemplate,
        people: ['Player'],
        emotionalCore: 'Hesitation',
        centralTension: prompt,
        pivotalMoment: 'Decision',
        importantObjects: ['decision center'],
        experienceGrammar: 'Move, inspect, commit',
        themeKey: genre,
      },
      author,
      responseToPostId
    );

    const playablePost: StoredPlayablePost = {
      schemaVersion: 2,
      id: scenario.id,
      title: scenario.title,
      author: scenario.author,
      authorHandle: scenario.authorHandle,
      synopsis: scenario.synopsis || scenario.hook || generatedPlan.synopsis,
      pillar: scenario.pillar,
      world: scenario.world,
      createdAt: Date.now(),
      scenario,
      analysis: storyAnalysis || undefined,
      experiencePlan: generatedPlan,
      legacyGameSpec: gameSpec,
      responseToPostId,
      themeKey: themeKey || genre,
      inspirationPrompt: inspirationPrompt || prompt,
    };

    res.json({
      success: true,
      gameSpec,
      experiencePlan: generatedPlan,
      scenario,
      analysis: storyAnalysis,
      playablePost,
      responseToPostId,
      themeKey: themeKey || genre,
      inspirationPrompt: inspirationPrompt || prompt,
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
