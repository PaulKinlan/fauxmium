import http from "http";
import puppeteer from "puppeteer";
import { startServer } from "../server.js";

// Load the API key from an environment variable

// const targetMap = new Map();

// // Attach the interceptor only once per page.
// const attach = async (target) => {
//   const client = await target.createCDPSession();
//   //targetMap.set(target._targetId, client);

//   console.log(`Attaching interceptor to page:`, target);
//   client.on("Fetch.requestPaused", async (event) => {
//     const { requestId, request, resourceType } = event;
//     console.log(`Fetch paused for: ${request.method} ${request.url}`);

//     if (resourceType === "Document") {
//       console.log(`Document request for URL: ${request.url}`);

//       await client.send("Fetch.continueRequest", {
//         requestId,
//         url: `http://${hostname}:${port}/test`,
//       });
//       console.log(`Request redirected to local server.`);
//     } else {
//       console.log(`Continuing request without modification.`);

//       await client.send("Fetch.continueRequest", { requestId });
//     }
//     console.log(`Request continued.`);
//   });

//   console.log("Enabling Fetch domain");
//   await client.send("Fetch.enable", {
//     patterns: [{ urlPattern: "*", requestStage: "Request" }],
//   });
// };

async function setupRequestInterception(page) {
  // Enable request interception
  await page.setRequestInterception(true);
  let shouldReload = false;

  // page.on("load", async () => {
  //   console.log("Page loaded:", page.url());
  //   // await page.setRequestInterception(false);
  //   // await page.setRequestInterception(true);
  // });
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
    await setupRequestInterception(page);
  }
})();

const hostname = "127.0.0.1";
const port = 3001;
const API_KEY = process.env.GEMINI_API_KEY;

startServer(hostname, port, API_KEY);
