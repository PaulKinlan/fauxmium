/**
 * In-memory cache for generated images
 * Stores images temporarily so they can be shared between processImage and processVideo
 */

const imageCache = new Map();

// Cache expiration time (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Store an image in the cache
 * @param {string} url - The image URL (key)
 * @param {Object} imageData - The image data
 * @param {string} imageData.imageBytes - Base64 encoded image
 * @param {string} imageData.mimeType - MIME type of the image
 */
export function cacheImage(url, imageData) {
  const entry = {
    ...imageData,
    timestamp: Date.now(),
  };
  imageCache.set(url, entry);
  console.log(`[imageCache] Cached image for URL: ${url}`);
}

/**
 * Retrieve an image from the cache
 * @param {string} url - The image URL (key)
 * @returns {Object|null} The cached image data or null if not found/expired
 */
export function getCachedImage(url) {
  const entry = imageCache.get(url);

  if (!entry) {
    console.log(`[imageCache] Cache miss for URL: ${url}`);
    return null;
  }

  // Check if entry has expired
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    console.log(
      `[imageCache] Cache entry expired for URL: ${url} (age: ${age}ms)`
    );
    imageCache.delete(url);
    return null;
  }

  console.log(`[imageCache] Cache hit for URL: ${url} (age: ${age}ms)`);
  return {
    imageBytes: entry.imageBytes,
    mimeType: entry.mimeType,
  };
}

/**
 * Wait for an image to appear in the cache (for handling race conditions)
 * @param {string} url - The image URL to wait for
 * @param {number} timeoutMs - Maximum time to wait in milliseconds
 * @param {number} intervalMs - How often to check the cache
 * @returns {Promise<Object|null>} The cached image data or null if timeout
 */
export async function waitForCachedImage(
  url,
  timeoutMs = 30000,
  intervalMs = 1000
) {
  const startTime = Date.now();

  console.log(
    `[imageCache] Waiting for cached image: ${url} (timeout: ${timeoutMs}ms)`
  );

  while (Date.now() - startTime < timeoutMs) {
    const cached = getCachedImage(url);
    if (cached) {
      return cached;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.log(`[imageCache] Timeout waiting for cached image: ${url}`);
  return null;
}

/**
 * Clear the entire cache (useful for testing/cleanup)
 */
export function clearCache() {
  const size = imageCache.size;
  imageCache.clear();
  console.log(`[imageCache] Cleared cache (${size} entries)`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  const entries = Array.from(imageCache.entries()).map(([url, entry]) => ({
    url,
    age: now - entry.timestamp,
    size: entry.base64Data?.length || 0,
  }));

  return {
    totalEntries: imageCache.size,
    entries,
  };
}
