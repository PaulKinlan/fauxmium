import { streamText as aiStreamText, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";

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
 * Text model factory for Vercel AI SDK
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 */
function makeImageModel(cfg) {
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
    default: {
      throw new Error(`Unsupported provider '${provider}' for text model`);
    }
  }
}

/**
 * Stream text in a shape compatible with Fauxmium's pipeline:
 * - yields chunks as { text: string }
 * - on completion yields a final { END: true, usage: { promptTokenCount, totalTokenCount } }
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

  // provide usage metadata as a final non-text chunk; END will be sent by processChunks
  if (result.usage) {
    yield { text: "", usage: await result.usage };
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
  const { provider } = cfg;
  if ((provider || "google").toLowerCase() !== "google") {
    throw new Error(
      `Image generation for provider '${provider}' is not yet supported`
    );
  }

  const model = makeImageModel(cfg);

  // AI SDK says generateText and look at .files.
  const result = await generateText({
    model,
    prompt,
    n: 1,
    size: "1024x1024",
  });

  if (result.files == null || result.files.length === 0) {
    throw new Error("No files in AI response");
  }

  for (const file of result.files) {
    if (file.mediaType.startsWith("image/")) {
      return {
        mimeType: file.mediaType,
        base64Data: file.base64,
        usage: result.usage,
      };
    }
  }
}
