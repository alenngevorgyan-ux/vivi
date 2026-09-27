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
You are the story compiler for VIVI, a platform where real human situations become tiny playable 2D worlds that people enter and explore physically.
Convert the contributor's story into a clean GameSpec JSON that compiles into the canonical Vivi diorama engine.

World Templates available:
- 'apartment_night': intimate domestic tension, night, phone on table, bathroom door, sofa.
- 'office_night': startup/work confrontation, presentation screen, laptop, director desk.
- 'hallway_night': eerie corridor, apartment door, intercom, elevator.
- 'neighborhood_sunset': nostalgic or honest walk, park bench, street, bus stop.
- 'bar_or_party': social dilemma, crowd, tables, bar, exit.
- 'train_station': parting, last train, departures board, platform edge.
- 'city_rain': rain, street, parked car, crossing.
- 'family_home': dining table with archives, stairs, photos.
- 'hotel_or_rental': mysterious rental, table with photo, balcony.
- 'bedroom_night': quiet bedroom, nightstand, lit phone.

Semantic Slots to use for actions & cues:
'phone_table', 'bathroom_door', 'sofa', 'presentation_screen', 'player_laptop', 'director', 'intercom', 'elevator', 'front_door', 'bench', 'bus_stop', 'station_board', 'platform_edge', 'dining_table', 'decision_center'.

GameSpec Output JSON format:
{
  "id": "gen_...",
  "title": "...",
  "author": "...",
  "synopsis": "...",
  "description": "...",
  "genre": "...",
  "tags": ["..."],
  "estimatedPlaytime": "3 min",
  "whatReallyHappened": "...",
  "startNodeId": "node_start",
  "nodes": {
    "node_start": {
      "id": "node_start",
      "title": "The Situation",
      "narrative": "...",
      "worldConfig": {
        "template": "apartment_night" | "office_night" | "hallway_night" | "neighborhood_sunset" | "bar_or_party" | "train_station"
      },
      "choices": [
        { "id": "c1", "text": "Action 1 description", "nextNodeId": "node_end_1" },
        { "id": "c2", "text": "Action 2 description", "nextNodeId": "node_end_2" },
        { "id": "c3", "text": "Action 3 description", "nextNodeId": "node_end_3" }
      ]
    },
    "node_end_1": {
      "id": "node_end_1",
      "title": "Outcome 1",
      "isEnding": true,
      "endingSummary": "What happens immediately after choosing action 1..."
    },
    "node_end_2": {
      "id": "node_end_2",
      "title": "Outcome 2",
      "isEnding": true,
      "endingSummary": "What happens immediately after choosing action 2..."
    },
    "node_end_3": {
      "id": "node_end_3",
      "title": "Outcome 3",
      "isEnding": true,
      "endingSummary": "What happens immediately after choosing action 3..."
    }
  }
}
Respond ONLY with clean valid JSON.
`;

function generateLocalViviStory(prompt: string, whatReallyHappened: string, genre: string, author: string) {
  const p = prompt.toLowerCase();
  let template = 'apartment_night';
  let title = 'A Moment in Time';

  if (p.includes('work') || p.includes('meeting') || p.includes('office') || p.includes('boss') || p.includes('slide')) {
    template = 'office_night';
    title = 'The Decision at Work';
  } else if (p.includes('door') || p.includes('night') || p.includes('intercom') || p.includes('hallway') || p.includes('sound')) {
    template = 'hallway_night';
    title = 'Footsteps in the Hall';
  } else if (p.includes('friend') || p.includes('walk') || p.includes('bus') || p.includes('goodbye')) {
    template = 'neighborhood_sunset';
    title = 'The Walk Back';
  } else if (p.includes('party') || p.includes('bar') || p.includes('secret') || p.includes('crowd')) {
    template = 'bar_or_party';
    title = 'The Confession';
  } else if (p.includes('train') || p.includes('station') || p.includes('late')) {
    template = 'train_station';
    title = 'The Last Service';
  }

  const firstSentence = prompt.split('.')[0] || prompt;
  if (firstSentence.length > 5 && firstSentence.length < 40) {
    title = firstSentence;
  }

  const id = 'gen_' + Date.now();
  return {
    id,
    title,
    author: author || 'Community Contributor',
    synopsis: prompt.length > 120 ? prompt.slice(0, 117) + '…' : prompt,
    description: prompt,
    genre: genre || 'Human Situations',
    tags: [genre || 'Real', 'Interactive'],
    estimatedPlaytime: '3 min',
    whatReallyHappened: whatReallyHappened || 'The author shared this moment so other people could experience the pressure before learning what happened.',
    startNodeId: 'node_start',
    nodes: {
      node_start: {
        id: 'node_start',
        title: 'The Situation',
        narrative: prompt,
        worldConfig: {
          template,
        },
        choices: [
          {
            id: 'c1',
            text: 'Confront the situation directly',
            nextNodeId: 'node_end_1',
          },
          {
            id: 'c2',
            text: 'Wait and observe for a moment longer',
            nextNodeId: 'node_end_2',
          },
          {
            id: 'c3',
            text: 'Step away and protect yourself',
            nextNodeId: 'node_end_3',
          },
        ],
      },
      node_end_1: {
        id: 'node_end_1',
        title: 'Direct confrontation',
        isEnding: true,
        endingSummary: 'You speak before hesitation can stop you. The room shifts to look at you, and the reality of the moment takes shape.',
      },
      node_end_2: {
        id: 'node_end_2',
        title: 'Observation',
        isEnding: true,
        endingSummary: 'You choose silence for another minute. You gather more details, but the window to act begins to narrow.',
      },
      node_end_3: {
        id: 'node_end_3',
        title: 'Stepping away',
        isEnding: true,
        endingSummary: 'You step back. The unanswered question remains, but your boundaries are intact.',
      },
    },
  };
}

// API: Generate GameSpec using Gemini or Local Fallback
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

    // Try Gemini if API key is present
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = getGeminiClient();
        const userPrompt = `
Transform this human situation into a tiny playable 2D Vivi world in JSON:
User Story: "${prompt}"
${whatReallyHappened ? `What Really Happened in Real Life: "${whatReallyHappened}"` : ''}
Genre Category: ${genre}
Author: ${author}

Design 1 grounded playable scene within the supported Vivi world templates and semantic slots.
Stage objects and people so the player can move, inspect, hesitate and make a consequential choice.
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
        const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedSpec = JSON.parse(cleanJson);

        if (!parsedSpec.id) parsedSpec.id = 'gen_' + Date.now();
        if (!parsedSpec.author) parsedSpec.author = author;
        if (!parsedSpec.whatReallyHappened) parsedSpec.whatReallyHappened = whatReallyHappened;

        return res.json({ success: true, gameSpec: parsedSpec });
      } catch (geminiErr: any) {
        console.warn('Gemini generation failed, using local compiler fallback:', geminiErr?.message);
      }
    }

    // High quality deterministic fallback
    const fallbackSpec = generateLocalViviStory(prompt, whatReallyHappened, genre, author);
    res.json({ success: true, gameSpec: fallbackSpec });
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
