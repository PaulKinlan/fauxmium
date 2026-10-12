import { costCalculator } from "../lib/costCalculator.js";
import { generatePrompt } from "../lib/prompts.js";
import { streamCodeBlocks } from "../lib/streamCodeBlocks.js";
import { processChunks } from "../lib/processChunks.js";
import { streamText } from "../lib/aiAdapter.js";
import {
  sessionState,
  recordNavigation,
  getFormattedSessionHistory,
  getActiveLensInstruction,
} from "../lib/sessionState.js";
import { cacheHtml, getCachedHtml } from "../lib/imageCache.js";

export async function processHTML(req, res, url, textConfig) {
  let contentType = "text/html; charset=utf-8";
  res.setHeader("Content-Type", contentType);

  const requestUrl = url.searchParams.get("url") || "";
  const requestType = url.searchParams.get("type") || "document";
  const requestHeaders = url.searchParams.get("headers");
  const viewportWidth = url.searchParams.get("viewportWidth") || "1280";
  const viewportHeight = url.searchParams.get("viewportHeight") || "800";
  const colorScheme = url.searchParams.get("colorScheme") || "light";
  const postData = url.searchParams.get("postData") || "";
  const isRefresh = url.searchParams.get("refresh") === "1";

  let headersObj = {};
  try {
    headersObj = JSON.parse(requestHeaders || "{}");
  } catch (e) {
    console.warn("Failed to parse request headers:", e);
  }

  // Use current active lens from sessionState
  const activeLens = sessionState.activeLens || "modern";
  const htmlCacheKey = `${activeLens}:${requestUrl}`;
  const cacheControl =
    req.headers?.["cache-control"] ||
    headersObj["cache-control"] ||
    headersObj["Cache-Control"] ||
    "";
  const bypassCache =
    isRefresh ||
    cacheControl.includes("no-cache") ||
    cacheControl.includes("max-age=0");

  // 1. Check HTML Page Cache (instant back/forward navigation)
  if (!bypassCache && !postData) {
    const cachedHtml = getCachedHtml(htmlCacheKey);
    if (cachedHtml) {
      console.log(`[html] Serving cached page for: ${requestUrl} [Lens: ${activeLens}]`);
      const calc = costCalculator(textConfig.model, requestUrl, "text");
      calc({ cached: true, END: true });
      res.write(cachedHtml);
      res.end();
      return;
    }
  }

  const referer =
    url.searchParams.get("referer") ||
    headersObj.referer ||
    headersObj.Referer ||
    "None (direct navigation)";

  const acceptLanguage =
    headersObj["accept-language"] ||
    headersObj["Accept-Language"] ||
    "en-US";

  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) {}

  let country = "United States";
  try {
    const tzLower = timezone.toLowerCase();
    if (acceptLanguage) {
      const lang = acceptLanguage.split(",")[0].trim();
      if (lang.includes("-")) {
        const countryCode = lang.split("-")[1].toUpperCase();
        const countryNames = {
          US: "United States",
          GB: "United Kingdom",
          CA: "Canada",
          AU: "Australia",
          DE: "Germany",
          FR: "France",
          JP: "Japan",
          CN: "China",
          IN: "India",
          BR: "Brazil",
          MX: "Mexico",
          ES: "Spain",
          IT: "Italy",
          NL: "Netherlands",
        };
        if (countryNames[countryCode]) {
          country = countryNames[countryCode];
        }
      }
    }

    if (country === "United States" && timezone) {
      if (tzLower.includes("america/")) {
        if (tzLower.includes("new_york") || tzLower.includes("chicago") || tzLower.includes("los_angeles")) country = "United States";
        else if (tzLower.includes("toronto") || tzLower.includes("vancouver")) country = "Canada";
        else if (tzLower.includes("sao_paulo")) country = "Brazil";
        else if (tzLower.includes("mexico_city")) country = "Mexico";
      } else if (tzLower.includes("europe/")) {
        if (tzLower.includes("london")) country = "United Kingdom";
        else if (tzLower.includes("paris") || tzLower.includes("brussels")) country = "France";
        else if (tzLower.includes("berlin")) country = "Germany";
        else if (tzLower.includes("rome")) country = "Italy";
        else if (tzLower.includes("madrid")) country = "Spain";
      } else if (tzLower.includes("asia/")) {
        if (tzLower.includes("tokyo")) country = "Japan";
        else if (tzLower.includes("kolkata")) country = "India";
        else if (tzLower.includes("shanghai")) country = "China";
        else if (tzLower.includes("seoul")) country = "South Korea";
      } else if (tzLower.includes("australia/")) {
        country = "Australia";
      }
    }
  } catch (e) {}

  console.log(`[html] Generating content for: ${requestUrl} [Lens: ${activeLens}]`);
  try {
    const prompt = await generatePrompt("html", {
      requestUrl,
      requestType,
      requestHeaders,
      viewportWidth,
      viewportHeight,
      colorScheme,
      referer,
      postData: postData || "None",
      sessionHistory: getFormattedSessionHistory(),
      lensInstruction: getActiveLensInstruction(),
      acceptLanguage,
      timezone,
      country,
    });

    const response = streamText(textConfig, prompt);
    const calc = costCalculator(textConfig.model, requestUrl, "text");

    const outputStream = processChunks(
      [calc],
      streamCodeBlocks("html"),
      response
    );

    let fullHtml = "";

    for await (const codeChunk of outputStream) {
      fullHtml += codeChunk;
      res.write(codeChunk);
    }

    // Cache the successfully generated page for instant Back/Forward navigation
    if (fullHtml.trim()) {
      cacheHtml(htmlCacheKey, fullHtml);
      recordNavigation({
        url: requestUrl,
        method: postData ? "POST" : "GET",
        postData: postData || null,
      });
    }

    res.end();
  } catch (error) {
    console.error(`Failed to generate content for ${requestUrl}:`, error);
    res.end(
      `<!DOCTYPE html><html><head><title>Generation Error</title><style>body{font-family:sans-serif;padding:40px;background:#181824;color:#f0f2f5;}pre{background:#2a2b3d;padding:16px;border-radius:8px;overflow-x:auto;color:#ff8b94;}</style></head><body><h1>Fauxmium Generation Error</h1><p>Failed to generate content for <code>${requestUrl}</code></p><pre>${error.message}</pre></body></html>`
    );
  }
}
