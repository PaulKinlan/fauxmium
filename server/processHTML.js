import { costCalculator } from "../lib/costCalculator.js";
import { generatePrompt } from "../lib/prompts.js";
import { streamCodeBlocks } from "../lib/streamCodeBlocks.js";
import { processChunks } from "../lib/processChunks.js";
import { streamText } from "../lib/aiAdapter.js";

export async function processHTML(res, url, textConfig) {
  let contentType = "text/html";
  res.setHeader("Content-Type", contentType);
  const requestUrl = url.searchParams.get("url");
  const requestType = url.searchParams.get("type");
  const requestHeaders = url.searchParams.get("headers");
  const viewportWidth = url.searchParams.get("viewportWidth") || "1280";
  const viewportHeight = url.searchParams.get("viewportHeight") || "800";
  const colorScheme = url.searchParams.get("colorScheme") || "light";

  let headersObj = {};
  try {
    headersObj = JSON.parse(requestHeaders || "{}");
  } catch (e) {
    console.warn("Failed to parse request headers:", e);
  }

  const referer = headersObj.referer || headersObj.Referer || "None (direct navigation)";
  const acceptLanguage = headersObj["accept-language"] || headersObj["Accept-Language"] || "en-US";

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

  console.log(`Server generating content for: ${requestUrl}`);
  try {
    // We load the prompt from disk and interpolate values so that we can change it without restarting the server.
    const prompt = await generatePrompt("html", {
      requestUrl,
      requestType,
      requestHeaders,
      viewportWidth,
      viewportHeight,
      colorScheme,
      referer,
      acceptLanguage,
      timezone,
      country,
    });

    const response = streamText(textConfig, prompt);

    const calc = costCalculator(textConfig.model, requestUrl);

    const outputStream = processChunks(
      [
        // (chunk) => {
        //   console.log("Processing chunk:", JSON.stringify(chunk));
        // },
        calc,
      ],
      streamCodeBlocks("html"),
      response
    );

    for await (const codeChunk of outputStream) {
      res.write(codeChunk);
    }

    res.end();
  } catch (error) {
    console.error(`Failed to generate content for ${requestUrl}:`, error);
    res.end(
      `<html><body><h1>Error</h1><p>Failed to generate content for ${requestUrl}</p><pre>${error.message}</pre></body></html>`
    );
  }
}
