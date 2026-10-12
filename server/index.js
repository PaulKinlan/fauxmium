import http from "http";
import { processHTML } from "./processHTML.js";
import { processImage } from "./processImage.js";
import { processVideo } from "./processVideo.js";
import { processAudio } from "./processAudio.js";
import { sessionCosts, loadCosts, resetSessionCosts, syncGeminiModels } from "../lib/costCalculator.js";
import {
  sessionState,
  initSessionState,
  updateSessionConfig,
  getSessionConfig,
} from "../lib/sessionState.js";
import { clearAllCaches, getCacheStats } from "../lib/imageCache.js";

export async function startServer(
  hostname,
  port,
  textConfig,
  imageConfig,
  videoConfig,
  audioConfig,
  extraConfig = {}
) {
  initSessionState({
    textConfig,
    imageConfig,
    videoConfig,
    audioConfig,
    activeLens: extraConfig.activeLens || "modern",
    customLensPrompt: extraConfig.customLensPrompt || "",
  });

  const forceSync = Boolean(extraConfig.syncModels);

  if (forceSync) {
    const syncKey =
      textConfig?.apiKey ||
      imageConfig?.apiKey ||
      videoConfig?.apiKey ||
      audioConfig?.apiKey;
    syncGeminiModels({ apiKey: syncKey, forceSync }).catch(() => {});
  }

  // Initialize model costs asynchronously
  try {
    if (textConfig?.model) {
      await loadCosts(textConfig.model, { forceSync });
    }
  } catch (e) {
    console.warn(`[costs] Failed to initialize costs for model '${textConfig?.model}':`, e.message);
  }

  try {
    if (imageConfig?.model) {
      await loadCosts(imageConfig.model, { forceSync });
    }
  } catch (e) {
    console.warn(`[costs] Failed to initialize costs for model '${imageConfig?.model}':`, e.message);
  }

  try {
    if (videoConfig?.model) {
      await loadCosts(videoConfig.model, { forceSync });
    }
  } catch (e) {
    console.warn(`[costs] Failed to initialize costs for model '${videoConfig?.model}':`, e.message);
  }

  try {
    if (audioConfig?.model) {
      await loadCosts(audioConfig.model, { forceSync });
    }
  } catch (e) {
    console.warn(`[costs] Failed to initialize costs for model '${audioConfig?.model}':`, e.message);
  }

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || `${hostname}:${port}`}`);

    // A generation outlives the browser unless something stops it: without a
    // signal, navigating away left the provider generating (and billing) to
    // completion. Abort THIS request's upstream work when its socket closes
    // before the response finished — `close` fires for completed responses too,
    // hence the writableFinished gate.
    const upstream = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) {
        console.log(`Client disconnected before completion: ${url.pathname} — aborting upstream work`);
        upstream.abort(new Error("client disconnected"));
      }
    });
    const options = { abortSignal: upstream.signal };

    try {
      if (url.pathname === "/html") {
        await processHTML(req, res, url, sessionState.textConfig, options);
      } else if (url.pathname === "/image") {
        await processImage(res, url, sessionState.imageConfig, options);
      } else if (url.pathname === "/video") {
        await processVideo(req, res, url, sessionState.videoConfig, options);
      } else if (url.pathname === "/audio") {
        await processAudio(req, res, url, sessionState.audioConfig, options);
      } else if (url.pathname === "/cost") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(sessionCosts, null, 2));
      } else if (url.pathname === "/cost/reset" && req.method === "POST") {
        resetSessionCosts();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, sessionCosts }, null, 2));
      } else if (url.pathname === "/config" && req.method === "GET") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(getSessionConfig(), null, 2));
      } else if (url.pathname === "/config" && req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
        }
        let parsed = {};
        try {
          parsed = JSON.parse(body || "{}");
        } catch {}

        const updated = updateSessionConfig(parsed);

        // Preload any newly selected models
        if (parsed.text?.model) loadCosts(parsed.text.model);
        if (parsed.image?.model) loadCosts(parsed.image.model);
        if (parsed.video?.model) loadCosts(parsed.video.model);
        if (parsed.audio?.model) loadCosts(parsed.audio.model);

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, config: updated }, null, 2));
      } else if (url.pathname === "/cache/clear" && req.method === "POST") {
        const stats = clearAllCaches();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, cleared: stats }, null, 2));
      } else if (url.pathname === "/cache/stats" && req.method === "GET") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(getCacheStats(), null, 2));
      } else {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain");
        res.end("Not Found");
      }
    } catch (err) {
      console.error(`[server] Uncaught route error on ${url.pathname}:`, err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(port, hostname, () => {
    console.log(`Fauxmium proxy server running at http://${hostname}:${port}/`);
  });

  // Return the handle: the caller owns the resource, and tests need to close it.
  // (Nothing used the return value before; the CLI simply never shut it down.)
  return server;
}
