import puppeteer from "puppeteer";
import crypto from "crypto"; // Used to generate a unique ID for the blob
import { GoogleGenAI } from "@google/genai";

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

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const client = await page.target().createCDPSession();

  // Enable the Fetch domain to intercept requests
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
    const { requestId, request, interceptionId, resourceType } = event;

    console.log(`Request paused`, requestId, event);

    try {
      console.log(`Intercepted response for request: ${requestId}`);
      const url = request.url;

      if (resourceType == "Document") {
        try {
          let prompt;
          let contentType;
          let model = "gemini-2.5-flash-lite"; // Default model

          prompt = `Create the HTML for a web page that would be served at the URL: ${url}. The page should be visually appealing and relevant to the URL.
        
        Relevant details about the request:
        
        - URL: ${url}
        - Resource Type: ${resourceType}
        - Headers: ${JSON.stringify(request.headers, null, 2)}
        
        Response requirements:
        - Please ensure the HTML is well-structured and includes modern web design practices. 
        - Include basic CSS styles within a <style> tag in the <head> section.
        - Only return the HTML content (inside a code fence) without any additional explanations`;
          contentType = "text/html";

          console.log(`Generating content for: ${url} (${resourceType})`);
          const response = await ai.models.generateContentStream({
            model,
            contents: prompt,
          });

          const htmlCodeStream = streamCodeBlocks("html", response);
          // Clean up the response from Gemini, which often includes markdown fences
          for await (const codeChunk of htmlCodeStream) {
            console.log("Received code chunk:", codeChunk);
            // This will only log the parts inside the fences, like:
            // "<div>\n  <p>Hello"
            // " World!</p>\n</div>"
            const { stream: modifiedStreamHandle } = await client.send(
              "IO.createBlob",
              {
                buffer: Buffer.from(codeChunk).toString("base64"),
                mimeType: "text/html",
              }
            );

            console.log(modifiedStreamHandle);
          }
        } catch (error) {
          console.error(`Failed to generate content for:`, error);
        }
      }

      // Fulfill the request with the new stream handle
      await client.send("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders,
        body: modifiedStreamHandle, // Pass the stream handle for the modified body
      });

      // // Take the original response body as a stream
      // const { stream } = await client.send("Fetch.takeResponseBodyAsStream", {
      //   requestId,
      // });

      // // Read the original stream content
      // const originalContent = await readStream(client, stream);
      // console.log(
      //   "Original content:",
      //   originalContent.substring(0, 50) + "..."
      // );

      // Create a new stream (blob) for the modified content

      console.log(`Fulfilled request ${requestId} with modified content.`);
    } catch (error) {
      console.error(`Error handling request ${requestId}:`, error);
      // In case of an error, fail the request
      await client.send("Fetch.failRequest", { interceptionId });
    }
  });

  // Navigate to a page that triggers the request you want to intercept
  await page.goto("https://paul.kinlan.me/");

  await page.waitForTimeout(5000); // Give the script time to execute
  //await browser.close();
})();
