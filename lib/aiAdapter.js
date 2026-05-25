import { streamText as aiStreamText, generateText, experimental_generateImage as aiGenerateImage, experimental_generateVideo as aiGenerateVideo } from "ai";
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
      return openai.image(model);
    }
    default: {
      throw new Error(`Unsupported provider '${provider}' for image model`);
    }
  }
}

/**
 * Text model factory for Vercel AI SDK
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 */
function makeVideoModel(cfg) {
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
 * Central wrapper using Vercel AI SDK.
 * Returns: { mimeType: string, base64Data: string }
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 * @param {string} prompt
 */
export async function generateImage(cfg, prompt) {
  const { provider } = cfg;
  const providerLower = (provider || "google").toLowerCase();

  if (providerLower !== "google" && providerLower !== "openai") {
    throw new Error(
      `Image generation for provider '${provider}' is not yet supported`
    );
  }

  const model = makeImageModel(cfg);

  if (providerLower === "openai") {
    const result = await aiGenerateImage({
      model,
      prompt,
      size: "1024x1024",
    });

    return {
      mimeType: "image/png",
      base64Data: result.image.base64,
      usage: result.usage,
    };
  }

  // Google (Gemini) multimodal text-inline generation
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

/**
 * Generate a video.
 * Centralized wrapper using Vercel AI SDK's experimental_generateVideo.
 * Returns: { mimeType: string, base64Data: string }
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 * @param {string} prompt
 * @param {{ image?: { imageBytes: string, mimeType: string } }} [options]
 */
export async function generateVideo(cfg, prompt, options = {}) {
  const { provider } = cfg;
  if ((provider || "google").toLowerCase() !== "google") {
    throw new Error(
      `Video generation for provider '${provider}' is not yet supported`
    );
  }

  const model = makeVideoModel(cfg);

  const promptArg = options.image
    ? {
        text: prompt,
        image: `data:${options.image.mimeType};base64,${options.image.imageBytes}`,
      }
    : prompt;

  const result = await aiGenerateVideo({
    model,
    prompt: promptArg,
  });

  if (!result.video) {
    throw new Error("No video generated in AI response");
  }

  return {
    mimeType: result.video.mediaType,
    base64Data: result.video.base64,
  };
}
