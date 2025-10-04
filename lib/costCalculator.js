let costs = {};

const veoModels = [
  "veo-3.0-generate-001",
  "veo-3.0-generate-preview",
  "veo-3.0-fast-generate-001",
  "veo-3.0-fast-generate-preview",
];

export async function loadCosts(model) {
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
    const response = await fetch(url);
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
      if (model == "gemini-2.5-flash-image-preview") {
        // https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-image-preview
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0.3, output: 30.0 }' for pricing.`
        );
        costs[model] = { input: 0.3 / 1_000_000, output: 30.0 / 1_000_000 };

        console.log(costs);

        return;
      }

      if (veoModels.includes(model)) {
        // https://ai.google.dev/gemini-api/docs/pricing#veo-3.0-fast-generate-preview
        // This is calculated in seconds.
        // Each video is max of 8 seconds, so let's just say that is 8_000_000 tokens. $0.40 per second
        console.log(
          `[costs] Mapping model '${model}' to '{ input: 0, output: 0.4 }' for pricing.`
        );
        costs[model] = { input: 0, output: 0.4 };

        console.log(costs);

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

  // tweaks for model naming inconsistencies
  if (model == "gemini-flash-lite-latest" || model == "gemini-flash-latest") {
    model = model.replace("gemini-flash", "gemini-2.5-flash");
    model = model.replace("-latest", "");
    console.log(
      `[costs] Mapping latest model name to stable: ${model} -> ${model}`
    );
  }

  const modelCosts = costs[model] ?? { input: 0, output: 0 };
  if (costs[model] == null) {
    console.warn(`[costs] No cost data for model '${model}'. Using 0 rates.`);
  }

  return function processChunk(chunk) {
    const { usage } = chunk;
    if (usage) {
      if (usage.inputTokens) {
        promptTokenCount = usage.inputTokens;
      }
      if (usage.totalTokens) {
        totalTokenCount = usage.outputTokens;
      }
    }

    if (chunk.END) {
      const outputTokenCount = totalTokenCount - promptTokenCount;
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
