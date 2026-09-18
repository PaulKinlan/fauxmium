export function costCalculator() {
  let promptTokenCount;
  let totalTokenCount;

  return function processChunk(chunk) {
    if (chunk.END) {
      console.log(
        `Tokens: prompt=${promptTokenCount ?? "unreported"} total=${totalTokenCount ?? "unreported"} (not a price estimate)`
      );
      return { promptTokenCount, totalTokenCount };
    }
    const { usageMetadata } = chunk;
    if (usageMetadata) {
      if (usageMetadata.promptTokenCount !== undefined) {
        promptTokenCount = usageMetadata.promptTokenCount;
      }
      if (usageMetadata.totalTokenCount !== undefined) {
        totalTokenCount = usageMetadata.totalTokenCount;
      }
    }
  };
}
