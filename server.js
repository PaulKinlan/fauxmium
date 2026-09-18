import http from "node:http";
import { once } from "node:events";
import { streamCodeBlocks } from "./lib/streamCodeBlocks.js";
import { generatePrompt } from "./lib/prompts.js";
import { costCalculator } from "./lib/costCalculator.js";
import { mediaCache } from "./lib/mediaCache.js";

function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

function sendMedia(req, res, { body, mimeType }) {
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("Accept-Ranges", "bytes");
  let start = 0;
  let end = body.length - 1;
  if (req.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
    } else start = -1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= body.length) {
      res.setHeader("Content-Range", `bytes */${body.length}`);
      fail(416, "Unsatisfiable byte range");
    }
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${body.length}`);
  }
  res.setHeader("Content-Length", end - start + 1);
  res.end(body.subarray(start, end + 1));
}

export async function startServer({
  hostname = "127.0.0.1", port = 3001, token, models, generators,
  timeoutMs = 120000, videoTimeoutMs = 600000,
}) {
  if (!token) throw new Error("A private proxy token is required");
  const media = mediaCache();
  let activePages = 0;
  const server = http.createServer(async (req, res) => {
    const controller = new AbortController();
    res.once("close", () => controller.abort());
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    let pageSlot = false;
    let signal;
    let kind;
    try {
      if (req.headers.authorization !== `Bearer ${token}`) fail(403, "Forbidden");
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        fail(405, "Method not allowed");
      }
      const url = new URL(req.url, "http://localhost");
      kind = { "/html": "text", "/image": "image", "/video": "video" }[url.pathname];
      if (!kind || !models[kind]) fail(404, "Generation route unavailable");
      const target = url.searchParams.get("url");
      let requestUrl;
      try { requestUrl = new URL(target); } catch { fail(400, "A valid url parameter is required"); }
      if (!/^https?:$/.test(requestUrl.protocol) || requestUrl.username || requestUrl.password || target.length > 8192) {
        fail(400, "Use an HTTP(S) URL without embedded credentials (maximum 8192 characters)");
      }
      requestUrl.hash = "";
      signal = AbortSignal.any([controller.signal, AbortSignal.timeout(kind === "video" ? videoTimeoutMs : timeoutMs)]);
      if (kind === "text") {
        if (activePages >= 4) fail(429, "Too many page generations; try again shortly");
        activePages++;
        pageSlot = true;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
        res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: http: data: blob:; media-src https: http: data: blob:; form-action https: http:; base-uri 'none'; sandbox allow-scripts allow-forms allow-same-origin");
        const prompt = await generatePrompt("html", {
          requestUrl: requestUrl.href,
          language: (url.searchParams.get("language") || "en").slice(0, 128),
          imageInstructions: models.image ? "Use descriptive image URLs as described below. Lazy-load offscreen images; do not lazy-load the main hero image." : "Image generation is disabled. Use CSS decoration instead of remote images.",
          videoInstructions: models.video ? "When relevant, include at most one <video controls preload=\"none\" width=\"640\" height=\"360\"> with an HTTPS .mp4 src and URL-encoded description query parameter. Do not autoplay. Explain that playback generates a short AI clip and may take several minutes." : "Video generation is disabled. Do not include video or audio sources.",
        });
        const extract = streamCodeBlocks("html");
        const calc = costCalculator();
        let bytes = 0;
        for await (const chunk of generators.text(prompt, signal)) {
          signal.throwIfAborted();
          calc(chunk);
          for await (const output of extract(chunk)) {
            bytes += Buffer.byteLength(output);
            if (!res.write(output)) await once(res, "drain", { signal });
          }
        }
        for await (const output of extract({ END: true })) {
          bytes += Buffer.byteLength(output);
          if (!res.write(output)) await once(res, "drain", { signal });
        }
        if (!bytes) throw new Error("The model returned no HTML");
        calc({ END: true });
        res.end();
      } else {
        const asset = await media.get(`${kind}:${requestUrl.href}`, async (sharedSignal) => {
          const prompt = await generatePrompt(kind, {
            description: requestUrl.searchParams.get("description") || requestUrl.href,
          });
          const deadline = AbortSignal.any([sharedSignal, AbortSignal.timeout(kind === "video" ? videoTimeoutMs : timeoutMs)]);
          return generators[kind](prompt, deadline);
        }, signal);
        sendMedia(req, res, asset);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const status = error.statusCode || (signal?.reason?.name === "TimeoutError" ? 504 : 502);
      // Do not log URLs, request headers, generated content or raw SDK errors.
      const provider = models[kind]?.provider || "proxy";
      const upstream = Number.isInteger(error.status) ? `, upstream HTTP ${error.status}` : "";
      console.error(`Request failed: ${provider}/${kind || "request"} (${status}${upstream})`);
      if (res.headersSent) res.destroy(); // A partial generation must not look complete.
      else {
        res.statusCode = status;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(error.statusCode ? error.message : status === 504 ? "Generation timed out" : "Generation failed. Check provider credentials, quota and model availability.");
      }
    } finally {
      if (pageSlot) activePages--;
    }
  });
  server.once("close", () => media.close());
  server.listen(port, hostname);
  await once(server, "listening");
  return server;
}
