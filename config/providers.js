import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsConfigPath = path.join(__dirname, "models.json");
const modelsConfig = JSON.parse(fs.readFileSync(modelsConfigPath, "utf8"));

export const PROVIDERS = modelsConfig.providers;
export const MODEL_ALIASES = modelsConfig.modelAliases || {};
export const FALLBACK_PRICING = modelsConfig.fallbackPricing || {};
export const BROWSING_LENSES = modelsConfig.lenses || {};

// Default fallback providers
export const DEFAULT_TEXT_PROVIDER = modelsConfig.defaults?.textProvider || "gemini";
export const DEFAULT_IMAGE_PROVIDER = modelsConfig.defaults?.imageProvider || "gemini";
export const DEFAULT_VIDEO_PROVIDER = modelsConfig.defaults?.videoProvider || "gemini";
export const DEFAULT_AUDIO_PROVIDER = modelsConfig.defaults?.audioProvider || "synth";

/**
 * Resolve any model alias to its canonical name
 * @param {string} model
 * @returns {string}
 */
export function resolveModelAlias(model) {
  if (!model) return model;
  return MODEL_ALIASES[model] || model;
}

/**
 * Get provider config by name (handles aliases)
 * @param {string} name
 * @returns {Object|null}
 */
export function getProviderConfig(name) {
  const key = (name || "").toLowerCase();

  for (const [providerKey, config] of Object.entries(PROVIDERS)) {
    if (config.aliases.includes(key)) {
      return { key: providerKey, ...config };
    }
  }

  return null;
}

/**
 * Get all providers that support a specific feature (returns all aliases)
 * @param {string} feature ('text' | 'image' | 'video' | 'audio')
 * @returns {string[]}
 */
export function getProvidersWithFeature(feature) {
  const providers = [];
  for (const [key, config] of Object.entries(PROVIDERS)) {
    if (config[feature]?.supported) {
      providers.push(...config.aliases);
    }
  }
  return providers;
}
