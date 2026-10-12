/**
 * Dynamic in-page API and Element Remix handler
 * - Handles Alt+Click Element Remix requests (action=remix)
 * - Synthesizes dynamic, contextual JSON for in-page fetch() and XHR calls (/api/*)
 */

import { generateTextDirect } from "../lib/aiAdapter.js";
import { sessionState, getActiveLensInstruction } from "../lib/sessionState.js";
import { getFormattedSiteProfile } from "../lib/siteMemory.js";

/**
 * Helper to parse request body (JSON or text)
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<any>}
 */
function readRequestBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        // 1MB safety cap
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        // Fallback for form-encoded or raw text
        try {
          const params = new URLSearchParams(body);
          const obj = {};
          for (const [k, v] of params.entries()) {
            obj[k] = v;
          }
          resolve(obj);
        } catch {
          resolve({ text: body });
        }
      }
    });
    req.on("error", () => resolve({}));
  });
}

/**
 * Clean LLM response text from code fences and thinking tags
 * @param {string} text
 * @returns {string}
 */
function cleanOutput(text) {
  if (!text) return "";
  let clean = text
    .replace(/<think[\s>][\s\S]*?<\/think>/gi, "")
    .replace(/<think[\s>][\s\S]*$/gi, "")
    .trim();

  // Strip code fences if wrapped
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```[a-z0-9_-]*\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return clean;
}

/**
 * Process /api and /api/* requests
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 * @param {URL} parsedUrl
 * @param {Object} textConfig
 */
export async function processAPI(req, res, parsedUrl, textConfig) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const body = req.method === "POST" || req.method === "PUT" ? await readRequestBody(req) : {};
    const action = parsedUrl.searchParams.get("action") || body.action;

    // 1. Element Remix: Alt+Click in-page wand
    if (action === "remix") {
      const currentHtml = body.currentHtml || parsedUrl.searchParams.get("currentHtml") || "";
      const prompt = body.prompt || parsedUrl.searchParams.get("prompt") || "Make this look modern and interactive";
      const pageUrl = body.url || parsedUrl.searchParams.get("url") || "";

      const activeLens = sessionState.activeLens || "modern";
      const lensInstruction = getActiveLensInstruction(activeLens, sessionState.customLensPrompt);
      const siteProfile = getFormattedSiteProfile(pageUrl);

      const systemPrompt = `You are an expert web UI engineer. The user wants to modify and remix a specific HTML element on a webpage.
Return ONLY the modified HTML snippet for the element. Do not include markdown code fences, do not include reasoning or explanations.
Preserve relevant classes, IDs, and attributes unless the user requested them changed.
Adhere strictly to the browsing lens aesthetic:
${lensInstruction}`;

      const userPrompt = `Page URL: ${pageUrl}
Site Design DNA:
${siteProfile}

Original HTML element:
${currentHtml}

User's Remix Request:
${prompt}

Modified HTML element:`;

      const result = await generateTextDirect(textConfig, {
        system: systemPrompt,
        prompt: userPrompt,
      });

      const remixedHtml = cleanOutput(result.text);

      res.writeHead(200);
      res.end(
        JSON.stringify({
          ok: true,
          action: "remix",
          html: remixedHtml,
        })
      );
      return;
    }

    // 2. Dynamic in-page JSON API Synthesis
    const endpoint = parsedUrl.pathname.replace(/^\/api/, "") || "/";
    const pageUrl = parsedUrl.searchParams.get("pageUrl") || body.pageUrl || "";
    const activeLens = sessionState.activeLens || "modern";
    const lensInstruction = getActiveLensInstruction(activeLens, sessionState.customLensPrompt);
    const siteProfile = getFormattedSiteProfile(pageUrl);

    const queryParamsObj = {};
    for (const [k, v] of parsedUrl.searchParams.entries()) {
      if (k !== "pageUrl" && k !== "action") queryParamsObj[k] = v;
    }

    const systemPrompt = `You are a high-fidelity REST API backend synthesizer. Given an API route, HTTP method, query parameters, request payload, and website context, generate realistic, rich JSON data matching the user's application needs.
Return ONLY valid, parseable JSON. Do not wrap in markdown backticks. Do not include explanations.`;

    const userPrompt = `Endpoint: ${endpoint}
HTTP Method: ${req.method}
Query Parameters: ${JSON.stringify(queryParamsObj)}
Request Body: ${JSON.stringify(body)}
Browsing Lens: ${activeLens} (${lensInstruction})
Site DNA / Context: ${siteProfile}

Generate a realistic JSON response for this API request:`;

    const result = await generateTextDirect(textConfig, {
      system: systemPrompt,
      prompt: userPrompt,
    });

    const cleaned = cleanOutput(result.text);

    let parsedJson;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      // If LLM returned text that couldn't parse directly, format into JSON
      parsedJson = {
        data: cleaned,
        endpoint,
        timestamp: new Date().toISOString(),
      };
    }

    res.writeHead(200);
    res.end(JSON.stringify(parsedJson, null, 2));
  } catch (err) {
    console.error("[api] Error processing API request:", err);
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
