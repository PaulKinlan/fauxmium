import {
  streamText as aiStreamText,
  generateText,
  experimental_generateImage as aiGenerateImage,
  experimental_generateVideo as aiGenerateVideo,
  experimental_generateSpeech as aiGenerateSpeech,
} from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { synthesizeWav } from "./audioSynth.js";

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
 * Image model factory for Vercel AI SDK
 * @param {{ provider: string, apiKey: string, model: string, baseURL?: string }} cfg
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
 * Video model factory for Vercel AI SDK
 * @param {{ provider: string, apiKey: string, model: string, baseURL?: string }} cfg
 */
export function makeVideoModel(cfg) {
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
      throw new Error(`Unsupported provider '${provider}' for video model`);
    }
  }
}

/**
 * Audio / Speech model factory
 * @param {{ provider: string, apiKey: string, model: string, baseURL?: string }} cfg
 */
function makeSpeechModel(cfg) {
  const { provider, apiKey, model } = cfg;

  switch ((provider || "openai").toLowerCase()) {
    case "openai": {
      const openai = createOpenAI(providerOptions(cfg));
      return openai.speech(model || "tts-1");
    }
    default: {
      throw new Error(`Unsupported provider '${provider}' for speech model`);
    }
  }
}

export async function* streamText(cfg, promptInput, { abortSignal } = {}) {
  const model = makeTextModel(cfg);

  let system = undefined;
  let prompt = undefined;
  let messages = undefined;

  if (typeof promptInput === "object" && promptInput !== null) {
    system = promptInput.system;
    if (Array.isArray(promptInput.messages)) {
      messages = promptInput.messages;
    } else {
      prompt = promptInput.prompt;
    }
  } else {
    prompt = String(promptInput || "");
  }

  if (cfg.verbose) {
    console.log(`\n--- [LLM PROMPT: ${cfg.model}] ---`);
    if (system) {
      console.log(`[SYSTEM PROMPT]:\n${system}\n`);
    }
    if (messages) {
      console.log(`[CONVERSATION THREAD (${messages.length} messages)]:`);
      for (const m of messages) {
        console.log(`[${m.role.toUpperCase()}]: ${m.content.slice(0, 300)}...`);
      }
    } else {
      console.log(prompt);
    }
    console.log(`--- [END OF LLM PROMPT] ---\n`);
    console.log(`--- [STREAMING LLM RESPONSE] ---`);
  }

  // Vercel AI SDK streaming configuration
  const aiOptions = {
    model,
    abortSignal,
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
    },
  };

  if (system) {
    aiOptions.system = system;
  }

  if (messages) {
    aiOptions.messages = messages;
  } else {
    aiOptions.prompt = prompt;
  }

  const result = aiStreamText(aiOptions);

  // The SDK's usage promise REJECTS when the request is aborted, and nothing
  // awaits it if the abort unwinds the stream first — an unhandled rejection,
  // which takes the process down. Attach a handler NOW; yield only a value that
  // actually resolved.
  const usagePromise = Promise.resolve(result.usage).catch(() => undefined);
  const metadataPromise = Promise.resolve(result.providerMetadata).catch(() => undefined);

  // yield text chunks
  for await (const part of result.textStream) {
    if (cfg.verbose) {
      process.stdout.write(part);
    }
    yield { text: part };
  }

  if (cfg.verbose) {
    console.log(`\n--- [END OF STREAMING LLM RESPONSE] ---\n`);
  }

  // provide usage metadata as a final non-text chunk; END will be sent by processChunks
  const rawUsage = await usagePromise;
  if (rawUsage) {
    const providerMetadata = await metadataPromise;
    const cachedInputTokens =
      rawUsage?.cachedInputTokens ??
      rawUsage?.promptTokensDetails?.cachedTokens ??
      providerMetadata?.google?.usageMetadata?.cachedContentTokenCount ??
      providerMetadata?.openai?.cachedPromptTokens ??
      providerMetadata?.anthropic?.cacheReadInputTokens ??
      0;

    yield {
      text: "",
      usage: {
        ...rawUsage,
        cachedInputTokens,
      },
    };
  }
}

