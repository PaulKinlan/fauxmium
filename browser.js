import fs from "node:fs/promises";
import puppeteer from "puppeteer";

export async function startBrowser({ hostname, port, token, models, devtools = false, headless = false }) {
  const browser = await puppeteer.launch({ headless, defaultViewport: null, devtools });
  const configured = new WeakSet();
  const host = hostname.includes(":") ? `[${hostname}]` : hostname;
  const proxy = `http://${host}:${port}`;

  async function setupRequestInterception(page) {
    if (!page || configured.has(page)) return;
    configured.add(page);
    page.setDefaultNavigationTimeout(180000);
    await page.setBypassServiceWorker(true);
    page.on("request", async (request) => {
      try {
        if (request.isInterceptResolutionHandled()) return;
        const url = new URL(request.url());
        const type = request.resourceType();
        if (["data:", "blob:"].includes(url.protocol) && ["image", "media"].includes(type)) {
          await request.continue();
          return;
        }
        const route = request.isNavigationRequest() ? "html"
          : type === "image" && models.image ? "image"
          : type === "media" && models.video && /\.(mp4|webm)$/i.test(url.pathname) ? "video" : null;
        if (request.method() !== "GET" || !/^https?:$/.test(url.protocol) || !route) {
          await request.abort("blockedbyclient");
          return;
        }
        const headers = request.headers();
        const params = new URLSearchParams({ url: url.href });
        if (route === "html" && headers["accept-language"]) params.set("language", headers["accept-language"]);
        // Only the private transport token and byte range reach the local proxy.
        // Cookies, authorization, referrers and other site headers never reach a model.
        await request.continue({
          url: `${proxy}/${route}?${params}`,
          headers: {
            authorization: `Bearer ${token}`,
            referer: "", // Clear the original origin during URL rewriting.
            ...(route !== "html" && headers.range ? { range: headers.range } : {}),
          },
        });
      } catch {
        if (!request.isInterceptResolutionHandled()) await request.abort().catch(() => {});
      }
    });
    await page.setRequestInterception(true);
  }

  try {
    browser.on("targetcreated", (target) => {
      if (target.type() !== "page") return;
      target.page().then(setupRequestInterception).catch(() => {
        console.error("Could not configure a new tab; closing it");
        target.page().then((page) => page?.close()).catch(() => {});
      });
    });
    const warningHtml = await fs.readFile(new URL("./pages/warning.html", import.meta.url), "utf8");
    for (const page of await browser.pages()) {
      await setupRequestInterception(page);
      await page.setContent(warningHtml);
    }
    return browser;
  } catch (error) {
    await browser.close();
    throw error;
  }
}
