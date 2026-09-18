import { streamText as aiStreamText, generateText, experimental_generateImage as aiGenerateImage, experimental_generateVideo as aiGenerateVideo } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";

/**
 * Provider client options. `baseURL` is optional and lets a provider be pointed
 * at a compatible gateway — or at a local test server, which is how the abort
 * path below is proven to reach the wire.
 * @param {{ apiKey: string, baseURL?: string }} cfg
 */
function providerOptions(cfg) {
  return cfg.baseURL ? { apiKey: cfg.apiKey, baseURL: cfg.baseURL } : { apiKey: cfg.apiKey };
}

/**
 * Text model factory for Vercel AI SDK
 * @param {{ provider: string, apiKey: string, model: string, baseURL?: string }} cfg
 */
function makeTextModel(cfg) {
  const { provider, apiKey, model } = cfg;

  switch ((provider || "google").toLowerCase()) {
    case "google": {
      const google = createGoogleGenerativeAI(providerOptions(cfg));
      return google(model);
    }
    case "openai": {
      const openai = createOpenAI(providerOptions(cfg));
      return openai(model);
    }
    case "anthropic": {
      const anthropic = createAnthropic(providerOptions(cfg));
      return anthropic(model);
    }
    case "groq": {
      const groq = createGroq(providerOptions(cfg));
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
      const google = createGoogleGenerativeAI(providerOptions(cfg));
      return google(model);
    }
    case "openai": {
      const openai = createOpenAI(providerOptions(cfg));
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
      const google = createGoogleGenerativeAI(providerOptions(cfg));
      return google.video(model);
    }
    case "openai": {
      const openai = createOpenAI(providerOptions(cfg));
      return openai(model);
    }
    default: {
      throw new Error(`Unsupported provider '${provider}' for text model`);
    }
  }
}

export async function* streamText(cfg, prompt, { abortSignal } = {}) {
  const model = makeTextModel(cfg);

  if (cfg.verbose) {
    console.log(`\n--- [LLM PROMPT: ${cfg.model}] ---`);
    console.log(prompt);
    console.log(`--- [END OF LLM PROMPT] ---\n`);
    console.log(`--- [STREAMING LLM RESPONSE] ---`);
  }

  // Vercel AI SDK streaming
  const result = await aiStreamText({
    model,
    prompt,
    // No signal used to mean a navigated-away page kept generating (and
    // billing) to completion; the caller now passes one it aborts on disconnect.
    abortSignal,
  });

  // The SDK's usage promise REJECTS when the request is aborted, and nothing
  // awaits it if the abort unwinds the stream first — an unhandled rejection,
  // which takes the process down. Attach a handler NOW; yield only a value that
  // actually resolved.
  const usagePromise = Promise.resolve(result.usage).catch(() => undefined);

  // yield text chunks
  for await (const part of result.textStream) {
    // part is a string fragment
    if (cfg.verbose) {
      process.stdout.write(part);
    }
    yield { text: part };
  }

  if (cfg.verbose) {
    console.log(`\n--- [END OF STREAMING LLM RESPONSE] ---\n`);
  }

  // provide usage metadata as a final non-text chunk; END will be sent by processChunks
  const usage = await usagePromise;
  if (usage) {
    yield { text: "", usage };
  }
}

/**
 * Generate an image.
 * Central wrapper using Vercel AI SDK.
 * Returns: { mimeType: string, base64Data: string }
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 * @param {string} prompt
 */
export async function generateImage(cfg, prompt, { abortSignal } = {}) {
  const { provider } = cfg;
  const providerLower = (provider || "google").toLowerCase();

  if (cfg.verbose) {
    console.log(`\n--- [IMAGE GENERATION PROMPT: ${cfg.model}] ---`);
    console.log(prompt);
    console.log(`--- [END OF IMAGE GENERATION PROMPT] ---\n`);
    console.log(`Generating image using ${cfg.model}...`);
  }

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
      abortSignal,
    });

    if (cfg.verbose) {
      console.log(`Successfully generated image using OpenAI.`);
    }

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
    abortSignal,
  });

  if (cfg.verbose) {
    console.log(`Successfully received text/multimodal response from Google.`);
  }

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
 * @param {{ image?: { imageBytes: string, mimeType: string }, abortSignal?: AbortSignal }} [options]
 */
export async function generateVideo(cfg, prompt, options = {}) {
  const { provider } = cfg;
  const { abortSignal } = options;

  if (cfg.verbose) {
    console.log(`\n--- [VIDEO GENERATION PROMPT: ${cfg.model}] ---`);
    console.log(prompt);
    if (options.image) {
      console.log(`Using cached poster image (${options.image.mimeType}) as video context.`);
    }
    console.log(`--- [END OF VIDEO GENERATION PROMPT] ---\n`);
    console.log(`Generating video using ${cfg.model}...`);
  }

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
    abortSignal,
  });

  if (cfg.verbose) {
    console.log(`Successfully generated video.`);
  }

  if (!result.video) {
    throw new Error("No video generated in AI response");
  }

  return {
    mimeType: result.video.mediaType,
    base64Data: result.video.base64,
  };
}
