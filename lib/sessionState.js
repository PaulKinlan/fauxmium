import { BROWSING_LENSES, resolveModelAlias } from "../config/providers.js";
import { resolveApiKey, normalizeProvider } from "../cli/providers.js";

/**
 * Global runtime session state
 */
export const sessionState = {
  activeLens: "modern",
  customLensPrompt: "",
  history: [], // [{ url, method, postData, timestamp }]
  textConfig: null,
  imageConfig: null,
  videoConfig: null,
  audioConfig: null,
};

/**
 * Initialize runtime state from server startup parameters
 */
export function initSessionState({
  textConfig,
  imageConfig,
  videoConfig,
  audioConfig,
  activeLens = "modern",
  customLensPrompt = "",
}) {
  sessionState.textConfig = { ...textConfig };
  sessionState.imageConfig = { ...imageConfig };
  sessionState.videoConfig = { ...videoConfig };
  sessionState.audioConfig = { ...audioConfig };
  sessionState.activeLens = activeLens;
  sessionState.customLensPrompt = customLensPrompt;
}

/**
 * Update runtime configuration dynamically (e.g. from extension or CLI)
 */
export function updateSessionConfig(updates = {}) {
  if (updates.activeLens !== undefined) {
    sessionState.activeLens = updates.activeLens;
  }
  if (updates.customLensPrompt !== undefined) {
    sessionState.customLensPrompt = updates.customLensPrompt;
  }

  if (updates.text) {
    const provider = normalizeProvider(updates.text.provider || sessionState.textConfig?.provider);
    sessionState.textConfig = {
      ...sessionState.textConfig,
      ...updates.text,
      provider,
      apiKey: sessionState.textConfig?.apiKey || resolveApiKey(provider),
      model: resolveModelAlias(updates.text.model || sessionState.textConfig?.model),
    };
  }

  if (updates.image) {
    const provider = normalizeProvider(updates.image.provider || sessionState.imageConfig?.provider);
    sessionState.imageConfig = {
      ...sessionState.imageConfig,
      ...updates.image,
      provider,
      apiKey: sessionState.imageConfig?.apiKey || resolveApiKey(provider),
      model: resolveModelAlias(updates.image.model || sessionState.imageConfig?.model),
    };
  }

  if (updates.video) {
    const provider = normalizeProvider(updates.video.provider || sessionState.videoConfig?.provider);
    sessionState.videoConfig = {
      ...sessionState.videoConfig,
      ...updates.video,
      provider,
      apiKey: sessionState.videoConfig?.apiKey || resolveApiKey(provider),
      model: resolveModelAlias(updates.video.model || sessionState.videoConfig?.model),
    };
  }

  if (updates.audio) {
    const provider = normalizeProvider(updates.audio.provider || sessionState.audioConfig?.provider);
    sessionState.audioConfig = {
      ...sessionState.audioConfig,
      ...updates.audio,
      provider,
      apiKey: resolveApiKey(provider) || sessionState.audioConfig?.apiKey,
      model: resolveModelAlias(updates.audio.model || sessionState.audioConfig?.model),
    };
  }

  return getSessionConfig();
}

/**
 * Get current runtime configuration snapshot
 */
export function getSessionConfig() {
  return {
    activeLens: sessionState.activeLens,
    customLensPrompt: sessionState.customLensPrompt,
    lenses: Object.values(BROWSING_LENSES),
    text: {
      provider: sessionState.textConfig?.provider,
      model: sessionState.textConfig?.model,
      enabled: sessionState.textConfig?.enabled !== false,
    },
    image: {
      provider: sessionState.imageConfig?.provider,
      model: sessionState.imageConfig?.model,
      enabled: sessionState.imageConfig?.enabled !== false,
    },
    video: {
      provider: sessionState.videoConfig?.provider,
      model: sessionState.videoConfig?.model,
      enabled: sessionState.videoConfig?.enabled !== false,
    },
    audio: {
      provider: sessionState.audioConfig?.provider,
      model: sessionState.audioConfig?.model,
      enabled: sessionState.audioConfig?.enabled !== false,
    },
    historyCount: sessionState.history.length,
  };
}

/**
 * Record a navigation event in the rolling session history (max 6)
 */
export function recordNavigation({ url, method = "GET", postData = null }) {
  if (!url) return;
  sessionState.history.unshift({
    url,
    method,
    postData,
    timestamp: Date.now(),
  });

  if (sessionState.history.length > 6) {
    sessionState.history.pop();
  }
}

/**
 * Get formatted session history string for prompt interpolation
 */
export function getFormattedSessionHistory() {
  if (sessionState.history.length === 0) {
    return "None (First page in browsing session)";
  }

  return sessionState.history
    .map((h, i) => `${i + 1}. [${h.method}] ${h.url}${h.postData ? ` (Payload: ${h.postData.substring(0, 100)})` : ""}`)
    .join("\n");
}

/**
 * Get the active Browsing Lens prompt instruction
 */
export function getActiveLensInstruction() {
  const lensId = sessionState.activeLens || "modern";
  if (lensId === "custom") {
    return sessionState.customLensPrompt
      ? `AESTHETIC LENS (CUSTOM): ${sessionState.customLensPrompt}`
      : "";
  }

  const lens = BROWSING_LENSES[lensId];
  return lens?.prompt || "";
}
