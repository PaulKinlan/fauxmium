/**
 * Provider utility functions
 */

import { getProviderConfig, DEFAULT_AUDIO_PROVIDER } from "../config/providers.js";

/**
 * Normalize provider name to internal key (handles aliases)
 */
export function normalizeProvider(providerName) {
  const config = getProviderConfig(providerName);
  return config?.normalizedName || providerName;
}

/**
 * Resolve API key from environment or explicit flag
 */
export function resolveApiKey(provider) {
  const config = getProviderConfig(provider);

  if (!config?.envKeys || config.envKeys.length === 0) {
    return undefined;
  }

  // Try each environment variable in order
  for (const envKey of config.envKeys) {
    const value = process.env[envKey];
    if (value) {
      return value;
    }
  }

  return undefined;
}

/**
 * Validate required API keys gracefully
 */
export function validateApiKeys(providers, argv) {
  const { text, image, video, audio } = providers;

  const textApiKey = argv["api-key"] || resolveApiKey(text);
  const imageApiKey = argv["image-api-key"] || resolveApiKey(image);
  const videoApiKey = argv["video-api-key"] || resolveApiKey(video);
  const audioApiKey = argv["audio-api-key"] || resolveApiKey(audio);

  if (!textApiKey) {
    console.error(
      `[error] No API key found for text provider '${text}'. Set via --api-key or environment variable.`
    );
    process.exit(1);
  }

  if (argv.images !== false && image !== "synth" && !imageApiKey) {
    console.warn(
      `[warn] No API key found for image provider '${image}'. Image requests will render styled fallback placeholders.`
    );
  }

  if (argv.video !== false && video !== "synth" && !videoApiKey) {
    console.warn(
      `[warn] No API key found for video provider '${video}'. Video requests will render fallback media.`
    );
  }

  if (argv.audio !== false && audio !== "synth" && !audioApiKey) {
    console.warn(
      `[warn] No API key found for audio provider '${audio}'. Audio requests will gracefully use procedural WAV synthesizer.`
    );
  }

  return { textApiKey, imageApiKey, videoApiKey, audioApiKey };
}

/**
 * Get provider defaults for text, image, video, and audio based on text provider
 */
export function getProviderDefaults(textProviderName) {
  const textConfig = getProviderConfig(textProviderName) || getProviderConfig("gemini");
  const geminiConfig = getProviderConfig("gemini");
  const synthConfig = getProviderConfig("synth");

  return {
    text: {
      provider: textConfig.normalizedName,
      defaultModel: textConfig.text?.defaultModel || "gemini-3.5-flash",
      choices: textConfig.text?.choices || [],
    },
    image: textConfig.image?.supported
      ? {
          provider: textConfig.key,
          defaultModel: textConfig.image.defaultModel,
          choices: textConfig.image.choices,
        }
      : {
          provider: geminiConfig.key,
          defaultModel: geminiConfig.image?.defaultModel,
          choices: geminiConfig.image?.choices,
        },
    video: textConfig.video?.supported
      ? {
          provider: textConfig.key,
          defaultModel: textConfig.video.defaultModel,
          choices: textConfig.video.choices,
        }
      : {
          provider: geminiConfig.key,
          defaultModel: geminiConfig.video?.defaultModel,
          choices: geminiConfig.video?.choices,
        },
    audio: textConfig.audio?.supported
      ? {
          provider: textConfig.key,
          defaultModel: textConfig.audio.defaultModel,
          choices: textConfig.audio.choices,
        }
      : {
          provider: DEFAULT_AUDIO_PROVIDER || "synth",
          defaultModel: synthConfig?.audio?.defaultModel || "synth-wav",
          choices: synthConfig?.audio?.choices || ["synth-wav"],
        },
  };
}