/**
 * Generate an image.
 * Central wrapper using Vercel AI SDK.
 * Returns: { mimeType: string, base64Data: string, usage: Object }
 * @param {{ provider: string, apiKey: string, model: string, baseURL?: string }} cfg
 * @param {string} prompt
 * @param {{ abortSignal?: AbortSignal }} [options]
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
      usage: result.usage || { images: 1 },
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

  let files = result.files;
  let usage = result.usage;

  if (!files || files.length === 0) {
    if (cfg.verbose) {
      console.log(`No files returned in initial Gemini response. Retrying with stylized vector illustration prompt...`);
    }
    const stylizedPrompt = `Create a stylized flat vector illustration or artistic avatar portrait representing: ${prompt}. Clean lines, stylized digital art, no photorealism.`;
    const retryResult = await generateText({
      model,
      prompt: stylizedPrompt,
      n: 1,
      size: "1024x1024",
      abortSignal,
    });
    files = retryResult.files;
    usage = retryResult.usage;
  }

  if (files == null || files.length === 0) {
    throw new Error("No files in AI response");
  }

  for (const file of files) {
    if (file.mediaType.startsWith("image/")) {
      return {
        mimeType: file.mediaType,
        base64Data: file.base64,
        usage,
      };
    }
  }

  throw new Error("No valid image file found in Gemini multimodal response");
}

/**
 * Generate a video.
 * Centralized wrapper using Vercel AI SDK's experimental_generateVideo.
 * Returns: { mimeType: string, base64Data: string }
 * @param {{ provider: string, apiKey: string, model: string, baseURL?: string }} cfg
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
      `Video generation for provider '${provider}' is not supported yet`
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
    mimeType: result.video.mediaType || "video/mp4",
    base64Data: result.video.base64,
  };
}

/**
 * Generate audio (TTS speech or procedural WAV synthesizer)
 * @param {{ provider: string, apiKey: string, model: string, baseURL?: string }} cfg
 * @param {string} prompt
 * @param {{ description?: string, type?: string, voice?: string, durationSeconds?: number, abortSignal?: AbortSignal }} [options]
 * @returns {Promise<{ mimeType: string, buffer: Buffer, usage: Object }>}
 */
export async function generateAudio(cfg, prompt, options = {}) {
  const provider = (cfg.provider || "synth").toLowerCase();
  const { abortSignal } = options;

  if (cfg.verbose) {
    console.log(`\n--- [AUDIO GENERATION PROMPT: ${cfg.model || provider}] ---`);
    console.log(prompt);
    console.log(`--- [END OF AUDIO GENERATION PROMPT] ---\n`);
  }

  // 1. If OpenAI TTS is configured
  if (provider === "openai" && cfg.apiKey && (options.type === "speech" || options.transcript || !options.type)) {
    try {
      const speechModel = makeSpeechModel(cfg);
      const textToSpeak = options.transcript || options.description || prompt;
      const result = await aiGenerateSpeech({
        model: speechModel,
        text: textToSpeak,
        voice: options.voice || "alloy",
        abortSignal,
      });

      return {
        mimeType: result.audio.mediaType || "audio/mpeg",
        buffer: Buffer.from(result.audio.uint8Array),
        usage: { characters: textToSpeak.length },
      };
    } catch (err) {
      if (abortSignal?.aborted || err?.name === "AbortError") throw err;
      console.warn(`[audio] OpenAI TTS generation failed, falling back to procedural WAV synth:`, err.message);
    }
  }

  // 2. If Google Gemini audio generation is configured
  if ((provider === "google" || provider === "gemini") && cfg.apiKey) {
    try {
      const google = createGoogleGenerativeAI(providerOptions(cfg));
      const modelName = cfg.model || "gemini-3.8-flash-tts";
      const model = google(modelName);
      const textToSpeak = options.transcript || options.description || prompt;

      const generateOptions = {
        model,
        prompt: modelName.includes("tts")
          ? textToSpeak
          : `Speak the following audio clip clearly: ${textToSpeak}`,
        abortSignal,
      };
      if (!modelName.includes("tts")) {
        generateOptions.providerOptions = {
          google: {
            responseModalities: ["AUDIO"],
          },
        };
      }

      const result = await generateText(generateOptions);
      if (result.files) {
        for (const file of result.files) {
          if (file.mediaType?.startsWith("audio/")) {
            return {
              mimeType: file.mediaType,
              buffer: Buffer.from(file.base64, "base64"),
              usage: result.usage || { durationSeconds: 4 },
            };
          }
        }
      }
    } catch (err) {
      if (abortSignal?.aborted || err?.name === "AbortError") throw err;
      console.warn(`[audio] Gemini audio generation failed, falling back to procedural WAV synth:`, err.message);
    }
  }

  // 3. Procedural WAV synthesizer (zero cost, immediate, reliable)
  const synthResult = synthesizeWav({
    description: options.transcript || options.description || prompt,
    type: options.type || (options.transcript ? "speech" : undefined),
    durationSeconds: options.durationSeconds,
  });

  return {
    mimeType: synthResult.mimeType,
    buffer: synthResult.buffer,
    usage: { durationSeconds: synthResult.buffer.length / 44100, characters: 0 },
  };
}
