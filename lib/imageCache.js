/**
 * Unified In-Memory Cache for Fauxmium Media and Pages
 * Supports:
 * - Generated images with in-flight Promise deduplication
 * - Generated videos
 * - Generated audio
 * - Rendered HTML pages for instant Back/Forward navigation
 */

import { clearSiteMemory } from "./siteMemory.js";

const imageCache = new Map();
const pendingImagePromises = new Map();
const videoCache = new Map();
const audioCache = new Map();
const htmlCache = new Map();

// Default Cache expiration time (10 minutes)
const CACHE_TTL_MS = 10 * 60 * 1000;
const HTML_CACHE_MAX_ENTRIES = 50;

/**
 * Normalize cache keys (strip volatile fragments, trim)
 */
export function normalizeCacheKey(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    // Keep hostname, pathname, and essential query params (e.g. description, type)
    u.hash = "";
    return u.toString();
  } catch {
    return String(url).trim();
  }
}

/* ==========================================================================
   IMAGE CACHING & IN-FLIGHT PROMISE DEDUPLICATION
   ========================================================================== */

/**
 * Store an image in cache
 */
export function cacheImage(url, imageData) {
  const key = normalizeCacheKey(url);
  const entry = {
    ...imageData,
    timestamp: Date.now(),
  };
  imageCache.set(key, entry);
  pendingImagePromises.delete(key);
}

/**
 * Retrieve an image from cache
 */
export function getCachedImage(url) {
  const key = normalizeCacheKey(url);
  const entry = imageCache.get(key);

  if (!entry) {
    return null;
  }

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    imageCache.delete(key);
    return null;
  }

  return {
    imageBytes: entry.imageBytes,
    mimeType: entry.mimeType,
  };
}

/**
 * Register an in-flight image generation Promise to prevent duplicate API calls
 */
export function registerPendingImage(url, promise) {
  const key = normalizeCacheKey(url);
  const cleanup = () => {
    pendingImagePromises.delete(key);
  };
  pendingImagePromises.set(key, promise);
  promise.then(cleanup, cleanup);
}

/**
 * Retrieve any active in-flight Promise for an image
 */
export function getPendingImage(url) {
  const key = normalizeCacheKey(url);
  return pendingImagePromises.get(key) || null;
}

/**
 * Wait for an image to be cached or for its in-flight promise to resolve
 */
export async function waitForCachedImage(url, timeoutMs = 8000, intervalMs = 250) {
  const key = normalizeCacheKey(url);

  // Check cache first
  const existing = getCachedImage(key);
  if (existing) return existing;

  // Await active in-flight generation if present
  const pending = pendingImagePromises.get(key);
  if (pending) {
    try {
      const raceResult = await Promise.race([
        pending,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
      ]);
      if (raceResult) return raceResult;
    } catch {}
  }

  // Poll briefly in case image was triggered elsewhere
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const cached = getCachedImage(key);
    if (cached) return cached;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

/* ==========================================================================
   VIDEO CACHING
   ========================================================================== */

export function cacheVideo(url, videoData) {
  const key = normalizeCacheKey(url);
  videoCache.set(key, {
    ...videoData,
    timestamp: Date.now(),
  });
}

export function getCachedVideo(url) {
  const key = normalizeCacheKey(url);
  const entry = videoCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    videoCache.delete(key);
    return null;
  }

  return {
    buffer: entry.buffer,
    mimeType: entry.mimeType || "video/mp4",
  };
}

/* ==========================================================================
   AUDIO CACHING
   ========================================================================== */

export function cacheAudio(url, audioData) {
  const key = normalizeCacheKey(url);
  audioCache.set(key, {
    ...audioData,
    timestamp: Date.now(),
  });
}

export function getCachedAudio(url) {
  const key = normalizeCacheKey(url);
  const entry = audioCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    audioCache.delete(key);
    return null;
  }

  return {
    buffer: entry.buffer,
    mimeType: entry.mimeType || "audio/wav",
  };
}

/* ==========================================================================
   HTML PAGE CACHING (FOR INSTANT BACK / FORWARD NAVIGATION)
   ========================================================================== */

