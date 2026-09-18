// Accept either raw HTML or a fenced document, without buffering the whole page.
export function streamCodeBlocks(codeBlock) {
  let buffer = "";
  let state = "start";
  const opening = new RegExp("```(?:" + codeBlock + ")?[ \\t]*\\r?\\n", "i");
  return async function* processChunk(chunk) {
    if (state === "done") return;
    if (chunk.END) {
      if (state === "start") throw new Error("The model returned no HTML");
      if (buffer) yield buffer;
      buffer = "";
      state = "done";
      return;
    }
    if (typeof chunk.text !== "string") return; // Usage-only and thinking chunks.
    buffer += chunk.text;
    if (state === "start") {
      const fence = opening.exec(buffer);
      const html = buffer.indexOf("<");
      if (fence && (html < 0 || fence.index < html)) {
        buffer = buffer.slice(fence.index + fence[0].length);
        state = "fenced";
      } else if (html >= 0) {
        buffer = buffer.slice(html);
        state = "raw";
      } else {
        if (buffer.length > 8192) throw new Error("The model returned no HTML");
        return;
      }
    }
    if (state === "raw") {
      yield buffer;
      buffer = "";
      return;
    }
    // Keep enough tail to recognize a closing fence split across chunks.
    const end = buffer.indexOf("\n```");
    if (end !== -1) {
      if (end) yield buffer.slice(0, end);
      buffer = "";
      state = "done";
    } else if (buffer.length > 4) {
      yield buffer.slice(0, -4);
      buffer = buffer.slice(-4);
    }
  };
}
