import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.join(__dirname, "..", ".cache");
const geminiCacheFile = path.join(cacheDir, "gemini-models.json");

let cachedGeminiModels = null;

/**
 * Synchronize live models from the Gemini API
 * @param {{ apiKey?: string, forceSync?: boolean }} options
 */
export async function syncGeminiModels({ apiKey, forceSync = false } = {}) {
  const key = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (cachedGeminiModels && !forceSync) {
    return cachedGeminiModels;
  }

  // Check disk cache first unless forceSync
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    if (!forceSync && fs.existsSync(geminiCacheFile)) {
      const stats = fs.statSync(geminiCacheFile);
      const isFresh = Date.now() - stats.mtimeMs < 24 * 60 * 60 * 1000;
      if (isFresh) {
        cachedGeminiModels = JSON.parse(fs.readFileSync(geminiCacheFile, "utf8"));
        return cachedGeminiModels;
      }
    }
  } catch (err) {
    console.warn("[sync-models] Could not read disk cache for Gemini models:", err.message);
  }

  if (!key) {
    return cachedGeminiModels || [];
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];
      cachedGeminiModels = models;
      try {
        fs.writeFileSync(geminiCacheFile, JSON.stringify(models, null, 2), "utf8");
      } catch (writeErr) {
        console.warn("[sync-models] Could not write gemini models cache:", writeErr.message);
      }

      console.log(`[sync-models] Synced ${models.length} live models from Gemini API.`);
      const highlights = models
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((n) => n.includes("gemini-3") || n.includes("veo-3") || n.includes("gemini-2.5"));
      console.log(`[sync-models] Active models: ${highlights.slice(0, 8).join(", ")}`);
      return models;
    } else {
      console.warn(`[sync-models] Gemini models query returned HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[sync-models] Gemini models query failed or timed out:", err.message);
  }

  if (fs.existsSync(geminiCacheFile)) {
    try {
      cachedGeminiModels = JSON.parse(fs.readFileSync(geminiCacheFile, "utf8"));
      return cachedGeminiModels;
    } catch {}
  }

  return [];
}
