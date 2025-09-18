/*
 * Utility to stream code blocks from a text stream.
 * This is useful when you want to extract code blocks from a markdown-like stream.
 *
 * responseGenerator is a generator function that takes a chunk and yields processed chunks so that they can be rendered
 */

export async function* processChunks(
  processors,
  responseGenerator,
  chunkStream
) {
  for await (const chunk of chunkStream) {
    for (const processor of processors) {
      await processor(chunk);
    }

    yield* responseGenerator(chunk);
  }

  // Flush.
  for (const processor of processors) {
    await processor({ END: true });
  }
  yield* responseGenerator({ END: true });
}
