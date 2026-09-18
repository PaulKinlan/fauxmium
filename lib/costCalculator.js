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
  return LATEST_ALIASES[model] ?? model;
}

export async function loadCosts(model) {
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
      costs[model] = { input: 0, output: 0 };
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
      costs[model] = { input: 0, output: 0 };
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
      // We might want to do some custom handling.
      if (model === "dall-e-3") {
        console.log(`[costs] Mapping model '${model}' to '{ input: 0, output: 0.04 }' for pricing.`);
        costs[model] = { input: 0, output: 0.04 };
        return;
      }

      if (model === "dall-e-2") {
        console.log(`[costs] Mapping model '${model}' to '{ input: 0, output: 0.02 }' for pricing.`);
        costs[model] = { input: 0, output: 0.02 };
        return;
      }

      if (model === "gemini-2.5-flash-image" || model === "gemini-2.5-flash-image-preview") {
        // https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-image
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0.3, output: 30.0 }' for pricing.`
        );
        costs[model] = { input: 0.3 / 1_000_000, output: 30.0 / 1_000_000 };
        return;
      }

      if (model === "gemini-3.5-flash" || model === "gemini-3-flash-preview") {
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 1.5, output: 9.0 }' for pricing.`
        );
        costs[model] = { input: 1.5 / 1_000_000, output: 9.0 / 1_000_000 };
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
        costs[model] = { input: 2.0 / 1_000_000, output: 12.0 / 1_000_000 };
        return;
      }

      if (model === "gemini-3.1-flash-lite") {
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0.25, output: 1.5 }' for pricing.`
        );
        costs[model] = { input: 0.25 / 1_000_000, output: 1.5 / 1_000_000 };
        return;
      }

      if (model && model.startsWith("veo-")) {
        // https://ai.google.dev/gemini-api/docs/pricing#veo-3.0-fast-generate-preview
        // This is calculated in seconds.
        // Each video is max of 8 seconds, so let's just say that is 8_000_000 tokens. $0.40 per second
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0, output: 0.4 }' for pricing.`
        );
        costs[model] = { input: 0, output: 0.4 };

        return;
      }

      // Verified against first-party pricing on 2026-09-18 (config/providers.js
      // holds the same ids). These exist so a CURRENT default never prices at 0
      // when Helicone has no row — that failure is worse than a stale id.
      const perMillion = {
        // Google text (3.8 Flash is introductory $0.75/$3.75 through 2026-12-31;
        // standard $1.50/$7.50 from 2027-01-01).
        "gemini-3.8-flash": [0.75, 3.75],
        "gemini-3.5-flash-lite": [0.3, 2.5],
        // Google image (Nano Banana): input text/image, output image tokens.
        "gemini-3.1-flash-image": [0.5, 60.0],
        "gemini-3.1-flash-lite-image": [0.25, 30.0],
        // OpenAI text.
        "gpt-5.6-luna": [0.2, 1.2],
        "gpt-5.6-terra": [2.0, 12.0],
        "gpt-5.6-sol": [4.0, 20.0],
        "gpt-6-astra": [10.0, 50.0],
        // OpenAI image (text input, image output).
        "gpt-image-2.5-flare": [5.0, 30.0],
        "gpt-image-2.5-sunburst": [5.0, 30.0],
        // Anthropic.
        "claude-haiku-4-5": [1.0, 5.0],
        "claude-sonnet-5": [2.0, 10.0],
        "claude-opus-5": [5.0, 25.0],
        "claude-fable-5-1": [10.0, 50.0],
      };
      if (perMillion[model]) {
        const [input, output] = perMillion[model];
        console.log(
          `[costs] Mapping model '${model}' to '{ input: ${input}, output: ${output} }' for pricing.`
        );
        costs[model] = { input: input / 1_000_000, output: output / 1_000_000 };
        return;
      }

      console.warn(
        `[costs] No pricing data found for model '${model}'. Defaulting to 0.`
      );
      costs[model] = { input: 0, output: 0 };
      return;
    }

    costs[model] = {
      input: row.input_cost_per_1m / 1_000_000,
      output: row.output_cost_per_1m / 1_000_000,
    };
  } catch (err) {
    console.warn(`[costs] Error loading costs for model '${model}':`, err);
    costs[model] = { input: 0, output: 0 };
  }
}

export const sessionCosts = {
  requests: [],
  total: 0,
};

export function costCalculator(model, url) {
  let promptTokenCount = 0;
  let totalTokenCount = 0;


  model = canonicalModel(model);

  const modelCosts = costs[model] ?? { input: 0, output: 0 };
  if (costs[model] == null) {
    console.warn(`[costs] No cost data for model '${model}'. Using 0 rates.`);
  }

  return function processChunk(chunk) {
    const { usage } = chunk;
    if (usage) {
      if (typeof usage.inputTokens === "number") {
        promptTokenCount = usage.inputTokens;
      }
      // The AI SDK reports inputTokens / outputTokens / totalTokens. The total
      // is what this calculator needs; assigning outputTokens here made the
      // derived output count NEGATIVE whenever input > output (the usual case:
      // a long prompt, a shorter page), and NaN when only totals arrived.
      const total =
        typeof usage.totalTokens === "number"
          ? usage.totalTokens
          : typeof usage.outputTokens === "number"
            ? promptTokenCount + usage.outputTokens
            : undefined;
      if (typeof total === "number") totalTokenCount = total;
    }

    if (chunk.END) {
      const outputTokenCount = Math.max(
        0,
        (typeof totalTokenCount === "number" ? totalTokenCount : promptTokenCount) -
          promptTokenCount
      );
      const cost =
        promptTokenCount * modelCosts.input +
        outputTokenCount * modelCosts.output;

      const logEntry = {
        url,
        model,
        promptTokenCount,
        outputTokenCount,
        totalTokenCount,
        cost,
      };

      sessionCosts.requests.push(logEntry);
      sessionCosts.total += cost;

      console.log(
        `Cost: promptTokens=${promptTokenCount} totalTokenCount=${totalTokenCount} cost=${cost} - model=${model}`
      );
      return logEntry;
    }
  };
}
