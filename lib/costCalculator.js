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

// Google's floating "-latest" aliases track whatever Google ships, so they are
// priced as the current equivalent model. Both loadCosts() and costCalculator()
// MUST resolve through this: loading costs under the alias key while pricing the
// canonical key is a silent zero-cost path.
const LATEST_ALIASES = {
  "gemini-flash-latest": "gemini-3.8-flash",
  "gemini-flash-lite-latest": "gemini-3.5-flash-lite",
};

export function canonicalModel(model) {
  if (!model) return model;
  return LATEST_ALIASES[model] ?? resolveModelAlias(model);
}

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
 * Load pricing for a model from Helicone, or first-party verified fallback config
 */
export async function loadCosts(model, { forceSync = false } = {}) {
  const requested = model;
  model = canonicalModel(model);
  if (requested !== model) {
    console.log(
      `[costs] Mapping floating alias '${requested}' to '${model}' for pricing.`
    );
  }

  try {
    if (!model) {
      console.warn(
        "[costs] No model provided to loadCosts; defaulting costs to 0."
      );
      costs[model] = { unit: "tokens", input: 0, output: 0 };
      return;
    }

    const url = `https://www.helicone.ai/api/llm-costs?model=${encodeURIComponent(
      model
    )}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) {
      console.warn(
        `[costs] Failed to fetch costs for model '${model}': ${response.status} ${response.statusText}`
      );
      costs[model] = { unit: "tokens", input: 0, output: 0 };
      return;
    }

    const data = await response.json();
    const row = data?.data?.[0];

    if (
      !row ||
      row.input_cost_per_1m == null ||
      row.output_cost_per_1m == null
    ) {
      console.log(`[costs] No pricing data found for model '${model}'.`);

      if (model === "dall-e-3") {
        console.log(`[costs] Mapping model '${model}' to '{ input: 0, output: 0.04 }' for pricing.`);
        costs[model] = { unit: "per_image", input: 0, output: 0.04 };
        return;
      }

      if (model === "dall-e-2") {
        console.log(`[costs] Mapping model '${model}' to '{ input: 0, output: 0.02 }' for pricing.`);
        costs[model] = { unit: "per_image", input: 0, output: 0.02 };
        return;
      }

      if (model === "gemini-2.5-flash-image" || model === "gemini-2.5-flash-image-preview") {
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0.3, output: 30.0 }' for pricing.`
        );
        costs[model] = { unit: "tokens", input: 0.3 / 1_000_000, output: 30.0 / 1_000_000 };
        return;
      }

      if (model === "gemini-3.5-flash" || model === "gemini-3-flash-preview") {
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 1.5, output: 9.0 }' for pricing.`
        );
        costs[model] = { unit: "tokens", input: 1.5 / 1_000_000, output: 9.0 / 1_000_000 };
        return;
      }

      if (
        model === "gemini-3.1-pro" ||
        model === "gemini-3.1-pro-preview" ||
        model === "gemini-3-pro-preview"
      ) {
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 2.0, output: 12.0 }' for pricing.`
        );
        costs[model] = { unit: "tokens", input: 2.0 / 1_000_000, output: 12.0 / 1_000_000 };
        return;
      }

      if (model === "gemini-3.1-flash-lite") {
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0.25, output: 1.5 }' for pricing.`
        );
        costs[model] = { unit: "tokens", input: 0.25 / 1_000_000, output: 1.5 / 1_000_000 };
        return;
      }

      if (model && (model.startsWith("veo-") || model.includes("veo"))) {
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0, output: 0.4 }' for pricing.`
        );
        costs[model] = { unit: "per_second", input: 0, output: 0.4 };
        return;
      }

      if (model && (model.startsWith("synth-") || model === "synth-wav")) {
        costs[model] = { unit: "per_second", input: 0, output: 0 };
        return;
      }

      // Verified against first-party pricing on 2026-09-18 (config/providers.js
      // holds the same ids). These exist so a CURRENT default never prices at 0
      // when Helicone has no row — that failure is worse than a stale id.
      const perMillion = {
        // Google text
        "gemini-3.8-flash": [0.75, 3.75],
        "gemini-3.5-flash-lite": [0.3, 2.5],
        "gemini-3.5-flash": [1.5, 9.0],
        // Google image
        "gemini-3.1-flash-image": [0.5, 60.0],
        "gemini-3.1-flash-lite-image": [0.25, 30.0],
        // OpenAI text
        "gpt-5.6-luna": [0.2, 1.2],
        "gpt-5.6-terra": [2.0, 12.0],
        "gpt-5.6-sol": [4.0, 20.0],
        "gpt-6-astra": [10.0, 50.0],
        "gpt-6-sol": [4.0, 20.0],
        // OpenAI image
        "gpt-image-2.5-flare": [5.0, 30.0],
        "gpt-image-2.5-sunburst": [5.0, 30.0],
        // Anthropic
        "claude-haiku-4-5": [1.0, 5.0],
        "claude-sonnet-5": [2.0, 10.0],
        "claude-sonnet-5-5": [3.0, 15.0],
        "claude-opus-5": [5.0, 25.0],
        "claude-fable-5-1": [10.0, 50.0],
      };
      if (perMillion[model]) {
        const [input, output] = perMillion[model];
        console.log(
          `[costs] Mapping model '${model}' to '{ input: ${input}, output: ${output} }' for pricing.`
        );
        costs[model] = { unit: "tokens", input: input / 1_000_000, output: output / 1_000_000 };
        return;
      }

      const fallback = findFallbackPricing(model);
      if (fallback) {
        const isPerToken = fallback.unit === "tokens";
        costs[model] = {
          unit: fallback.unit || "tokens",
          input: isPerToken ? (fallback.input || 0) / 1_000_000 : (fallback.input || 0),
          output: isPerToken ? (fallback.output || 0) / 1_000_000 : (fallback.output || 0),
        };
        return;
      }

      console.warn(
        `[costs] No pricing data found for model '${model}'. Defaulting to 0.`
      );
      costs[model] = { unit: "tokens", input: 0, output: 0 };
      return;
    }

    costs[model] = {
      unit: "tokens",
      input: row.input_cost_per_1m / 1_000_000,
      output: row.output_cost_per_1m / 1_000_000,
    };
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
  model = canonicalModel(model);
  const modelCosts = costs[model] ?? { unit: "tokens", input: 0, output: 0 };
  if (costs[model] == null) {
    console.warn(`[costs] No cost data for model '${model}'. Using 0 rates.`);
  }

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

    const { usage } = chunk;
    if (usage) {
      rawUsage = usage;
      if (typeof usage.inputTokens === "number" || typeof usage.promptTokens === "number") {
        promptTokenCount = usage.inputTokens ?? usage.promptTokens ?? 0;
      }
      if (typeof usage.cachedInputTokens === "number") {
        cachedInputTokens = usage.cachedInputTokens;
      }
      if (typeof usage.outputTokens === "number" || typeof usage.completionTokens === "number") {
        outputTokenCount = usage.outputTokens ?? usage.completionTokens ?? 0;
      }
      const total =
        typeof usage.totalTokens === "number"
          ? usage.totalTokens
          : typeof usage.outputTokens === "number"
            ? promptTokenCount + usage.outputTokens
            : undefined;
      if (typeof total === "number") totalTokenCount = total;
    }

    if (chunk.END) {
      outputTokenCount = Math.max(
        0,
        outputTokenCount ||
        (typeof totalTokenCount === "number" ? totalTokenCount : promptTokenCount) -
          promptTokenCount
      );

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
              uncachedPromptTokens * (modelCosts.input || 0) +
              cachedInputTokens * (modelCosts.input || 0) * 0.25;
            cost = inputCost + outputTokenCount * (modelCosts.output || 0);
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
