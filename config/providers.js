import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsConfigPath = path.join(__dirname, "models.json");
const modelsConfig = JSON.parse(fs.readFileSync(modelsConfigPath, "utf8"));

// Optional user plugin configuration overlay
const userPluginPaths = [
  process.env.FAUXMIUM_MODELS_PATH,
  path.resolve("fauxmium.models.json"),
  path.join(os.homedir(), ".fauxmium", "models.json"),
].filter(Boolean);

for (const p of userPluginPaths) {
  try {
    if (fs.existsSync(p)) {
      const userConfig = JSON.parse(fs.readFileSync(p, "utf8"));
      if (userConfig.providers) Object.assign(modelsConfig.providers, userConfig.providers);
      if (userConfig.modelAliases) Object.assign(modelsConfig.modelAliases, userConfig.modelAliases);
      if (userConfig.fallbackPricing) Object.assign(modelsConfig.fallbackPricing, userConfig.fallbackPricing);
      if (userConfig.lenses) Object.assign(modelsConfig.lenses, userConfig.lenses);
      break;
    }
  } catch (err) {
    console.warn(`[config] Failed to load user models config at ${p}:`, err.message);
  }
}

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
 * Resolve provider baseURL from explicit argument, environment variables, or config
 * @param {string} providerName
 * @param {string} [explicitBaseUrl]
 * @returns {string|undefined}
 */
export function resolveProviderBaseUrl(providerName, explicitBaseUrl) {
  if (explicitBaseUrl) return explicitBaseUrl;
  const config = getProviderConfig(providerName);
  if (!config) return undefined;

  if (Array.isArray(config.baseUrlEnv)) {
    for (const envKey of config.baseUrlEnv) {
      if (process.env[envKey]) {
        return process.env[envKey];
      }
    }
  }

  return config.baseURL || undefined;
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

