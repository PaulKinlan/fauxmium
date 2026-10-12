import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import {
  PROVIDERS,
  MODEL_ALIASES,
  FALLBACK_PRICING,
  BROWSING_LENSES,
  resolveModelAlias,
  getProvidersWithFeature,
} from "../config/providers.js";

import {
  loadCosts,
  costCalculator,
  sessionCosts,
  resetSessionCosts,
} from "../lib/costCalculator.js";

import { makeVideoModel } from "../lib/aiAdapter.js";
import { synthesizeWav } from "../lib/audioSynth.js";
import { serveMediaBuffer } from "../lib/rangeResponse.js";
import { FALLBACK_MP4_BUFFER, generatePlaceholderSvg } from "../lib/fallbackMedia.js";
import { registerPendingImage, getPendingImage } from "../lib/imageCache.js";
import { syncGeminiModels } from "../lib/modelSync.js";
import { startServer } from "../server/index.js";

test("Task 1: Declarative models, aliases, and lens configurations", () => {
  assert.ok(PROVIDERS.gemini, "Gemini provider must be defined");
  assert.ok(PROVIDERS.openai, "OpenAI provider must be defined");
  assert.ok(PROVIDERS.synth, "Synth provider must be defined");

  assert.equal(
    resolveModelAlias("gemini-flash-lite-latest"),
    "gemini-3.5-flash-lite"
  );
  assert.equal(
    resolveModelAlias("gemini-flash-latest"),
    "gemini-3.8-flash"
  );

  assert.ok(BROWSING_LENSES.modern, "Modern lens must exist");
  assert.ok(BROWSING_LENSES["geocities-1997"], "1997 GeoCities lens must exist");
  assert.ok(BROWSING_LENSES["cyberpunk-2077"], "Cyberpunk lens must exist");

  const audioProviders = getProvidersWithFeature("audio");
  assert.ok(audioProviders.includes("synth"), "Audio providers should include synth");
  assert.ok(audioProviders.includes("gemini"), "Audio providers should include gemini");
});

test("Task 1: Multi-modal cost calculations and positive output tokens", async () => {
  resetSessionCosts();
  assert.equal(sessionCosts.total, 0);

  await loadCosts("gemini-3.5-flash");
  await loadCosts("dall-e-3");
  await loadCosts("veo-3.1-fast-generate-preview");

  // 1. Text token calculation: must produce POSITIVE output tokens and non-zero cost
  const textCost = costCalculator("gemini-3.5-flash", "https://example.com/test", "text");
  const textLog = textCost({
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
    END: true,
  });

  assert.equal(textLog.promptTokenCount, 1000);
  assert.equal(textLog.outputTokenCount, 500, "Output tokens must not be negative");
  assert.equal(textLog.totalTokenCount, 1500);
  assert.ok(textLog.cost > 0, "Text cost should be positive");

  // 2. Image per-unit calculation
  const imgCost = costCalculator("dall-e-3", "https://example.com/img.png", "image");
  const imgLog = imgCost({
    usage: { images: 2 },
    END: true,
  });
  assert.equal(imgLog.cost, 0.08, "2 DALL-E-3 images at $0.04 should be $0.08");

  // 3. Video per-second calculation
  const videoCost = costCalculator("veo-3.1-fast-generate-preview", "https://example.com/video.mp4", "video");
  const videoLog = videoCost({
    usage: { durationSeconds: 8 },
    END: true,
  });
  assert.equal(videoLog.cost, 3.20, "8s Veo video at $0.40/s should be $3.20");

  // 4. Cached item calculation ($0)
  const cachedCost = costCalculator("gemini-3.5-flash", "https://example.com/cached", "text");
  const cachedLog = cachedCost({
    cached: true,
    END: true,
  });
  assert.equal(cachedLog.cost, 0, "Cached items must cost $0");

  assert.ok(sessionCosts.total > 0, "Session total must accumulate");
  resetSessionCosts();
  assert.equal(sessionCosts.total, 0, "resetSessionCosts must zero session total");
});

test("Task 2 & 3: Video model factory uses google.video()", () => {
  const model = makeVideoModel({
    provider: "google",
    apiKey: "dummy-key",
    model: "veo-3.1-fast-generate-preview",
  });

  assert.equal(
    model.constructor.name,
    "GoogleGenerativeAIVideoModel",
    "makeVideoModel must return GoogleGenerativeAIVideoModel, NOT a language model"
  );
});

test("Task 3: Fallback media and Range response (200 & 206)", () => {
  // Check MP4 buffer
  assert.ok(Buffer.isBuffer(FALLBACK_MP4_BUFFER));
  assert.equal(FALLBACK_MP4_BUFFER.toString("ascii", 4, 8), "ftyp");

  // Check SVG placeholder
  const svg = generatePlaceholderSvg({ width: 400, height: 300, description: "Test image" });
  assert.equal(svg.mimeType, "image/svg+xml");
  assert.ok(svg.buffer.toString("utf8").includes("Test image"));

  // Check Range response 200 OK
  const dummyBuffer = Buffer.from("Hello world Fauxmium streaming test");
  let status200 = null;
  let headers200 = {};
  let body200 = null;
  const mockRes200 = {
    setHeader: (k, v) => { headers200[k.toLowerCase()] = v; },
    set statusCode(code) { status200 = code; },
    end: (data) => { body200 = data; },
  };
  serveMediaBuffer({ headers: {} }, mockRes200, dummyBuffer, "video/mp4");
  assert.equal(status200, 200);
  assert.equal(headers200["accept-ranges"], "bytes");
  assert.equal(headers200["content-length"], dummyBuffer.length.toString());
  assert.deepEqual(body200, dummyBuffer);

  // Check Range response 206 Partial Content
  let status206 = null;
  let headers206 = {};
  let body206 = null;
  const mockRes206 = {
    setHeader: (k, v) => { headers206[k.toLowerCase()] = v; },
    set statusCode(code) { status206 = code; },
    end: (data) => { body206 = data; },
  };
  serveMediaBuffer({ headers: { range: "bytes=0-9" } }, mockRes206, dummyBuffer, "video/mp4");
  assert.equal(status206, 206);
  assert.equal(headers206["content-range"], `bytes 0-9/${dummyBuffer.length}`);
  assert.equal(headers206["content-length"], "10");
  assert.equal(body206.toString("utf8"), "Hello worl");
});

