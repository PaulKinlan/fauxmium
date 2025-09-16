export function streamCodeBlocks(codeBlock) {
  const START_FENCE = "```" + codeBlock;
  const END_FENCE = "```";
  let buffer = "";
  let state = "OUTSIDE_FENCE";

  return async function* processChunk(chunk) {
    if (chunk.END && state === "INSIDE_FENCE" && buffer) {
      yield buffer;
      return;
    }

    buffer += chunk.text;

    let keepProcessing = true;
    while (keepProcessing) {
      keepProcessing = false;
      if (state === "OUTSIDE_FENCE") {
        const startIndex = buffer.indexOf(START_FENCE);
        if (startIndex !== -1) {
          state = "INSIDE_FENCE";
          buffer = buffer.substring(startIndex + START_FENCE.length);
          keepProcessing = true;
        }
      } else if (state === "INSIDE_FENCE") {
        const endIndex = buffer.indexOf(END_FENCE);
        if (endIndex !== -1) {
          const codeToYield = buffer.substring(0, endIndex);
          if (codeToYield) yield codeToYield;
          state = "OUTSIDE_FENCE";
          buffer = buffer.substring(endIndex + END_FENCE.length);
          keepProcessing = true;
        } else {
          const holdbackLength = END_FENCE.length - 1;
          if (buffer.length > holdbackLength) {
            const partToYield = buffer.substring(
              0,
              buffer.length - holdbackLength
            );
            yield partToYield;
            buffer = buffer.substring(buffer.length - holdbackLength);
          }
        }
      }
    }
  };
}
