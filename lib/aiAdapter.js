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
 * Image model factory for Vercel AI SDK
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
 * Video model factory for Vercel AI SDK
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 */
export function makeVideoModel(cfg) {
  const { provider, apiKey, model } = cfg;

  switch ((provider || "google").toLowerCase()) {
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      // Correctly instantiate the VideoModelV3 using google.video()
      return google.video(model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(model);
    }
    default: {
      throw new Error(`Unsupported provider '${provider}' for video model`);
    }
  }
}

/**
 * Audio / Speech model factory
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 */
function makeSpeechModel(cfg) {
  const { provider, apiKey, model } = cfg;

  switch ((provider || "openai").toLowerCase()) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai.speech(model || "tts-1");
    }
    default: {
      throw new Error(`Unsupported provider '${provider}' for speech model`);
    }
  }
}

export async function* streamText(cfg, prompt) {
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
  });

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
  if (result.usage) {
    yield { text: "", usage: await result.usage };
  }
}

/**
 * Generate an image.
 * Central wrapper using Vercel AI SDK.
 * Returns: { mimeType: string, base64Data: string, usage: Object }
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 * @param {string} prompt
 */
export async function generateImage(cfg, prompt) {
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

  throw new Error("No valid image file found in Gemini multimodal response");
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
 * @param {{ provider: string, apiKey: string, model: string }} cfg
 * @param {string} prompt
 * @param {{ description?: string, type?: string, voice?: string, durationSeconds?: number }} [options]
 * @returns {Promise<{ mimeType: string, buffer: Buffer, usage: Object }>}
 */
export async function generateAudio(cfg, prompt, options = {}) {
  const provider = (cfg.provider || "synth").toLowerCase();

  if (cfg.verbose) {
    console.log(`\n--- [AUDIO GENERATION PROMPT: ${cfg.model || provider}] ---`);
    console.log(prompt);
    console.log(`--- [END OF AUDIO GENERATION PROMPT] ---\n`);
  }

  // 1. If OpenAI TTS is configured
  if (provider === "openai" && cfg.apiKey && (options.type === "speech" || !options.type)) {
    try {
      const speechModel = makeSpeechModel(cfg);
      const textToSpeak = options.description || prompt;
      const result = await aiGenerateSpeech({
        model: speechModel,
        text: textToSpeak,
        voice: options.voice || "alloy",
      });

      return {
        mimeType: result.audio.mediaType || "audio/mpeg",
        buffer: Buffer.from(result.audio.uint8Array),
        usage: { characters: textToSpeak.length },
      };
    } catch (err) {
      console.warn(`[audio] OpenAI TTS generation failed, falling back to procedural WAV synth:`, err.message);
    }
  }

  // 2. If Google Gemini audio generation is configured for speech
  if ((provider === "google" || provider === "gemini") && cfg.apiKey && options.type === "speech") {
    try {
      const google = createGoogleGenerativeAI({ apiKey: cfg.apiKey });
      const model = google(cfg.model || "gemini-2.5-flash");
      const result = await generateText({
        model,
        prompt: `Speak the following audio clip clearly: ${options.description || prompt}`,
        providerOptions: {
          google: {
            responseModalities: ["AUDIO"],
          },
        },
      });
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
      console.warn(`[audio] Gemini audio generation failed, falling back to procedural WAV synth:`, err.message);
    }
  }

  // 3. Procedural WAV synthesizer (zero cost, immediate, reliable)
  const synthResult = synthesizeWav({
    description: options.description || prompt,
    type: options.type,
    durationSeconds: options.durationSeconds,
  });

  return {
    mimeType: synthResult.mimeType,
    buffer: synthResult.buffer,
    usage: { durationSeconds: synthResult.buffer.length / 44100, characters: 0 },
  };
}
