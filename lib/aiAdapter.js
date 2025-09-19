import { streamText as aiStreamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { GoogleGenAI } from "@google/genai";

/**
 * Text model factory for Vercel AI SDK
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 */
function makeTextModel(cfg) {
  const { provider, apiKey, model } = cfg;

  switch ((provider || "google").toLowerCase()) {
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(model);
    }
    case "groq": {
      const groq = createGroq({ apiKey });
      return groq(model);
    }
    default: {
      throw new Error(`Unsupported provider '${provider}' for text model`);
    }
  }
}

/**
 * Stream text in a shape compatible with Fauxmium's pipeline:
 * - yields chunks as { text: string }
 * - on completion yields a final { END: true, usageMetadata: { promptTokenCount, totalTokenCount } }
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 * @param {string} prompt
 */
export async function* streamText(cfg, prompt) {
  const model = makeTextModel(cfg);

  // Vercel AI SDK streaming
  const result = await aiStreamText({
    model,
    prompt,
  });

  // yield text chunks
  for await (const part of result.textStream) {
    // part is a string fragment
    yield { text: part };
  }

  // usage arrives once the stream resolves
  let usageMetadata = undefined;
  try {
    const usage = await result.usage; // { promptTokens, completionTokens, totalTokens } may vary by provider
    if (usage) {
      usageMetadata = {
        promptTokenCount: usage.promptTokens ?? 0,
        totalTokenCount:
          usage.totalTokens ??
          (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
      };
    }
  } catch {
    // some providers may not supply usage; leave undefined
  }

  // provide usage metadata as a final non-text chunk; END will be sent by processChunks
  if (usageMetadata) {
    yield { text: "", usageMetadata };
  }
}

/**
 * Generate an image.
 * Phase 1: Support Google (Gemini) using @google/genai (same as current behavior).
 * Other providers throw for now (can be extended later).
 * Returns: { mimeType: string, base64Data: string }
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 * @param {string} prompt
 */
export async function generateImage(cfg, prompt) {
  const { provider, apiKey, model } = cfg;

  if ((provider || "google").toLowerCase() !== "google") {
    throw new Error(
      `Image generation for provider '${provider}' is not yet supported`
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      personGeneration: "allow_adult",
      responseModalities: ["IMAGE"],
    },
  });

  if (!response.candidates?.length || !response.candidates[0].content) {
    throw new Error("No candidates in AI response");
  }

  const aiImageResponse = response.candidates[0].content.parts.find(
    (part) => "inlineData" in part
  );

  if (!aiImageResponse?.inlineData?.data) {
    throw new Error("No image data in AI response");
  }

  const base64Data = aiImageResponse.inlineData.data;
  const mimeType = aiImageResponse.inlineData.mimeType || "image/png";

  return { mimeType, base64Data };
}
