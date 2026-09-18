/**
 * Centralized provider configuration
 * Each provider defines its models, defaults, and API key mapping.
 *
 * Model ids re-verified against first-party provider documentation on
 * 2026-09-18. NOTE: yargs ENFORCES these lists (cli/options.js passes them as
 * `choices` for --model / --image-model / --video-model), so this file is the
 * allowlist a user can actually select from — a model missing here is not
 * selectable, and one listed here must exist upstream.
 *   Google:    https://ai.google.dev/gemini-api/docs/models
 *   OpenAI:    https://developers.openai.com/api/docs/models
 *   Anthropic: https://platform.claude.com/docs/en/models/overview
 * Groq hosts third-party models and was NOT re-verified in that pass; check
 * https://console.groq.com/docs/models before changing its list.
 */

export const PROVIDERS = {
  gemini: {
    aliases: ["gemini", "google"],
    normalizedName: "google",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    text: {
      defaultModel: "gemini-3.8-flash",
      choices: [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.1-pro-preview",
      ],
    },
    image: {
      defaultModel: "gemini-3.1-flash-image",
      choices: [
        "gemini-3.1-flash-image",
        "gemini-3.1-flash-lite-image",
        "gemini-3-pro-image",
      ],
      supported: true,
    },
    video: {
      defaultModel: "veo-3.1-fast-generate-preview",
      choices: [
        "veo-3.1-generate-001",
        "veo-3.1-generate-preview",
        "veo-3.1-fast-generate-001",
        "veo-3.1-fast-generate-preview",
      ],
      supported: true,
    },
  },
  openai: {
    aliases: ["openai"],
    normalizedName: "openai",
    envKeys: ["OPENAI_API_KEY"],
    text: {
      // luna is the cost-sensitive/high-volume tier (the successor role to
      // 5.5-instant): $0.20/$1.20 per 1M tokens.
      defaultModel: "gpt-5.6-luna",
      choices: [
        "gpt-5.6-luna",
        "gpt-5.6-terra",
        "gpt-5.6-sol",
        "gpt-6-astra",
      ],
    },
    image: {
      defaultModel: "gpt-image-2.5-flare",
      choices: ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"],
      supported: true,
    },
    video: {
      supported: false, // Falls back to gemini
    },
  },
  anthropic: {
    aliases: ["anthropic"],
    normalizedName: "anthropic",
    envKeys: ["ANTHROPIC_API_KEY"],
    text: {
      defaultModel: "claude-sonnet-5",
      choices: [
        "claude-haiku-4-5",
        "claude-sonnet-5",
        "claude-opus-5",
        "claude-fable-5-1",
      ],
    },
    image: {
      supported: false, // Falls back to gemini
    },
    video: {
      supported: false, // Falls back to gemini
    },
  },
  groq: {
    aliases: ["groq"],
    normalizedName: "groq",
    envKeys: ["GROQ_API_KEY"],
    text: {
      defaultModel: "llama-3.3-70b-versatile",
      choices: [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
        "llama-4-scout",
        "qwen/qwen3-32b",
        "openai/gpt-oss-120b",
        "moonshotai/kimi-k2-instruct-0905",
        "groq/compound",
      ],
    },
    image: {
      supported: false, // Falls back to gemini
    },
    video: {
      supported: false, // Falls back to gemini
    },
  },
};

// Default fallback providers
export const DEFAULT_TEXT_PROVIDER = "gemini";
export const DEFAULT_IMAGE_PROVIDER = "gemini";
export const DEFAULT_VIDEO_PROVIDER = "gemini";

// Get provider config by name (handles aliases)
export function getProviderConfig(name) {
  const key = (name || "").toLowerCase();

  for (const [providerKey, config] of Object.entries(PROVIDERS)) {
    if (config.aliases.includes(key)) {
      return { key: providerKey, ...config };
    }
  }

  return null;
}

// Get all providers that support a specific feature (returns all aliases)
export function getProvidersWithFeature(feature) {
  const providers = [];
  for (const [key, config] of Object.entries(PROVIDERS)) {
    if (config[feature]?.supported) {
      providers.push(...config.aliases);
    }
  }
  return providers;
}
