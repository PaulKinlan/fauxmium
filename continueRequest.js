import puppeteer from "puppeteer";
import { GoogleGenAI } from "@google/genai";

import http from "http";

// Load the API key from an environment variable
const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

async function* streamCodeBlocks(codeBlock, chunkStream) {
  const START_FENCE = "```" + codeBlock;
  const END_FENCE = "```";

  let buffer = "";
  let state = "OUTSIDE_FENCE";

  for await (const chunk of chunkStream) {
    // console.log("FENCE: Received chunk:", chunk.text);
    buffer += chunk.text;

    // Use a while loop because a single chunk might contain
    // multiple state transitions (e.g., an end fence AND a start fence).
    let keepProcessing = true;
    while (keepProcessing) {
      keepProcessing = false; // Assume we're done until a state change proves otherwise

      if (state === "OUTSIDE_FENCE") {
        const startIndex = buffer.indexOf(START_FENCE);

        if (startIndex !== -1) {
          // Found the start! Switch state and advance the buffer past the fence.
          state = "INSIDE_FENCE";
          buffer = buffer.substring(startIndex + START_FENCE.length);
          keepProcessing = true; // Re-run the loop immediately to check for an end fence
        }
        // If no start index, we do nothing. The buffer accumulates, and we wait for the next chunk.
      } else if (state === "INSIDE_FENCE") {
        const endIndex = buffer.indexOf(END_FENCE);

        if (endIndex !== -1) {
          // Found the end fence!
          // 1. Yield the code that came BEFORE the fence.
          const codeToYield = buffer.substring(0, endIndex);
          if (codeToYield) {
            yield codeToYield;
          }

          // 2. Switch state back to OUTSIDE.
          state = "OUTSIDE_FENCE";

          // 3. Advance the buffer PAST the end fence.
          buffer = buffer.substring(endIndex + END_FENCE.length);

          // 4. Re-run the loop in case a new start fence begins in this same chunk.
          keepProcessing = true;
        } else {
          // No end fence found in the current buffer.
          // We must yield *most* of the buffer, but hold back a few characters
          // in case the END_FENCE itself is split across chunks (e.g., buffer ends in "``", next chunk starts with "`").

          // Hold back chars equal to the fence length minus 1.
          const holdbackLength = END_FENCE.length - 1; // (e.g., holds back "``")

          if (buffer.length > holdbackLength) {
            const partToYield = buffer.substring(
              0,
              buffer.length - holdbackLength
            );
            yield partToYield;
            buffer = buffer.substring(buffer.length - holdbackLength);
          }
          // If the buffer is shorter than the holdback length, we yield nothing and
          // just wait for the next chunk to give us more data.
        }
      }
    }
  }

  // After the stream is finished, if we're still inside a fence
  // (meaning the stream ended without a closing ```), yield whatever is left.
  if (state === "INSIDE_FENCE" && buffer) {
    yield buffer;
  }
}

const targetMap = new Map();

const attach = async (target) => {
  console.log("Attaching to page:", target, target.url());

  if (target._targetId && targetMap.has(target._targetId)) {
    console.log("Already attached. Skipping attach.", target._targetId);
    return;
  }

  const client = await target.createCDPSession();
  targetMap.set(target._targetId, client);

  await client.send("Fetch.enable", {
    patterns: [
      {
        urlPattern: "*",
        requestStage: "Request",
      },
    ],
  });

  // Listen for the requestPaused event
  client.on("Fetch.requestPaused", async (event) => {
    const { requestId, request, resourceType } = event;

    console.log(
      `Request paused for: ${request.method} ${request.url}`,
      requestId
    );

    try {
      const url = request.url;

      if (resourceType == "Document") {
        console.log(`Continuing request for: ${url} (${resourceType})`);
        await client.send("Fetch.continueRequest", {
          requestId,
          url: `http://${hostname}:${port}/html?url=${encodeURIComponent(
            url
          )}&type=${resourceType}&headers=${encodeURIComponent(
            JSON.stringify(request.headers)
          )}`,
        });
        return;
      } else {
        // fail the request so it doesn't actually go out to the network
        console.log(`Aborting request for: ${url} (${resourceType})`);
        await client.send("Fetch.failRequest", {
          requestId,
          errorReason: "Aborted",
        });
        return;
      }
    } catch (error) {
      console.error(`Error handling request ${requestId}:`, error);
      // In case of an error, fail the request
      await client.send("Fetch.failRequest", { requestId });
    }
  });
};

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    devtools: true,
  });

  // Attach to all existing pages
  for (const target of browser.targets()) {
    console.log(target);
    if (target.type() !== "page") continue;
    await attach(target);
  }

  // Attach to any new pages that are created
  browser.on("targetchanged", async (target) => {
    // Enable the Fetch domain to intercept requests
    console.log("Target changed", target.url());
    // The targetchanged event is fired when the URL of a target changes.
    // We don't need to re-attach to the target, because the existing
    // CDP session will continue to work. Re-attaching can cause a race
    // condition where the navigation request is missed.
  });

  // Attach to any new pages that are created
  browser.on("targetcreated", async (target) => {
    // Enable the Fetch domain to intercept requests
    console.log("Target created", target.url());
    if (target._targetId && targetMap.has(target._targetId)) {
      // console.log("Detaching from", target._targetId);
      // const client = targetMap.get(target._targetId);
      // //await client.send("Fetch.disable");
      // await client.detach();
      // targetMap.delete(target._targetId);
    }

    await attach(target);
  });

  browser.on("targetdestroyed", async (target) => {
    console.log("Target destroyed", target.url());

    if (target._targetId && targetMap.has(target._targetId)) {
      console.log("Detaching from", target._targetId);
      const client = targetMap.get(target._targetId);
      await client.send("Fetch.disable");
      await client.detach();
      targetMap.delete(target._targetId);
    }
  });
})();

const hostname = "127.0.0.1";
const port = 3000;

const server = http.createServer(async (req, res) => {
  res.statusCode = 200;

  console.log("Processing Generative request for:", req.url);

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/html") {
    const requestUrl = url.searchParams.get("url");
    const requestType = url.searchParams.get("type");
    const requestHeaders = url.searchParams.get("headers");
    try {
      let prompt;
      let contentType;
      let model = "gemini-2.5-flash"; // Default model

      prompt = `Create the HTML for a web page that would be served at the URL: ${requestUrl}. The page should be visually appealing and relevant to the URL.
    
    Relevant details about the request:
    
    - URL: ${requestUrl}
    - Resource Type: ${requestType}
    - Headers: ${requestHeaders}
    
    Response requirements:
    - Please ensure the HTML is well-structured and includes modern web design practices. 
    - Prefer that links aren't # instead are full paths.
    - Links must not include target="_blank" or similar attributes.
    - Include basic CSS styles within a <style> tag in the <head> section.
    - Only return the HTML content (inside a code fence) without any additional explanations`;
      contentType = "text/html";

      console.log(`Generating content for: ${requestUrl} (${requestType})`);
      const response = await ai.models.generateContentStream({
        model,
        contents: prompt,
      });

      const htmlCodeStream = streamCodeBlocks("html", response);
      // Clean up the response from Gemini, which often includes markdown fences
      for await (const codeChunk of htmlCodeStream) {
        res.write(codeChunk);
      }

      res.end();
    } catch (error) {
      console.error(`Failed to generate content for:`, error);
    }
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
