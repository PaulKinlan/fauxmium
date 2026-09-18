// The HTTP APIs use SSE; frames and UTF-8 characters may cross network chunks.
export async function* readSSE(response) {
  if (!response.body) throw new Error("Provider returned an empty stream");
  let buffer = "";
  let data = "";
  function parse() {
    const value = data.trim();
    data = "";
    if (!value) return null;
    if (value === "[DONE]") return value;
    try { return JSON.parse(value); }
    catch { throw new Error("Provider returned invalid streaming JSON"); }
  }
  for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line.startsWith("data:")) data += line.slice(5).trimStart() + "\n";
      if (!line) {
        const event = parse();
        if (event !== null) yield event;
        if (event === "[DONE]") return;
      }
      if (data.length > 1024 * 1024) throw new Error("Provider SSE frame too large");
    }
    if (buffer.length > 1024 * 1024) throw new Error("Provider SSE frame too large");
  }
  if (buffer.startsWith("data:")) data += buffer.slice(5).trimStart();
  const event = parse();
  if (event !== null) yield event;
}
