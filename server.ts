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

// System instruction for Story Generator
const STORY_GENERATOR_SYSTEM_INSTRUCTION = `
You are the story compiler for VIVI, a platform where human situations become tiny playable 2D worlds that people explore physically.
Your task is to convert human stories into a complete, playable GameSpec JSON.

A story may involve betrayal, a plausible creepy event, social disaster, work and power, money, family secrets, a moral dilemma, romance, a turning point, or a quiet memory. Preserve the contributor's facts and uncertainty. Do not turn every story into nostalgia or fantasy. All romantic or relationship characters must be adults.
The feed synopsis must reveal the setup and stakes but never the truth, outcome or morally preferred choice. Use concise, contemporary human language. Do not invent a real-life outcome if one was not supplied: leave whatReallyHappened empty for author review. Make choices distinct physical actions, including a plausible option to wait, leave or ask someone. The player should be able to inspect the environment before committing.
Every scene must include a 2D 'worldConfig' so the player can physically walk around, approach interactive memory objects (benches, bicycles, laptops, coffee cups, photos), meet an NPC (friend, co-founder, partner), converse, and then make a pivotal choice.

World Templates available:
- 'village_sunset': peaceful countryside, childhood neighborhood, suburban street at sunset.
- 'office_night': quiet startup office, empty desks, glowing monitors, panoramic night city windows.
- 'city_evening': rain-soaked streets, bus stops, canal bridges, streetlights at dusk.
- 'bedroom_night': warm cozy room, wooden floor, soft lighting, quiet introspective memories.

GameSpec Structure:
{
  "id": "...",
  "title": "...",
  "author": "...",
  "synopsis": "...",
  "description": "...",
  "genre": "Воспоминания" | "Отношения" | "Что бы ты сделал?" | "Странные истории" | "Сны" | "Работа" | "Стартапы" | "Семья" | "Дружба" | "Исповеди",
  "tags": ["..."],
  "coverImage": "...",
  "estimatedPlaytime": "3-5 мин",
  "difficulty": "Casual",
  "whatReallyHappened": "The author's authentic reflection on what actually happened in real life.",
  "startNodeId": "node_start",
  "nodes": {
    "node_start": {
      "id": "node_start",
      "title": "...",
      "chapter": "...",
      "narrative": "...",
      "worldConfig": {
        "id": "world_1",
        "template": "village_sunset" | "office_night" | "city_evening" | "bedroom_night",
        "title": "...",
        "timeOfDay": "sunset" | "night" | "dusk",
        "width": 1000,
        "height": 600,
        "playerSpawn": { "x": 160, "y": 380 },
        "playerAppearance": { "preset": "boy_01" | "girl_01" | "man_01" | "woman_01", "clothingColor": "#f59e0b" },
        "npcs": [
          {
            "id": "npc_1",
            "name": "...",
            "appearance": { "preset": "boy_01" | "girl_01" | "man_01" | "woman_01", "clothingColor": "#2563eb" },
            "x": 780,
            "y": 360,
            "interactionRadius": 85,
            "dialogue": [
              { "speaker": "...", "text": "..." },
              { "speaker": "...", "text": "..." }
            ],
            "leadsToChoice": true
          }
        ],
        "objects": [
          {
            "id": "obj_1",
            "type": "bench" | "tree" | "streetlight" | "bicycle" | "desk" | "laptop" | "whiteboard" | "coffee_cup" | "bus_stop" | "cat",
            "name": "...",
            "x": 380,
            "y": 360,
            "interactive": true,
            "interactionPrompt": "Вспомнить" | "Осмотреть",
            "memoryText": "Sensory discovery memory revealed when inspected..."
          },
          {
            "id": "obj_2",
            "type": "bicycle" | "tree" | "coffee_cup" | "whiteboard",
            "name": "...",
            "x": 580,
            "y": 380,
            "interactive": true,
            "interactionPrompt": "Вспомнить",
            "memoryText": "..."
          }
        ]
      },
      "choices": [
        { "id": "c1", "text": "...", "nextNodeId": "node_ending_1" },
        { "id": "c2", "text": "...", "nextNodeId": "node_ending_2" },
        { "id": "c3", "text": "...", "nextNodeId": "node_ending_3" }
      ]
    },
    "node_ending_1": {
      "id": "node_ending_1",
      "title": "...",
      "isEnding": true,
      "endingType": "victory",
      "endingTitle": "...",
      "endingSummary": "..."
    },
    "node_ending_2": {
      "id": "node_ending_2",
      "title": "...",
      "isEnding": true,
      "endingType": "neutral",
      "endingTitle": "...",
      "endingSummary": "..."
    }
  }
}

Respond ONLY with clean valid JSON.
`;

// API: Generate GameSpec using Gemini
app.post('/api/generate-story', async (req, res) => {
  try {
    const {
      prompt,
      whatReallyHappened = '',
      genre = 'Situations',
      author = 'Anonymous',
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'A story description is required.' });
    }

    const ai = getGeminiClient();

    const userPrompt = `
Transform this human situation into a tiny playable 2D Vivi world in JSON:
User Story: "${prompt}"
${whatReallyHappened ? `What Really Happened in Real Life: "${whatReallyHappened}"` : ''}
Genre Category: ${genre}
Author: ${author}

Design 1-2 grounded playable scenes within the supported legacy world templates. Stage objects and people so the player can move, inspect, hesitate and then make a consequential physical choice. Use a phone, door, clock, window, laptop or arrival cue when relevant. Keep the synopsis spoiler-free. If no real-life outcome was provided, leave it blank for author review.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: STORY_GENERATOR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.85,
      },
    });

    const responseText = response.text || '';
    let parsedSpec;
    try {
      parsedSpec = JSON.parse(responseText.trim());
    } catch (parseErr) {
      // If wrapped in markdown blocks
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedSpec = JSON.parse(cleanJson);
    }

    // Assign standard fields if missing
    if (!parsedSpec.id) {
      parsedSpec.id = 'gen_' + Date.now();
    }
    if (!parsedSpec.author) {
      parsedSpec.author = author;
    }
    if (!parsedSpec.createdAt) {
      parsedSpec.createdAt = new Date().toISOString();
    }
    if (!parsedSpec.updatedAt) {
      parsedSpec.updatedAt = new Date().toISOString();
    }
    if (!parsedSpec.metrics) {
      parsedSpec.metrics = { plays: 1, likes: 0, rating: 5.0, completions: 0 };
    }
    if (!parsedSpec.coverImage) {
      parsedSpec.coverImage = '';
    }

    if (!whatReallyHappened) parsedSpec.whatReallyHappened = '';
    res.json({ success: true, gameSpec: parsedSpec });
  } catch (error: any) {
    console.error('Error generating story:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate story with AI. Please check server logs or API key.',
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
