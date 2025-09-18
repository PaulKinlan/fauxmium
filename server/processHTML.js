import { costCalculator } from "../lib/costCalculator.js";
import { generatePrompt } from "../lib/prompts.js";
import { streamCodeBlocks } from "../lib/streamCodeBlocks.js";
import { processChunks } from "../lib/processChunks.js";

export async function processHTML(res, url, ai, textGenerationModel) {
  let contentType = "text/html";
  res.setHeader("Content-Type", contentType);
  const requestUrl = url.searchParams.get("url");
  const requestType = url.searchParams.get("type");
  const requestHeaders = url.searchParams.get("headers");
  console.log(`Server generating content for: ${requestUrl}`);
  try {
    // We load the prompt from disk and interpolate values so that we can change it without restarting the server.
    const prompt = await generatePrompt("html", {
      requestUrl,
      requestType,
      requestHeaders,
    });

    const response = await ai.models.generateContentStream({
      model: textGenerationModel,
      contents: prompt,
    });

    const calc = costCalculator(textGenerationModel, requestUrl);

    const outputStream = processChunks(
      [
        (chunk) => {
          console.log("Processing chunk:", JSON.stringify(chunk));
        },
        calc,
      ],
      streamCodeBlocks("html"),
      response
    );

    for await (const codeChunk of outputStream) {
      res.write(codeChunk);
    }

    res.end();
  } catch (error) {
    console.error(`Failed to generate content for ${requestUrl}:`, error);
    res.end(
      `<html><body><h1>Error</h1><p>Failed to generate content for ${requestUrl}</p><pre>${error.message}</pre></body></html>`
    );
  }
}
