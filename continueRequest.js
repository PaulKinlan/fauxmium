import puppeteer from "puppeteer";
import { GoogleGenAI } from "@google/genai";
import http from "http";

// Load the API key from an environment variable
const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// This function is no longer used for browser-side streaming, but is kept
// for the server-side generation process.
async function* streamCodeBlocks(codeBlock, chunkStream) {
  const START_FENCE = "```" + codeBlock;
  const END_FENCE = "```";
  let buffer = "";
  let state = "OUTSIDE_FENCE";

  for await (const chunk of chunkStream) {
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
  }
  if (state === "INSIDE_FENCE" && buffer) {
    yield buffer;
  }
}

const targetMap = new Map();

// Attach the interceptor only once per page.
const attach = async (target) => {
  if (targetMap.has(target._targetId)) {
    return; // Already attached
  }

  console.log(`Attaching interceptor to page: ${target.url()}`);
  const client = await target.createCDPSession();
  targetMap.set(target._targetId, client);

  client.on("Fetch.requestPaused", async (event) => {
    const { requestId, request, resourceType } = event;
    console.log(`Fetch paused for: ${request.method} ${request.url}`);

    try {
      if (resourceType === "Document") {
        // Act as a proxy: fetch the content from the local server ourselves.
        const proxyUrl = `http://${hostname}:${port}/html?url=${encodeURIComponent(
          request.url
        )}&type=${resourceType}&headers=${encodeURIComponent(
          JSON.stringify(request.headers)
        )}`;

        const response = await new Promise((resolve, reject) => {
          http
            .get(proxyUrl, (res) => {
              let data = "";
              res.on("data", (chunk) => (data += chunk));
              res.on("end", () =>
                resolve({ statusCode: res.statusCode, body: data })
              );
            })
            .on("error", (err) => reject(err));
        });

        // Fulfill the browser's request with the response from our server.
        await client.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: response.statusCode,
          body: Buffer.from(response.body).toString("base64"),
          responseHeaders: [{ name: "Content-Type", value: "text/html" }],
        });
      } else if (resourceType === "Image") {
        // Act as a proxy for images as well.
        const proxyUrl = `http://${hostname}:${port}/image?url=${encodeURIComponent(
          request.url
        )}&type=${resourceType}&headers=${encodeURIComponent(
          JSON.stringify(request.headers)
        )}`;

        const response = await new Promise((resolve, reject) => {
          http
            .get(proxyUrl, (res) => {
              const chunks = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () =>
                resolve({
                  statusCode: res.statusCode,
                  headers: res.headers,
                  body: Buffer.concat(chunks),
                })
              );
            })
            .on("error", (err) => reject(err));
        });

        // Fulfill the browser's request with the response from our server.
        await client.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: response.statusCode,
          body: response.body.toString("base64"),
          responseHeaders: Object.entries(response.headers).map(
            ([name, value]) => ({
              name,
              value: Array.isArray(value) ? value.join(", ") : value,
            })
          ),
        });
      } else {
        // Abort all other requests (CSS, JS, etc.)
        await client.send("Fetch.failRequest", {
          requestId,
          errorReason: "Aborted",
        });
      }
    } catch (error) {
      console.error(`Error handling request ${requestId}: ${error.message}`);
      // If something goes wrong, abort the request to prevent hangs.
      try {
        await client.send("Fetch.failRequest", {
          requestId,
          errorReason: "Failed",
        });
      } catch (e) {
        // Ignore errors here, session might be gone.
      }
    }
  });

  await client.send("Fetch.enable", {
    patterns: [{ urlPattern: "*", requestStage: "Request" }],
  });
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    devtools: true,
  });

  browser.on("targetcreated", async (target) => {
    if (target.type() === "page") {
      await attach(target);
    }
  });

  for (const target of browser.targets()) {
    if (target.type() === "page") {
      await attach(target);
    }
  }
})();

const hostname = "127.0.0.1";
const port = 3001;

const server = http.createServer(async (req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/html") {
    const requestUrl = url.searchParams.get("url");
    const requestType = url.searchParams.get("type");
    const requestHeaders = url.searchParams.get("headers");
    console.log(`Server generating content for: ${requestUrl}`);
    try {
      const prompt = `Create the HTML for a web page that would be served at the URL: ${requestUrl}. The page should be visually appealing and relevant to the URL.
    
Relevant details about the request:
- URL: ${requestUrl}
- Resource Type: ${requestType}
- Headers: ${requestHeaders}

Response requirements:
- Please ensure the HTML is well-structured and includes modern web design practices. 
- Image src urls must be highly descriptive by encoding the alt text as the URL (e.g., <img src="https://example.com/images/beautiful-sunset-over-north-wales.jpg?description=beautiful+sunset+over+north+wales" alt="beautiful sunset over north wales">)
- Prefer that links aren't # instead are full paths.
- Links must not include target="_blank" or similar attributes.
- Include basic CSS styles within a <style> tag in the <head> section.
- Only return the HTML content (inside a code fence) without any additional explanations`;

      const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      });

      // We still stream from the AI, but we buffer the response to send back to the proxy.
      let fullBody = "";
      const htmlCodeStream = streamCodeBlocks("html", response);
      for await (const codeChunk of htmlCodeStream) {
        fullBody += codeChunk;
      }
      res.end(fullBody);
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

    console.log(
      `Image request for URL: ${requestUrl} with description: ${description}`
    );
    console.log(`Server generating image for: ${requestUrl}`);
    try {
      const prompt = `Create an image that is visually appealing matching the following description: ${
        description || requestUrl
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: prompt,
        config: {
          personGeneration: "allow_adult",
          responseModalities: ["IMAGE"],
        },
      });

      if (response.candidates.length === 0 || !response.candidates[0].content) {
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
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
