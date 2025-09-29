import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function startBrowser(hostname, port, devtools) {
  // Main function to launch Puppeteer and set up interception
  (async () => {
    const extensionPath = path.join(__dirname, "extension");
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      devtools,
      pipe: true,
      enableExtensions: true,
    });

    browser.on("disconnected", () => {
      console.log("Browser disconnected. Exiting...");
      process.exit(0);
    });

    browser.on("targetcreated", async (target) => {
      if (target.type() === "page") {
        const newPage = await target.page();
        await setupRequestInterception(newPage);
      }
    });

    const pages = await browser.pages();

    const extension = await browser.installExtension(extensionPath);
    console.log(`Extension installed:`, extension);

    const cdpSession = await pages[0].createCDPSession();

    await cdpSession.send("Extensions.setStorageItems", {
      id: extension,
      storageArea: "local",
      values: {
        hostname: hostname,
        port: port,
      },
    });

    const warningHtml = await fs.readFile(
      path.join(__dirname, "pages", "warning.html"),
      "utf8"
    );

    for (const page of pages) {
      await setupRequestInterception(page);

      // Before the user starts to use the page, set up a warning to that they know it's not a real browser.
      page.setContent(warningHtml);
    }
  })();

  async function setupRequestInterception(page) {
    // Enable request interception
    page.setDefaultNavigationTimeout(0);
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

      if (url.startsWith(`http://${hostname}:${port}/`)) {
        await request.continue();
        return;
      }

      if (method !== "GET") {
        await request.respond("");
        return;
      }

      if (!request.isNavigationRequest() && resourceType !== "image") {
        await request.respond("");
        return;
      }

      let proxyUrl = "";

      if (request.isNavigationRequest()) {
        proxyUrl = `http://${hostname}:${port}/html?url=${encodeURIComponent(
          url
        )}&type=${resourceType}&headers=${encodeURIComponent(
          JSON.stringify(headers)
        )}`;
      } else if (resourceType === "image") {
        proxyUrl = `http://${hostname}:${port}/image?url=${encodeURIComponent(
          url
        )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
      }

      console.log(
        `Redirecting ${resourceType} request from ${url} to ${proxyUrl}`
      );

      await request.continue({
        url: proxyUrl,
        headers: newHeaders,
      });
    });
  }
}

export { startBrowser };
