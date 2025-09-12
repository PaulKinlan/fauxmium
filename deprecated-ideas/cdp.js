import puppeteer from "puppeteer";
import { startServer } from "../server.js";

(async () => {
  // 1. Launch a browser instance
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    devtools: true,
    args: [
      "--disable-features=HttpsFirstBalancedModeAutoEnable",
      "--disable-web-security",
    ],
  });

  let cdpSession = null;

  // 2. Define a function to create a new CDP session and enable Fetch
  async function setupFetchInterception(target) {
    // Detach from the old session if it exists to clean up resources
    if (cdpSession) {
      try {
        // this happens to late as well.
        await cdpSession.detach();
      } catch (e) {
        // Ignore "Target closed" error, as it's expected
      }
    }

    // Create a new CDP session for the new target
    cdpSession = await target.createCDPSession();
    console.log(`New CDP session created for: ${target.url()}`);

    // Enable the Fetch domain to intercept requests
    await cdpSession.send("Network.enable");

    await cdpSession.send("Fetch.enable", {
      patterns: [
        {
          urlPattern: "*",
          requestStage: "Request",
        },
      ],
    });

    // Set up the event listener for the new session
    cdpSession.on("Fetch.requestPaused", async (event) => {
      const { requestId, request, resourceType } = event;
      console.log(
        `Intercepting request: ${request.url} [${resourceType}] ${requestId}`
      );
      console.log(event);

      if (resourceType === "Document") {
        const proxyUrl = `http://${hostname}:${port}/html?url=${encodeURIComponent(
          request.url
        )}`;
        console.log(`Proxying document request to: ${proxyUrl}`);
        // Subsequent calls to this fail after a navigation.
        const response = await cdpSession.send("Fetch.continueRequest", {
          requestId,
          url: proxyUrl,
        });

        console.log(`Request ${requestId} proxied to local server.`, response);
        return;
      } else if (resourceType === "Image") {
        const proxyUrl = `http://${hostname}:${port}/test-image?url=${encodeURIComponent(
          request.url
        )}`;
        console.log(`Proxying image request to: ${proxyUrl}`);
        // Subsequent calls to this fail after a navigation.
        const response = await cdpSession.send("Fetch.continueRequest", {
          requestId,
          url: proxyUrl,
          interceptResponse: true,
        });

        console.log(`Request ${requestId} proxied to local server.`, response);
        return;
      }

      // Allow the request to continue without modification
      await cdpSession.send("Fetch.failRequest", {
        requestId,
        errorReason: "Aborted",
      });
    });

    cdpSession.on("Target.targetCrashed", (event) => {
      console.log("Target crashed", event);
    });

    cdpSession.on("Target.targetCreated", (event) => {
      console.log("Target created", event);
    });

    cdpSession.on("Target.targetInfoChanged", (event) => {
      console.log("Target info changed", event);
    });

    cdpSession.on("Target.attachedToTarget", (event) => {
      console.log("Target attached", event);
    });

    cdpSession.on("Target.detachedFromTarget", (event) => {
      console.log("Target detached", event);
    });
  }

  const pages = await browser.pages();

  for (const page of pages) {
    console.log(`Setting up interception for existing page: ${page.url()}`);
    await setupFetchInterception(page);
  }
})();

const hostname = "localhost";
const port = 3001;
const API_KEY = process.env.GEMINI_API_KEY;

startServer(hostname, port, API_KEY);
