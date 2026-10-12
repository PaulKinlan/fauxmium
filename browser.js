import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { isAllowedDomain } from "./config/allowedDomains.js";
import { recordLinkContext } from "./lib/siteMemory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track the active URL and preferred color scheme per page
const pageUrlMap = new WeakMap();
const pageColorSchemeMap = new WeakMap();

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
      try {
        await page.exposeFunction("__fauxmiumUpdateColorScheme", (scheme) => {
          if (scheme === "dark" || scheme === "light") {
            pageColorSchemeMap.set(page, scheme);
          }
        });
      } catch (err) {}

      try {
        await page.exposeFunction("__fauxmiumCaptureClick", (ctx) => {
          if (ctx?.colorScheme) {
            pageColorSchemeMap.set(page, ctx.colorScheme);
          }
          recordLinkContext(ctx);
        });
      try {
        await page.exposeFunction("__fauxmiumRemixElement", async (payload) => {
          try {
            const res = await fetch(`http://${hostname}:${port}/api?action=remix`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            return await res.json();
          } catch (e) {
            return { ok: false, error: e.message };
          }
        });
      } catch (err) {}

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
              .faux-remix-highlight {
                outline: 2px dashed #a855f7 !important;
                outline-offset: 2px !important;
                cursor: crosshair !important;
              }
              #faux-remix-badge {
                position: fixed;
                background: #1e1b4b;
                color: #c084fc;
                border: 1px solid #a855f7;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 11px;
                font-weight: 600;
                padding: 3px 8px;
                border-radius: 9999px;
                pointer-events: none;
                z-index: 2147483646;
                display: none;
                box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
              }
              #faux-remix-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(4px);
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: system-ui, -apple-system, sans-serif;
              }
              #faux-remix-card {
                background: #0f172a;
                border: 1px solid #334155;
                color: #f8fafc;
                border-radius: 12px;
                padding: 20px;
                width: 90%;
                max-width: 480px;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5);
              }
              #faux-remix-card h3 {
                margin: 0 0 12px 0;
                font-size: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                color: #c084fc;
              }
              #faux-remix-card textarea {
                width: 100%;
                box-sizing: border-box;
                background: #1e293b;
                border: 1px solid #475569;
                border-radius: 8px;
                color: #fff;
                padding: 10px;
                font-size: 14px;
                resize: vertical;
                min-height: 80px;
                font-family: inherit;
              }
              #faux-remix-card textarea:focus {
                outline: 2px solid #a855f7;
                border-color: transparent;
              }
              #faux-remix-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 14px;
              }
              .faux-remix-btn {
                padding: 7px 14px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border: none;
              }
              .faux-remix-cancel {
                background: #334155;
                color: #cbd5e1;
              }
              .faux-remix-submit {
                background: linear-gradient(135deg, #9333ea, #6366f1);
                color: #fff;
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
          if (!document.getElementById("faux-remix-badge")) {
            const badge = document.createElement("div");
            badge.id = "faux-remix-badge";
            badge.textContent = "✨ Alt+Click to Remix";
            root.appendChild(badge);
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

        // Alt+Click Element Remix wand handlers
        let altPressed = false;
        let lastHovered = null;

        window.addEventListener("keydown", (e) => {
          if (e.key === "Alt" && !altPressed) {
            altPressed = true;
          }
        });

        window.addEventListener("keyup", (e) => {
          if (e.key === "Alt") {
            altPressed = false;
            if (lastHovered) {
              lastHovered.classList.remove("faux-remix-highlight");
              lastHovered = null;
            }
            const badge = document.getElementById("faux-remix-badge");
            if (badge) badge.style.display = "none";
          }
        });

        window.addEventListener("mousemove", (e) => {
          const badge = document.getElementById("faux-remix-badge");
          if (!altPressed) {
            if (badge) badge.style.display = "none";
            return;
          }
          const target = e.target?.closest?.("div, section, article, header, footer, aside, nav, button, p, h1, h2, h3, h4, li, form, main, a");
          if (target && !target.closest("#faux-remix-modal") && !target.closest("#faux-progress-bar")) {
            if (lastHovered && lastHovered !== target) {
              lastHovered.classList.remove("faux-remix-highlight");
            }
            lastHovered = target;
            target.classList.add("faux-remix-highlight");
            if (badge) {
              badge.style.display = "block";
              badge.style.left = `${e.clientX + 12}px`;
              badge.style.top = `${e.clientY + 12}px`;
            }
          }
        });

        function openRemixDialog(targetEl) {
          const root = document.body || document.documentElement;
          if (!root || document.getElementById("faux-remix-modal")) return;

          const modal = document.createElement("div");
          modal.id = "faux-remix-modal";
          modal.innerHTML = `
            <div id="faux-remix-card">
              <h3>✨ Element Remix Wand</h3>
              <p style="font-size:12px;color:#94a3b8;margin:0 0 10px 0;">Remixing <code>&lt;${targetEl.tagName.toLowerCase()}&gt;</code></p>
              <textarea id="faux-remix-prompt" placeholder="E.g. Add dark neon styling, interactive hover state, or convert into a rich micro-app card..." autofocus></textarea>
              <div id="faux-remix-actions">
                <button type="button" class="faux-remix-btn faux-remix-cancel" id="faux-remix-cancel-btn">Cancel</button>
                <button type="button" class="faux-remix-btn faux-remix-submit" id="faux-remix-submit-btn">✨ Remix</button>
              </div>
            </div>
          `;
          root.appendChild(modal);

          const textarea = modal.querySelector("#faux-remix-prompt");
          const cancelBtn = modal.querySelector("#faux-remix-cancel-btn");
          const submitBtn = modal.querySelector("#faux-remix-submit-btn");

          textarea?.focus();

          const closeModal = () => {
            modal.remove();
            if (lastHovered) {
              lastHovered.classList.remove("faux-remix-highlight");
              lastHovered = null;
            }
          };

          cancelBtn?.addEventListener("click", closeModal);
          modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
          });
          modal.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeModal();
          });

          submitBtn?.addEventListener("click", async () => {
            const promptVal = textarea?.value?.trim();
            if (!promptVal) return;
            submitBtn.disabled = true;
            submitBtn.textContent = "Remixing ✨...";

            try {
              if (window.__fauxmiumRemixElement) {
                const res = await window.__fauxmiumRemixElement({
                  currentHtml: targetEl.outerHTML,
                  prompt: promptVal,
                  url: window.location.href,
                });
                if (res && res.ok && res.html) {
                  const doSwap = () => {
                    const temp = document.createElement("div");
                    temp.innerHTML = res.html;
                    const newEl = temp.firstElementChild || temp;
                    targetEl.replaceWith(newEl);
                  };
                  if (document.startViewTransition) {
                    document.startViewTransition(doSwap);
                  } else {
                    doSwap();
                  }
                }
              }
            } catch (err) {
              console.error("[remix] Failed to remix element:", err);
            } finally {
              closeModal();
            }
          });
        }

        window.addEventListener("click", (e) => {
          if (e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target?.closest?.("div, section, article, header, footer, aside, nav, button, p, h1, h2, h3, h4, li, form, main, a") || e.target;
            if (target && !target.closest("#faux-remix-modal")) {
              openRemixDialog(target);
              return;
            }
          }
        }, true);

        try {
          const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
          window.__fauxmiumUpdateColorScheme?.(isDark ? "dark" : "light");
          window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", (e) => {
            window.__fauxmiumUpdateColorScheme?.(e.matches ? "dark" : "light");
          });
        } catch (e) {}

        window.addEventListener("click", (e) => {
          const a = e.target?.closest?.("a");
          if (a && a.href && !a.href.startsWith("#") && !a.href.startsWith("javascript:")) {
            triggerProgress();

            try {
              const card =
                a.closest("article, li, tr, [class*='card'], [class*='item'], [class*='video'], [class*='post'], section, div") || a;
              const payload = {
                targetUrl: a.href,
                sourceUrl: window.location.href,
                linkText: (a.innerText || a.getAttribute("aria-label") || a.title || "").trim().slice(0, 200),
                dataContext: a.getAttribute("data-context") || a.getAttribute("data-prompt") || "",
                cardTitle: (card.querySelector("h1, h2, h3, h4, [class*='title']")?.innerText || "").trim().slice(0, 200),
                cardSnippet: (card.innerText || "").replace(/\s+/g, " ").trim().slice(0, 350),
                cardImageSrc: (a.querySelector("img")?.src || card.querySelector("img")?.src || ""),
                colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
              };
              window.__fauxmiumCaptureClick?.(payload);
            } catch (err) {}
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

      // Allow requests to the local Fauxmium server and non-network schemes directly
      if (
        url.startsWith(`http://${hostname}:${port}/`) ||
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("chrome-extension:") ||
        url.startsWith("about:")
      ) {
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

      const isApi =
        (resourceType === "fetch" || resourceType === "xhr") &&
        (url.includes("/api/") ||
          url.includes("/api?") ||
          url.endsWith("/api") ||
          (headers.accept && headers.accept.includes("application/json")));

      // Allow audio requests and in-page API requests via fetch or xhr
      if (
        !isNav &&
        resourceType !== "image" &&
        resourceType !== "media" &&
        !(isAudio && (resourceType === "fetch" || resourceType === "xhr")) &&
        !isApi
      ) {
        await request.respond("");
        return;
      }

      // Handle in-page API JSON requests directly to proxy /api
      if (isApi) {
        try {
          const parsed = new URL(url);
          let apiPath = parsed.pathname;
          if (apiPath.startsWith("/api")) {
            apiPath = apiPath.substring(4);
          }
          const target = new URL(`http://${hostname}:${port}/api${apiPath}${parsed.search}`);
          const currentUrl = pageUrlMap.get(page) || "";
          if (currentUrl && !target.searchParams.has("pageUrl")) {
            target.searchParams.set("pageUrl", currentUrl);
          }
          console.log(`[browser] Redirecting in-page API ${method} ${url} -> ${target.toString()}`);
          await request.continue({
            url: target.toString(),
            headers: newHeaders,
          });
          return;
        } catch (e) {
          console.warn("[browser] Error routing API request:", e.message);
        }
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

      let colorScheme = pageColorSchemeMap.get(page) || "light";
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
