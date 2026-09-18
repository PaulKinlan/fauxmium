// Verified against provider documentation on 2026-09-17; sources in docs/UPGRADE-PLAN.md.
// Suggestions, not an allowlist: provider:model accepts future IDs without a release.
export const providers = {
  gemini: {
    key: "GEMINI_API_KEY",
    text: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"],
    image: ["gemini-3.1-flash-image", "gemini-3.1-flash-lite-image", "gemini-3-pro-image"],
    video: ["gemini-omni-1.1-flash", "veo-3.1-generate-preview", "veo-3.1-lite-generate-preview"],
  },
  openai: {
    key: "OPENAI_API_KEY",
    baseURL: "https://api.openai.com/v1",
    text: ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
    image: ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"],
  },
  anthropic: {
    key: "ANTHROPIC_API_KEY",
    baseURL: "https://api.anthropic.com/v1",
    text: ["claude-fable-5-1", "claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"],
  },
  xai: {
    key: "XAI_API_KEY",
    baseURL: "https://api.x.ai/v1",
    text: ["grok-4.6"],
    image: ["grok-imagine-image-2.0"],
    video: ["grok-imagine-video-1.5"],
  },
  deepseek: {
    key: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com/v1",
    text: ["deepseek-flash", "deepseek-v4-pro"],
  },
  mistral: {
    key: "MISTRAL_API_KEY",
    baseURL: "https://api.mistral.ai/v1",
    text: ["mistral-medium-3-5", "mistral-small-2603"],
  },
};

export const defaults = {
  text: "gemini:gemini-3.5-flash-lite",
  image: "gemini:gemini-3.1-flash-lite-image",
  video: "none",
};

export function resolveModel(value, kind) {
  if (value === "none" && kind !== "text") return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${kind} model`);
  let [provider, id] = value.includes(":") ? value.split(":") : [null, value];
  if (!provider) {
    provider = Object.keys(providers).find((name) =>
      Object.values(providers[name]).some((ids) => Array.isArray(ids) && ids.includes(id))
    );
    provider ??= /^(gemini-|veo-)/.test(id) ? "gemini"
      : /^(gpt-|o[134]-)/.test(id) ? "openai"
      : id.startsWith("claude-") ? "anthropic"
      : id.startsWith("grok-") ? "xai"
      : id.startsWith("deepseek-") ? "deepseek"
      : /^(mistral-|codestral|ministral-)/.test(id) ? "mistral" : null;
  }
  if (!providers[provider]?.[kind] || !/^[a-zA-Z0-9._-]+$/.test(id) || value.split(":").length > 2) {
    throw new Error(`Unsupported ${kind} model: ${value}. Use --list-models or provider:model.`);
  }
  const mediaKind = /^(veo-|gemini-omni-|grok-imagine-video)/.test(id) ? "video"
    : /image/.test(id) ? "image" : "text";
  if (mediaKind !== kind) throw new Error(`${value} is a ${mediaKind} model, not a ${kind} model`);
  return { provider, id };
}

export function apiKeyFor(provider, env) {
  const key = env[providers[provider].key] || (provider === "gemini" && (env.GOOGLE_API_KEY || env.API_KEY));
  if (!key) throw new Error(`Set ${providers[provider].key} to use ${provider} models`);
  return key;
}

export function listModels() {
  return Object.entries(providers).flatMap(([provider, config]) =>
    ["text", "image", "video"].flatMap((kind) =>
      (config[kind] || []).map((id) => ({ kind, model: `${provider}:${id}`, key: config.key }))
    )
  );
}
