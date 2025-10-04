/**
 * Provider utility functions
 */

import { getProviderConfig } from "../config/providers.js";

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

  if (!config?.envKeys) {
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
 * Validate required API keys and exit if missing
 */
export function validateApiKeys(providers, argv) {
  const { text, image, video } = providers;

  const textApiKey = argv["api-key"] || resolveApiKey(text);
  const imageApiKey = argv["image-api-key"] || resolveApiKey(image);
  const videoApiKey = argv["video-api-key"] || resolveApiKey(video);

  if (!textApiKey) {
    console.warn(
      `No API key found for text provider '${text}'. Set via --api-key or environment variable.`
    );
    process.exit(1);
  }

  if (!imageApiKey) {
    console.warn(
      `No API key found for image provider '${image}'. Set via --image-api-key or environment variable.`
    );
    process.exit(1);
  }

  if (!videoApiKey) {
    console.warn(
      `No API key found for video provider '${video}'. Set via --video-api-key or environment variable.`
    );
    process.exit(1);
  }

  return { textApiKey, imageApiKey, videoApiKey };
}

/**
 * Get provider defaults for image/video based on text provider
 */
export function getProviderDefaults(textProviderName) {
  const textConfig = getProviderConfig(textProviderName);
  const geminiConfig = getProviderConfig("gemini");

  return {
    text: {
      provider: textConfig.normalizedName,
      defaultModel: textConfig.text.defaultModel,
      choices: textConfig.text.choices,
    },
    image: textConfig.image.supported
      ? {
          provider: textConfig.key,
          defaultModel: textConfig.image.defaultModel,
          choices: textConfig.image.choices,
        }
      : {
          provider: geminiConfig.key,
          defaultModel: geminiConfig.image.defaultModel,
          choices: geminiConfig.image.choices,
        },
    video: textConfig.video.supported
      ? {
          provider: textConfig.key,
          defaultModel: textConfig.video.defaultModel,
          choices: textConfig.video.choices,
        }
      : {
          provider: geminiConfig.key,
          defaultModel: geminiConfig.video.defaultModel,
          choices: geminiConfig.video.choices,
        },
  };
}
