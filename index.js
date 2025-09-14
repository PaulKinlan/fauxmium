import http from "http";
import puppeteer from "puppeteer";
import { startServer } from "./server.js";

async function setupRequestInterception(page) {
  // Enable request interception
  await page.setRequestInterception(true);

  // Listen for 'request' events
  page.on("request", async (request) => {
    // Check if the request URL matches a specific pattern
    const resourceType = request.resourceType();
    const url = request.url();
    const method = request.method();
    const headers = request.headers();

    // Waiting on https://chromium-review.googlesource.com/c/chromium/src/+/6945075 - Thank you Andrey
    const newHeaders = { ...headers, Referer: "" };

    if (method === "GET" && request.isNavigationRequest()) {
      // This is a hack because a 2nd navigation results in Chrome blocking the request.

      const proxyUrl = `http://${hostname}:${port}/html?url=${encodeURIComponent(
        url
      )}&type=${resourceType}&headers=${encodeURIComponent(
        JSON.stringify(headers)
      )}`;
      console.log(`Redirecting request from ${url} to ${proxyUrl}`);
      console.log("Resource Type", resourceType);
      console.log("BEFORE", request.interceptResolutionState());
      // Continue the request with the new URL
      await request.continue({
        url: proxyUrl,
        headers: newHeaders,
      });

      console.log("AFTER", request.interceptResolutionState());
    } else {
      if (resourceType === "image") {
        const proxyUrl = `http://${hostname}:${port}/image?url=${encodeURIComponent(
          url
        )}&type=${resourceType}&headers=${encodeURIComponent(
          JSON.stringify(headers)
        )}`;
        console.log(`Redirecting image request from ${url} to ${proxyUrl}`);
        console.log("Resource Type", resourceType);
        console.log("BEFORE", request.interceptResolutionState());

        // new way

        await request.continue({
          url: proxyUrl,
          headers: newHeaders,
        });

        console.log("AFTER", request.interceptResolutionState());
        return;
      } else {
        // For all other requests, continue without changes
        await request.respond("");
      }
    }
  });
}

// Main function to launch Puppeteer and set up interception
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    devtools: true,
  });

  const pages = await browser.pages();

  for (const page of pages) {
    page.setDefaultNavigationTimeout(0);
    await setupRequestInterception(page);
  }
})();

const hostname = "127.0.0.1";
const port = 3001;
const API_KEY = process.env.GEMINI_API_KEY;

startServer(hostname, port, API_KEY);
