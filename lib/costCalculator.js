export function costCalculator() {
  let promptTokenCount = 0;
  let totalTokenCount = 0;

  return function processChunk(chunk) {
    if (chunk.END) {
      console.log(
        `Cost: promptTokens=${promptTokenCount} totalTokenCount=${totalTokenCount}`
      );
      return { promptTokenCount, totalTokenCount };
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
