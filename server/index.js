import http from "http";
import { GoogleGenAI } from "@google/genai";
import { processHTML } from "./processHTML.js";
import { processImage } from "./processImage.js";

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

export function startServer(
  hostname,
  port,
  API_KEY,
  textGenerationModel,
  imageGenerationModel
) {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const server = http.createServer(async (req, res) => {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/html") {
      await processHTML(res, url, ai, textGenerationModel);
    } else if (url.pathname === "/image") {
      await processImage(res, url, ai, imageGenerationModel);
    } else {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Not Found");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