export function cacheHtml(key, htmlContent) {
  if (htmlCache.size >= HTML_CACHE_MAX_ENTRIES) {
    // Evict oldest entry
    const oldestKey = htmlCache.keys().next().value;
    htmlCache.delete(oldestKey);
  }

  htmlCache.set(key, {
    html: htmlContent,
    timestamp: Date.now(),
  });
}

export function getCachedHtml(key) {
  const entry = htmlCache.get(key);
  if (!entry) return null;

  // 15-minute TTL for HTML
  if (Date.now() - entry.timestamp > 15 * 60 * 1000) {
    htmlCache.delete(key);
    return null;
  }

  return entry.html;
}

/* ==========================================================================
   MANAGEMENT & DIAGNOSTICS
   ========================================================================== */

export function clearCache() {
  clearAllCaches();
}

export function clearAllCaches() {
  const stats = {
    images: imageCache.size,
    videos: videoCache.size,
    audio: audioCache.size,
    html: htmlCache.size,
  };
  imageCache.clear();
  pendingImagePromises.clear();
  videoCache.clear();
  audioCache.clear();
  htmlCache.clear();
  clearSiteMemory();
  console.log(`[cache] Cleared all caches (${JSON.stringify(stats)})`);
  return stats;
}

export function getCacheStats() {
  return {
    images: imageCache.size,
    videos: videoCache.size,
    audio: audioCache.size,
    html: htmlCache.size,
    pendingImages: pendingImagePromises.size,
  };
}

/**
 * Generate a self-contained, single-file HTML bundle of a cached page
 * Inlines cached images, audio, and videos as base64 data URIs.
 * @param {string} url
 * @returns {string|null}
 */
export function getExportHtml(url) {
  if (!url) return null;
  const normKey = normalizeCacheKey(url);
  let html = getCachedHtml(normKey);

  if (!html) {
    for (const [k, v] of htmlCache.entries()) {
      if (k === url || k.includes(url) || url.includes(k)) {
        html = v.html;
        break;
      }
    }
  }

  if (!html) return null;

  let exportedHtml = html;

  // Inlines img, video poster, audio elements
  exportedHtml = exportedHtml.replace(/(src|poster)=["']([^"']+)["']/gi, (match, attr, assetUrl) => {
    const cachedImg = getCachedImage(assetUrl);
    if (cachedImg && cachedImg.imageBytes) {
      const b64 = Buffer.from(cachedImg.imageBytes).toString("base64");
      return `${attr}="data:${cachedImg.mimeType || "image/jpeg"};base64,${b64}"`;
    }
    const cachedVid = getCachedVideo(assetUrl);
    if (cachedVid && cachedVid.buffer) {
      const b64 = Buffer.from(cachedVid.buffer).toString("base64");
      return `${attr}="data:${cachedVid.mimeType || "video/mp4"};base64,${b64}"`;
    }
    const cachedAud = getCachedAudio(assetUrl);
    if (cachedAud && cachedAud.buffer) {
      const b64 = Buffer.from(cachedAud.buffer).toString("base64");
      return `${attr}="data:${cachedAud.mimeType || "audio/wav"};base64,${b64}"`;
    }
    return match;
  });

  // Inline <source src="..."> elements
  exportedHtml = exportedHtml.replace(/<source[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, assetUrl) => {
    const cachedAud = getCachedAudio(assetUrl);
    if (cachedAud && cachedAud.buffer) {
      const b64 = Buffer.from(cachedAud.buffer).toString("base64");
      return match.replace(assetUrl, `data:${cachedAud.mimeType || "audio/wav"};base64,${b64}`);
    }
    const cachedVid = getCachedVideo(assetUrl);
    if (cachedVid && cachedVid.buffer) {
      const b64 = Buffer.from(cachedVid.buffer).toString("base64");
      return match.replace(assetUrl, `data:${cachedVid.mimeType || "video/mp4"};base64,${b64}`);
    }
    return match;
  });

  return exportedHtml;
}

