/**
 * Centralized provider configuration
 * Each provider defines its models, defaults, and API key mapping
 */

export const PROVIDERS = {
  gemini: {
    aliases: ["gemini", "google"],
    normalizedName: "google",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    text: {
      defaultModel: "gemini-3-flash-preview",
      choices: [
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3-pro-preview",
        "gemini-3-flash-preview",
      ],
    },
    image: {
      defaultModel: "gemini-2.5-flash-image-preview",
      choices: ["gemini-2.5-flash-image-preview"],
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
      defaultModel: "gpt-5-nano",
      choices: ["gpt-5-nano", "gpt-4-mini", "gpt-5-pro"],
    },
    image: {
      supported: false, // Falls back to gemini
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
      defaultModel: "claude-3-7-sonnet-latest",
      choices: [
        "claude-sonnet-4-0",
        "claude-3-7-sonnet-latest",
        "claude-3-opus-latest",
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
      defaultModel: "moonshotai/kimi-k2-instruct-0905",
      choices: [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-120b",
        "moonshotai/kimi-k2-instruct-0905",
        "qwen/qwen3-32b",
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
