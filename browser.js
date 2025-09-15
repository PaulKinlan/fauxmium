import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";

function startBrowser(hostname, port, devtools) {
  // Main function to launch Puppeteer and set up interception
  (async () => {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      devtools,
    });

    browser.on("targetcreated", async (target) => {
      if (target.type() === "page") {
        const newPage = await target.page();
        await setupRequestInterception(newPage);
      }
    });

    const pages = await browser.pages();

    const warningHtml = await fs.readFile(
      path.join(process.cwd(), "pages", "warning.html"),
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

      console.log("BEFORE", request.interceptResolutionState());

      await request.continue({
        url: proxyUrl,
        headers: newHeaders,
      });

      console.log("AFTER", request.interceptResolutionState());
    });
  }
}

export { startBrowser };
