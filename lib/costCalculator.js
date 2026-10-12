import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveModelAlias, FALLBACK_PRICING } from "../config/providers.js";
import { syncGeminiModels } from "./modelSync.js";

export { syncGeminiModels };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.join(__dirname, "..", ".cache");
const litellmCacheFile = path.join(cacheDir, "model-prices.json");

let costs = {};
let litellmPrices = null;

export const sessionCosts = {
  requests: [],
  total: 0,
  cachedTokens: 0,
  byModality: {
    text: 0,
    image: 0,
    video: 0,
    audio: 0,
  },
};

export function resetSessionCosts() {
  sessionCosts.requests = [];
  sessionCosts.total = 0;
  sessionCosts.cachedTokens = 0;
  sessionCosts.byModality = {
    text: 0,
    image: 0,
    video: 0,
    audio: 0,
  };
}

/**
 * Load LiteLLM pricing database from local cache or remote
 */
async function getLiteLLMPrices(forceSync = false) {
  if (forceSync) {
    syncGeminiModels({ forceSync }).catch(() => {});
  }

  if (litellmPrices && !forceSync) {
    return litellmPrices;
  }

  // Check disk cache first
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    if (!forceSync && fs.existsSync(litellmCacheFile)) {
      const stats = fs.statSync(litellmCacheFile);
      const isFresh = Date.now() - stats.mtimeMs < 24 * 60 * 60 * 1000; // 24 hours
      if (isFresh) {
        const data = fs.readFileSync(litellmCacheFile, "utf8");
        litellmPrices = JSON.parse(data);
        return litellmPrices;
      }
    }
  } catch (err) {
    console.warn("[costs] Could not read disk cache for model prices:", err.message);
  }

  // Attempt live sync from LiteLLM repository
  try {
    const url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      litellmPrices = data;
      try {
        fs.writeFileSync(litellmCacheFile, JSON.stringify(data), "utf8");
      } catch (writeErr) {
        console.warn("[costs] Could not write model prices cache:", writeErr.message);
      }
      return litellmPrices;
    }
  } catch (err) {
    console.warn("[costs] Live pricing sync timed out or failed:", err.message);
  }

  // Fallback to disk cache if available even if older than 24h
  if (fs.existsSync(litellmCacheFile)) {
    try {
      litellmPrices = JSON.parse(fs.readFileSync(litellmCacheFile, "utf8"));
      return litellmPrices;
    } catch {}
  }

  litellmPrices = {};
  return litellmPrices;
}

/**
 * Match a model in LiteLLM pricing dictionary
 */
function findLiteLLMEntry(modelName, prices) {
  if (!prices || !modelName) return null;
  const direct = prices[modelName];
  if (direct) return direct;

  const target = modelName.toLowerCase();
  for (const [key, value] of Object.entries(prices)) {
    if (key.toLowerCase() === target || key.toLowerCase().endsWith(`/${target}`)) {
      return value;
    }
  }
  return null;
}

/**
 * Find fallback pricing from config/models.json
 */
function findFallbackPricing(modelName) {
  if (!modelName) return null;
  if (FALLBACK_PRICING[modelName]) {
    return FALLBACK_PRICING[modelName];
  }

  // Prefix match (e.g. "veo-", "synth-")
  for (const [prefix, pricing] of Object.entries(FALLBACK_PRICING)) {
    if (prefix.endsWith("-") && modelName.startsWith(prefix)) {
      return pricing;
    }
  }

  return null;
}

/**
 * Load pricing for a model from LiteLLM, Helicone, or fallback config
 */
export async function loadCosts(model, { forceSync = false } = {}) {
  try {
    if (!model) {
      costs[model] = { unit: "tokens", input: 0, output: 0 };
      return;
    }

    const resolvedModel = resolveModelAlias(model);

    // 1. Check LiteLLM database
    const prices = await getLiteLLMPrices(forceSync);
    const litellmEntry = findLiteLLMEntry(resolvedModel, prices);
    if (litellmEntry && (litellmEntry.input_cost_per_token != null || litellmEntry.output_cost_per_token != null)) {
      costs[model] = {
        unit: "tokens",
        input: litellmEntry.input_cost_per_token || 0,
        output: litellmEntry.output_cost_per_token || 0,
      };
      return;
    }

    // 2. Check Helicone API
    try {
      const heliconeUrl = `https://www.helicone.ai/api/llm-costs?model=${encodeURIComponent(resolvedModel)}`;
      const res = await fetch(heliconeUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const json = await res.json();
        const row = json?.data?.[0];
        if (row && row.input_cost_per_1m != null && row.output_cost_per_1m != null) {
          costs[model] = {
            unit: "tokens",
            input: row.input_cost_per_1m / 1_000_000,
            output: row.output_cost_per_1m / 1_000_000,
          };
          return;
        }
      }
    } catch {}

    // 3. Check fallback pricing table from models.json
    const fallback = findFallbackPricing(resolvedModel);
    if (fallback) {
      const isPerToken = fallback.unit === "tokens";
      costs[model] = {
        unit: fallback.unit || "tokens",
        input: isPerToken ? (fallback.input || 0) / 1_000_000 : (fallback.input || 0),
        output: isPerToken ? (fallback.output || 0) / 1_000_000 : (fallback.output || 0),
      };
      return;
    }

    console.warn(`[costs] No pricing data found for model '${model}'. Defaulting to 0.`);
    costs[model] = { unit: "tokens", input: 0, output: 0 };
  } catch (err) {
    console.warn(`[costs] Error loading costs for model '${model}':`, err);
    costs[model] = { unit: "tokens", input: 0, output: 0 };
  }
}

