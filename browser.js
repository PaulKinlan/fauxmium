import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { isAllowedDomain } from "./config/allowedDomains.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track the active URL per page for coherent Referer headers
const pageUrlMap = new WeakMap();

function startBrowser(hostname, port, devtools) {
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
      try {
        if (target.type() === "page") {
          const newPage = await target.page();
          if (newPage) {
            newPage.on("console", (msg) => console.log(`[Browser Console] ${msg.text()}`));
            newPage.on("pageerror", (err) => console.error(`[Browser Page Error] ${err.toString()}`));
            await injectProgressAndSkeletons(newPage);
            await setupRequestInterception(newPage);
          }
        }
      } catch (e) {
        console.warn("Failed to setup request interception for new target:", e.message);
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
      page.on("console", (msg) => console.log(`[Browser Console] ${msg.text()}`));
      page.on("pageerror", (err) => console.error(`[Browser Page Error] ${err.toString()}`));
      await injectProgressAndSkeletons(page);
      await setupRequestInterception(page);
      await page.setContent(warningHtml);
    }
  })();

  /**
   * Injects CSS skeletons and a top-of-viewport progress bar on click/submit
   */
  async function injectProgressAndSkeletons(page) {
    try {
      await page.evaluateOnNewDocument(() => {
        let bar = null;
        function mountUI() {
          const root = document.documentElement || document.head || document.body;
          if (!root) return;
          if (!document.getElementById("faux-skeleton-style")) {
            const style = document.createElement("style");
            style.id = "faux-skeleton-style";
            style.textContent = `
              #faux-progress-bar {
                position: fixed;
                top: 0;
                left: 0;
                height: 3px;
                width: 0%;
                background: linear-gradient(90deg, #ff8b94, #a8e6cf, #70a1ff);
                z-index: 2147483647;
                transition: width 0.3s ease, opacity 0.5s ease;
                box-shadow: 0 0 10px rgba(112, 161, 255, 0.7);
                pointer-events: none;
              }
              img:not([src]), img[src=""], video:not([src]) {
                min-height: 80px;
                background: linear-gradient(90deg, #1a1b26 25%, #282a3a 50%, #1a1b26 75%);
                background-size: 200% 100%;
                animation: faux-shimmer 1.8s infinite;
                border-radius: 6px;
              }
              @keyframes faux-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
              }
            `;
            root.appendChild(style);
          }
          if (!document.getElementById("faux-progress-bar")) {
            bar = document.createElement("div");
            bar.id = "faux-progress-bar";
            root.appendChild(bar);
          } else {
            bar = document.getElementById("faux-progress-bar");
          }
        }

        function triggerProgress() {
          mountUI();
          if (!bar) return;
          bar.style.width = "40%";
          bar.style.opacity = "1";
          setTimeout(() => {
            if (bar && bar.style.width === "40%") bar.style.width = "75%";
          }, 600);
        }

        mountUI();
        window.addEventListener("DOMContentLoaded", mountUI);

        window.addEventListener("click", (e) => {
          const a = e.target?.closest?.("a");
          if (a && a.href && !a.href.startsWith("#") && !a.href.startsWith("javascript:")) {
            triggerProgress();
          }
        }, true);

        window.addEventListener("submit", () => {
          triggerProgress();
        }, true);

        window.addEventListener("beforeunload", () => {
          triggerProgress();
        });
      });
    } catch (e) {
      console.warn("Failed to inject progress bar script:", e.message);
    }
  }

  async function setupRequestInterception(page) {
    page.setDefaultNavigationTimeout(0);
    await page.setRequestInterception(true);

    page.on("request", async (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      const method = request.method();
      const headers = request.headers();

      const newHeaders = { ...headers, Referer: "" };

      // Allow requests to the local Fauxmium server directly
      if (url.startsWith(`http://${hostname}:${port}/`)) {
        await request.continue();
        return;
      }

      // Whitelisted third-party CDNs and Google/Bunny fonts
      if (isAllowedDomain(url)) {
        const hName = new URL(url).hostname;
        console.log(`Allowing whitelisted asset: ${hName}`);
        await request.continue();
        return;
      }

      const isNav = request.isNavigationRequest();
      const isAudio =
        /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url) ||
        url.includes("/audio/") ||
        url.includes("type=speech") ||
        url.includes("type=music") ||
        url.includes("type=sfx") ||
        url.includes("type=ambient") ||
        url.includes("type=chiptune") ||
        (headers.accept && headers.accept.includes("audio/"));

      // Allow audio requests via fetch or audio tags
      if (
        !isNav &&
        resourceType !== "image" &&
        resourceType !== "media" &&
        !(isAudio && (resourceType === "fetch" || resourceType === "xhr"))
      ) {
        await request.respond("");
        return;
      }

      // Handle POST form submissions on navigations
      let postData = "";
      if (isNav && method === "POST") {
        postData = request.postData() || "";
        console.log(`[browser] Intercepted POST navigation to ${url}, payload: ${postData.substring(0, 80)}`);
      } else if (!isNav && method !== "GET") {
        await request.respond("");
        return;
      }

      let colorScheme = "light";
      let viewportWidth = 1280;
      let viewportHeight = 800;
      const vp = page.viewport();
      if (vp) {
        viewportWidth = vp.width;
        viewportHeight = vp.height;
      }

      // Track navigational referer
      const previousUrl = pageUrlMap.get(page) || headers.referer || "";
      if (isNav) {
        pageUrlMap.set(page, url);
      }

      let proxyUrl = "";
      if (isNav) {
        proxyUrl = `http://${hostname}:${port}/html?url=${encodeURIComponent(
          url
        )}&type=${resourceType}&headers=${encodeURIComponent(
          JSON.stringify(headers)
        )}&viewportWidth=${viewportWidth}&viewportHeight=${viewportHeight}&colorScheme=${colorScheme}&referer=${encodeURIComponent(
          previousUrl
        )}&postData=${encodeURIComponent(postData)}`;
      } else if (resourceType === "image") {
        proxyUrl = `http://${hostname}:${port}/image?url=${encodeURIComponent(
          url
        )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
      } else if (isAudio || (resourceType === "media" && isAudio)) {
        proxyUrl = `http://${hostname}:${port}/audio?url=${encodeURIComponent(
          url
        )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
      } else if (resourceType === "media") {
        proxyUrl = `http://${hostname}:${port}/video?url=${encodeURIComponent(
          url
        )}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
      }

      console.log(`Redirecting ${resourceType} -> ${proxyUrl.substring(0, 80)}...`);

      // Always continue navigation as a GET to the proxy
      await request.continue({
        method: "GET",
        url: proxyUrl,
        headers: newHeaders,
        postData: undefined,
      });
    });
  }
}

export { startBrowser };
