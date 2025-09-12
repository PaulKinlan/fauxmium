import http from "http";
import puppeteer from "puppeteer";
import { startServer } from "./server.js";

async function setupRequestInterception(page) {
  // Enable request interception
  await page.setRequestInterception(true);
  let shouldReload = false;

  // Listen for 'request' events
  page.on("request", async (request) => {
    // Check if the request URL matches a specific pattern
    const resourceType = request.resourceType();
    const url = request.url();
    const method = request.method();
    const headers = request.headers();

    if (method === "GET" && request.isNavigationRequest()) {
      // This is a hack because a 2nd navigation results in Chrome blocking the request.
      if (shouldReload == true) {
        page.goto(url);
        shouldReload = false;
        return;
      }

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
      });
      shouldReload = true;

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
        await request.respond({
          status: response.statusCode,
          headers: response.headers,
          body: response.body,
        });
        console.log("AFTER", request.interceptResolutionState());
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