/**
 * Creates a stream processor / cost accumulator for a single request
 * @param {string} model
 * @param {string} url
 * @param {"text"|"image"|"video"|"audio"} modality
 */
export function costCalculator(model, url, modality = "text") {
  const resolvedModel = resolveModelAlias(model);
  const modelCosts = costs[model] || costs[resolvedModel] || { unit: "tokens", input: 0, output: 0 };

  let promptTokenCount = 0;
  let cachedInputTokens = 0;
  let outputTokenCount = 0;
  let totalTokenCount = 0;
  let rawUsage = null;
  let isCached = false;

  return function processChunk(chunk) {
    if (chunk.cached) {
      isCached = true;
    }

    if (chunk.usage) {
      rawUsage = chunk.usage;
      const u = chunk.usage;
      if (u.inputTokens != null || u.promptTokens != null) {
        promptTokenCount = u.inputTokens ?? u.promptTokens ?? 0;
      }
      if (u.cachedInputTokens != null) {
        cachedInputTokens = u.cachedInputTokens;
      }
      if (u.outputTokens != null || u.completionTokens != null) {
        outputTokenCount = u.outputTokens ?? u.completionTokens ?? 0;
      }
      if (u.totalTokens != null) {
        totalTokenCount = u.totalTokens;
        if (outputTokenCount === 0 && totalTokenCount >= promptTokenCount) {
          outputTokenCount = totalTokenCount - promptTokenCount;
        }
      } else {
        totalTokenCount = promptTokenCount + outputTokenCount;
      }
    }

    if (chunk.END) {
      let cost = 0;

      if (isCached) {
        cost = 0;
      } else {
        switch (modelCosts.unit) {
          case "per_image": {
            const count = rawUsage?.images ?? 1;
            cost = count * (modelCosts.output || 0);
            break;
          }
          case "per_second": {
            const duration = rawUsage?.durationSeconds ?? rawUsage?.outputTokens ?? 8;
            cost = duration * (modelCosts.output || 0);
            break;
          }
          case "per_1k_chars": {
            const chars = rawUsage?.characters ?? (promptTokenCount ? promptTokenCount * 4 : 0);
            cost = (chars / 1000) * (modelCosts.output || 0);
            break;
          }
          case "tokens":
          default: {
            const uncachedPromptTokens = Math.max(0, promptTokenCount - cachedInputTokens);
            // 75% discount for cached input tokens (billed at 25% of normal input cost)
            const inputCost =
              uncachedPromptTokens * modelCosts.input +
              cachedInputTokens * modelCosts.input * 0.25;
            cost = inputCost + outputTokenCount * modelCosts.output;
            break;
          }
        }
      }

      const logEntry = {
        url,
        model,
        modality,
        cached: isCached,
        promptTokenCount,
        cachedInputTokens,
        outputTokenCount,
        totalTokenCount,
        cost,
        timestamp: Date.now(),
      };

      sessionCosts.requests.push(logEntry);
      sessionCosts.total += cost;
      if (cachedInputTokens > 0) {
        sessionCosts.cachedTokens = (sessionCosts.cachedTokens || 0) + cachedInputTokens;
      }
      if (sessionCosts.byModality[modality] != null) {
        sessionCosts.byModality[modality] += cost;
      }

      const cacheLabel = isCached
        ? " [CACHED ⚡]"
        : cachedInputTokens > 0
        ? ` [PROMPT-CACHED: ${cachedInputTokens} tokens ⚡]`
        : "";
      console.log(
        `Cost [${modality}]${cacheLabel}: prompt=${promptTokenCount}${
          cachedInputTokens ? ` (cached=${cachedInputTokens})` : ""
        } output=${outputTokenCount} cost=$${cost.toFixed(6)} - model=${model}`
      );
      return logEntry;
    }
  };
}
