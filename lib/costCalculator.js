let costs = {};

export async function loadCosts(model) {
  const url = `https://www.helicone.ai/api/llm-costs?model=${model}`;
  const response = await fetch(url);
  const data = await response.json();
  costs[model] = {
    input: data.data[0].input_cost_per_1m / 1000000,
    output: data.data[0].output_cost_per_1m / 1000000,
  };
}

export const sessionCosts = {
  requests: [],
  total: 0,
};

export function costCalculator(model, url) {
  let promptTokenCount = 0;
  let totalTokenCount = 0;
  const modelCosts = costs[model];

  return function processChunk(chunk) {
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
        `Cost: promptTokens=${promptTokenCount} totalTokenCount=${totalTokenCount} cost=${cost}`
      );
      return logEntry;
    }
    const { usageMetadata } = chunk;
    if (usageMetadata) {
      if (usageMetadata.promptTokenCount) {
        promptTokenCount = usageMetadata.promptTokenCount;
      }
      if (usageMetadata.totalTokenCount) {
        totalTokenCount = usageMetadata.totalTokenCount;
      }
    }
  };
}
