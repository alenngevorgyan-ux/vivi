import { GoogleGenAI } from '@google/genai';
import type { ExperienceSemanticProvider, SemanticReply } from '../engine/compiler/provider.ts';
import { MODEL_SYSTEM_PROMPT, modelRepairPrompt, modelUserPrompt } from '../engine/compiler/modelContract.ts';

/**
 * Gemini as one interchangeable semantic provider. Server-only: the client
 * bundle never imports a model SDK.
 */
export function createGeminiProvider(apiKey: string, model = 'gemini-2.5-flash'): ExperienceSemanticProvider {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

  const call = async (contents: string): Promise<SemanticReply> => {
    const started = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: MODEL_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.6,
        maxOutputTokens: 1400,
      },
    });
    const meta = response.usageMetadata;
    return {
      text: response.text ?? '',
      model,
      usage: meta
        ? {
            inputTokens: meta.promptTokenCount,
            outputTokens: meta.candidatesTokenCount,
            totalTokens: meta.totalTokenCount,
            reasoningTokens: meta.thoughtsTokenCount,
            latencyMs: Date.now() - started,
          }
        : { latencyMs: Date.now() - started },
    };
  };

  return {
    id: `gemini:${model}`,
    compileStory: request => call(modelUserPrompt(request.story, request.hints)),
    repair: (_request, invalidJson, errors) => call(modelRepairPrompt(invalidJson, errors)),
  };
}
