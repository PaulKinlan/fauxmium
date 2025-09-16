import http from "http";
import { GoogleGenAI } from "@google/genai";
import { streamCodeBlocks } from "./lib/streamCodeBlocks.js";
import { generatePrompt } from "./lib/prompts.js";
import { costCalculator } from "./lib/costCalculator.js";

/*
 * Utility to stream code blocks from a text stream.
 * This is useful when you want to extract code blocks from a markdown-like stream.
 *
 * responseGenerator is a generator function that takes a chunk and yields processed chunks so that they can be rendered
 */
async function* processChunks(processors, responseGenerator, chunkStream) {
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

        const calc = costCalculator();

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
    } else if (url.pathname === "/image") {
      const requestUrl = url.searchParams.get("url");
      const newUrl = new URL(requestUrl);
      const description = newUrl.searchParams.get("description");

      let contentType = "image/png";
      res.setHeader("Content-Type", contentType);

      console.log(
        `Image request for URL: ${requestUrl} with description: ${description}`
      );
      console.log(`Server generating image for: ${requestUrl}`);
      try {
        const prompt = await generatePrompt("image", {
          description: description || requestUrl,
        });

        const response = await ai.models.generateContent({
          model: imageGenerationModel,
          contents: prompt,
          config: {
            personGeneration: "allow_adult",
            responseModalities: ["IMAGE"],
          },
        });

        if (
          response.candidates.length === 0 ||
          !response.candidates[0].content
        ) {
          console.log("Prompt feedback:", response);

          throw new Error("No candidates in AI response");
        }

        const aiImageResponse = response.candidates[0].content.parts.find(
          (part) => "inlineData" in part
        );

        // Check if we have inline data (base64 image)
        if (!aiImageResponse.inlineData || !aiImageResponse.inlineData.data) {
          console.log(response.candidates[0].content);
          throw new Error("No image data in AI response");
        }

        // Convert base64 to binary data
        const base64Data = aiImageResponse.inlineData.data;
        const mimeType = aiImageResponse.inlineData.mimeType || "image/png";

        // Decode base64 to binary
        const binaryData = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0)
        );

        // Return binary data with proper content type
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Length", binaryData.length.toString());
        res.end(binaryData);
      } catch (e) {
        console.error(`Failed to generate image for ${requestUrl}:`);
        console.error("error name: ", e.name);
        console.error("error message: ", e.message);
        console.error("error status: ", e.status);
        // Return a placeholder image or error message
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end(`Error generating image: ${e.message}`);
      }
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