test("Task 4: Procedural WAV synthesizer produces valid playable audio", () => {
  const modes = ["sfx", "chiptune", "ambient", "music", "speech"];

  for (const mode of modes) {
    const { mimeType, buffer } = synthesizeWav({ type: mode, description: `test ${mode}` });
    assert.equal(mimeType, "audio/wav");
    assert.ok(buffer.length > 1000, `Audio buffer for ${mode} should be populated`);
    assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
    assert.equal(buffer.toString("ascii", 8, 12), "WAVE");
    assert.equal(buffer.toString("ascii", 12, 16), "fmt ");
    assert.equal(buffer.toString("ascii", 36, 40), "data");
  }
});

test("Task 5: Server endpoints (/config, /cost, /cache/clear, /audio, /video with missing poster)", async () => {
  const testPort = 3991;
  const server = await startServer(
    "127.0.0.1",
    testPort,
    { provider: "gemini", apiKey: "dummy", model: "gemini-3.5-flash" },
    { provider: "gemini", apiKey: "dummy", model: "gemini-2.5-flash-image", enabled: false },
    { provider: "gemini", apiKey: "dummy", model: "veo-3.1-fast-generate-preview", enabled: false },
    { provider: "synth", apiKey: "", model: "synth-wav", enabled: true },
    { activeLens: "modern", syncModels: false }
  );

  try {
    const base = `http://127.0.0.1:${testPort}`;

    // 1. GET /config
    const configRes = await fetch(`${base}/config`);
    assert.equal(configRes.status, 200);
    const config = await configRes.json();
    assert.equal(config.activeLens, "modern");
    assert.equal(config.audio.provider, "synth");

    // 2. POST /config (update lens to cyberpunk-2077)
    const updateRes = await fetch(`${base}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeLens: "cyberpunk-2077" }),
    });
    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.config.activeLens, "cyberpunk-2077");

    // 3. GET /cost
    const costRes = await fetch(`${base}/cost`);
    assert.equal(costRes.status, 200);
    const costData = await costRes.json();
    assert.ok(typeof costData.total === "number");

    // 4. POST /cost/reset
    const resetRes = await fetch(`${base}/cost/reset`, { method: "POST" });
    assert.equal(resetRes.status, 200);

    // 5. POST /cache/clear
    const cacheRes = await fetch(`${base}/cache/clear`, { method: "POST" });
    assert.equal(cacheRes.status, 200);

    // 6. GET /audio (procedural chiptune synth)
    const audioRes = await fetch(`${base}/audio?url=${encodeURIComponent("https://example.com/audio/game.wav?type=chiptune")}`);
    assert.equal(audioRes.status, 200);
    assert.equal(audioRes.headers.get("content-type"), "audio/wav");
    const audioBuf = Buffer.from(await audioRes.arrayBuffer());
    assert.equal(audioBuf.toString("ascii", 0, 4), "RIFF");

    // 7. GET /video without poster query param (MUST NOT CRASH!)
    const videoRes = await fetch(`${base}/video?url=${encodeURIComponent("https://example.com/video/test.mp4?description=sunset")}`);
    assert.equal(videoRes.status, 200);
    assert.equal(videoRes.headers.get("content-type"), "video/mp4");
    const videoBuf = Buffer.from(await videoRes.arrayBuffer());
    assert.equal(videoBuf.toString("ascii", 4, 8), "ftyp");

    // 8. GET /image with disabled flag (returns styled SVG)
    const imageRes = await fetch(`${base}/image?url=${encodeURIComponent("https://example.com/img/pic.jpg?description=flower")}`);
    assert.equal(imageRes.status, 200);
    assert.equal(imageRes.headers.get("content-type"), "image/svg+xml");
  } finally {
    server.close();
  }
});

test("registerPendingImage handles rejected promise without unhandledRejection", async () => {
  let unhandled = false;
  const handler = () => {
    unhandled = true;
  };
  process.on("unhandledRejection", handler);

  try {
    const errorPromise = Promise.reject(new Error("Test rejection"));
    registerPendingImage("https://example.com/rejected.png", errorPromise);

    // Also catch on the errorPromise itself so the test doesn't fail from the original promise
    await errorPromise.catch(() => {});

    // Allow microtasks and ticks to run
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(unhandled, false, "Should not trigger unhandledRejection");
    assert.equal(
      getPendingImage("https://example.com/rejected.png"),
      null,
      "Pending promise should be cleaned up"
    );
  } finally {
    process.off("unhandledRejection", handler);
  }
});

test("syncGeminiModels discovers live models or reads disk cache", async () => {
  const models = await syncGeminiModels();
  assert.ok(Array.isArray(models), "syncGeminiModels should return an array of models");
});

