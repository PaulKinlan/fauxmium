import http from "http";
import puppeteer from "puppeteer";
import { startServer } from "./server.js";

// Load the API key from an environment variable

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

// Main function to launch Puppeteer and set up interception
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
const API_KEY = process.env.GEMINI_API_KEY;

startServer(hostname, port, API_KEY);
