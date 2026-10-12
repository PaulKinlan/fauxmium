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
import fs from "node:fs";
import path from "node:path";
import { serveMediaBuffer } from "../lib/rangeResponse.js";
import { FALLBACK_MP4_BUFFER, generatePlaceholderSvg } from "../lib/fallbackMedia.js";
import { registerPendingImage, getPendingImage } from "../lib/imageCache.js";
import { syncGeminiModels } from "../lib/modelSync.js";
import { generateStructuredPrompt, generatePrompt } from "../lib/prompts.js";
import { sessionState, getActiveLensInstruction } from "../lib/sessionState.js";
import {
  extractAndSaveSiteProfile,
  getFormattedSiteProfile,
  recordLinkContext,
  consumeLinkContext,
  formatLinkContext,
  getNavigationThread,
  appendNavigationTurn,
  clearSiteMemory,
  updateAndGetDomainState,
  getDomainState,
  getDomainColorPalette,
} from "../lib/siteMemory.js";
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

test("Task 2: Prompt Prefix Caching: static invariant system prompt and tiered user prompt prefix", async () => {
  const res1 = await generateStructuredPrompt("html", {
    lensInstruction: "Modern Web standard",
    currentDate: "2026-10-12",
    country: "United States",
    timezone: "America/New_York",
    acceptLanguage: "en-US",
    viewportWidth: "1280",
    viewportHeight: "832",
    colorScheme: "dark",
    siteProfile: "Domain: example.com",
    referer: "https://example.com/home",
    postData: "None",
    linkContext: "Clicked link: About",
    sessionHistory: "1. Home",
    requestUrl: "https://example.com/about",
    requestType: "document",
  });

  const res2 = await generateStructuredPrompt("html", {
    lensInstruction: "Modern Web standard",
    currentDate: "2026-10-12",
    country: "United States",
    timezone: "America/New_York",
    acceptLanguage: "en-US",
    viewportWidth: "1280", // same bucket
    viewportHeight: "832",
    colorScheme: "dark",
    siteProfile: "Domain: example.com",
    referer: "https://example.com/about",
    postData: "q=test",
    linkContext: "Clicked link: Search",
    sessionHistory: "1. Home\n2. About",
    requestUrl: "https://example.com/search?q=test",
    requestType: "document",
  });

  // 1. System prompt must be non-empty, contain zero ### placeholders, and exceed 1,024 tokens
  assert.ok(res1.system.length > 4000, "System prompt should be extensive (>4000 chars / ~1000+ tokens)");
  assert.ok(!res1.system.includes("###"), "System prompt must contain zero un-interpolated ### placeholders");
  assert.equal(res1.system, res2.system, "System prompt must be 100% invariant across requests");

  // 2. The stable prefix in user prompt must be identical across requests on the same domain
  const prefix1 = res1.prompt.split("[NAVIGATION & LINK INTENT")[0];
  const prefix2 = res2.prompt.split("[NAVIGATION & LINK INTENT")[0];
  assert.ok(prefix1.length > 100, "Stable environment and site profile prefix must exist");
  assert.equal(prefix1, prefix2, "Stable prefix must match byte-for-byte across requests for prefix caching");
});

test("Task 2: Prompt Caching: costCalculator applies 75% discount for cached input tokens", async () => {
  resetSessionCosts();
  await loadCosts("gemini-3.5-flash");

  // Gemini-3.5-flash fallback pricing: input = $1.50/M tokens = $0.0000015/token
  // 1,000 input tokens total, where 800 are cached:
  // Uncached: 200 * $0.0000015 = $0.000300
  // Cached: 800 * $0.0000015 * 0.25 (75% off) = $0.000300
  // Output: 0 tokens
  // Total expected cost = $0.000600 (vs $0.001500 full price)
  const calc = costCalculator("gemini-3.5-flash", "https://example.com/cached-test", "text");
  const log = calc({
    usage: {
      promptTokens: 1000,
      cachedInputTokens: 800,
      outputTokens: 0,
      totalTokens: 1000,
    },
    END: true,
  });

  assert.equal(log.promptTokenCount, 1000);
  assert.equal(log.cachedInputTokens, 800);
  assert.ok(Math.abs(log.cost - 0.0006) < 0.00001, `Cost with 75% prompt cache discount should be 0.0006, got ${log.cost}`);
  assert.equal(sessionCosts.cachedTokens, 800, "sessionCosts.cachedTokens must accumulate");
});

test("Task 1: Chrome Extension Icons: exact PNG dimensions and manifest declarations", () => {
  const sizes = [16, 32, 48, 128];
  const iconsDir = path.resolve("extension/icons");

  // 1. Verify SVG master exists
  assert.ok(fs.existsSync(path.join(iconsDir, "icon.svg")), "icon.svg must exist");

  // 2. Verify all PNGs exist with exact pixel dimensions in IHDR
  for (const size of sizes) {
    const filePath = path.join(iconsDir, `icon-${size}.png`);
    assert.ok(fs.existsSync(filePath), `icon-${size}.png must exist`);
    const buf = fs.readFileSync(filePath);
    assert.equal(buf.toString("ascii", 1, 4), "PNG", "File must have valid PNG signature");
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, size, `icon-${size}.png width must be ${size}`);
    assert.equal(height, size, `icon-${size}.png height must be ${size}`);
  }

  // 3. Verify manifest.json declares icons and action.default_icon
  const manifest = JSON.parse(fs.readFileSync(path.resolve("extension/manifest.json"), "utf8"));
  assert.ok(manifest.icons, "manifest.json must declare icons");
  assert.equal(manifest.icons["16"], "icons/icon-16.png");
  assert.equal(manifest.icons["32"], "icons/icon-32.png");
  assert.equal(manifest.icons["48"], "icons/icon-48.png");
  assert.equal(manifest.icons["128"], "icons/icon-128.png");
  assert.equal(manifest.action.default_icon["128"], "icons/icon-128.png");
});

test("Task 3: Site Memory & Link Intent: captures design DNA, reusable media, and a => b click intent", () => {
  clearSiteMemory();

  const sampleHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Paul Kinlan - Web Log</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap">
        <style>
          :root {
            --brand-primary: #5c7cfa;
            --brand-bg: #12131c;
          }
          body { font-family: "Inter", sans-serif; background: var(--brand-bg); }
        </style>
      </head>
      <body>
        <header>
          <nav>
            <a href="https://paul.kinlan.me/">Home</a>
            <a href="https://paul.kinlan.me/about">About</a>
            <a href="https://paul.kinlan.me/projects">Projects</a>
          </nav>
        </header>
        <main>
          <img src="https://paul.kinlan.me/img/avatar.jpg?description=Paul+Kinlan+avatar&width=120&height=120" alt="Avatar" width="120" height="120">
          <article class="card">
            <h3>Building Synthetic Web</h3>
            <a href="https://paul.kinlan.me/post-1" data-context="Deep dive into Fauxmium browser architecture">Read Article</a>
          </article>
        </main>
      </body>
    </html>
  `;

  // 1. Extract design DNA & media assets
  extractAndSaveSiteProfile("https://paul.kinlan.me/", sampleHtml);
  const profile = getFormattedSiteProfile("https://paul.kinlan.me/about");

  assert.ok(profile.includes("paul.kinlan.me"), "Profile should mention domain");
  assert.ok(profile.includes("Inter"), "Profile should include typography");
  assert.ok(profile.includes("--brand-primary"), "Profile should include CSS variables");
  assert.ok(profile.includes("Home") && profile.includes("About"), "Profile should include nav links");
  assert.ok(profile.includes("avatar.jpg"), "Profile should include cached avatar image asset");

  // 2. Click Intent Tracking (a => b)
  recordLinkContext({
    sourceUrl: "https://paul.kinlan.me/",
    targetUrl: "https://paul.kinlan.me/post-1",
    linkText: "Read Article",
    cardTitle: "Building Synthetic Web",
    dataContext: "Deep dive into Fauxmium browser architecture",
    cardSnippet: "Building Synthetic Web Read Article",
    cardImageSrc: "https://paul.kinlan.me/img/avatar.jpg?description=Paul+Kinlan+avatar&width=120&height=120",
  });

  const consumed = consumeLinkContext("https://paul.kinlan.me/post-1");
  assert.ok(consumed, "Should consume link context for target URL");
  assert.equal(consumed.cardTitle, "Building Synthetic Web");
  assert.equal(consumed.dataContext, "Deep dive into Fauxmium browser architecture");

  const formattedLink = formatLinkContext(consumed);
  assert.ok(formattedLink.includes("Building Synthetic Web"));
  assert.ok(formattedLink.includes("Deep dive into Fauxmium browser architecture"));
});

test("Task 3: Multi-Turn Navigation Threads: preserves immutable chat turns and slides window", () => {
  clearSiteMemory();

  const domain = "https://example.com";

  // Append 3 navigation turns
  appendNavigationTurn(`${domain}/1`, "User prompt 1", "<h1>Page 1</h1>");
  appendNavigationTurn(`${domain}/2`, "User prompt 2", "<h1>Page 2</h1>");
  appendNavigationTurn(`${domain}/3`, "User prompt 3", "<h1>Page 3</h1>");

  const thread = getNavigationThread(`${domain}/4`);
  assert.equal(thread.length, 6, "Thread should have 3 user + 3 assistant messages (6 total)");
  assert.equal(thread[0].role, "user");
  assert.equal(thread[0].content, "User prompt 1");
  assert.equal(thread[1].role, "assistant");
  assert.ok(thread[1].content.includes("Page 1"));

  // Append 2 more turns (total 5 turns = 10 messages -> should slide window to MAX_THREAD_TURNS=4 turns / 8 messages)
  appendNavigationTurn(`${domain}/4`, "User prompt 4", "<h1>Page 4</h1>");
  appendNavigationTurn(`${domain}/5`, "User prompt 5", "<h1>Page 5</h1>");

  const threadAfterSlide = getNavigationThread(`${domain}/6`);
  assert.equal(threadAfterSlide.length, 8, "Thread should slide to MAX_THREAD_TURNS * 2 = 8 messages");
  // Oldest turn (turn 1) dropped: turn 2 is now first
  assert.equal(threadAfterSlide[0].content, "User prompt 2");
});

test("Task 3: POST /config changing activeLens updates sessionState and clears prior site memory for reload", async () => {
  clearSiteMemory();
  const testPort = 3992;
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

    // 1. Initially modern lens is active
    assert.equal(sessionState.activeLens, "modern");

    // 2. Establish modern site memory and navigation thread
    extractAndSaveSiteProfile("https://example.com/", `
      <!DOCTYPE html><html><head><title>Modern Example</title>
      <style>:root { --brand: #3b82f6; }</style></head><body><header><nav><a href="/modern">Modern</a></nav></header></body></html>
    `);
    appendNavigationTurn("https://example.com/1", "User prompt modern", "<h1>Modern Page</h1>");

    const profileBefore = getFormattedSiteProfile("https://example.com/about");
    assert.ok(profileBefore.includes("--brand: #3b82f6"), "Should have modern profile in memory");
    const threadBefore = getNavigationThread("https://example.com/2");
    assert.equal(threadBefore.length, 2, "Should have 2 messages in modern thread");

    // 3. User switches lens to cyberpunk-2077 via POST /config (e.g. from extension)
    const res = await fetch(`${base}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeLens: "cyberpunk-2077" }),
    });
    assert.equal(res.status, 200);

    // 4. Verify sessionState.activeLens updated
    assert.equal(sessionState.activeLens, "cyberpunk-2077");

    // 5. Verify prior modern site memory and navigation threads were cleared so next /html request starts fresh
    const profileAfter = getFormattedSiteProfile("https://example.com/about");
    assert.ok(!profileAfter.includes("--brand: #3b82f6"), "Modern profile must be cleared on lens switch");
    assert.ok(profileAfter.includes("None established yet"), "Should indicate fresh site memory");

    const threadAfter = getNavigationThread("https://example.com/2");
    assert.equal(threadAfter.length, 0, "Navigation thread must be reset for new lens");
  } finally {
    server.close();
  }
});

test("Media prompts interpolate dimensions, active browsing lens, and audio transcript", async () => {
  sessionState.activeLens = "cyberpunk-2077";

  const imgPrompt = await generatePrompt("image", {
    description: "neon city street",
    width: "1024",
    height: "768",
    lensInstruction: getActiveLensInstruction(),
  });
  assert.ok(imgPrompt.includes("1024x768"), "Image prompt must include dimensions");
  assert.ok(imgPrompt.includes("Cyberpunk") || imgPrompt.includes("cyberpunk") || imgPrompt.includes("2077"), "Image prompt must include cyberpunk lens");

  const videoPrompt = await generatePrompt("video", {
    description: "flying hovercar",
    width: "1920",
    height: "1080",
    lensInstruction: getActiveLensInstruction(),
  });
  assert.ok(videoPrompt.includes("1920x1080"), "Video prompt must include dimensions");
  assert.ok(videoPrompt.includes("Cyberpunk") || videoPrompt.includes("cyberpunk") || videoPrompt.includes("2077"), "Video prompt must include cyberpunk lens");

  const audioPrompt = await generatePrompt("audio", {
    description: "market vendor greeting",
    type: "speech",
    transcript: "Welcome to Night City, choom!",
    lensInstruction: getActiveLensInstruction(),
  });
  assert.ok(audioPrompt.includes("Welcome to Night City, choom!"), "Audio prompt must include transcript");
  assert.ok(audioPrompt.includes("speech"), "Audio prompt must include type");
  assert.ok(audioPrompt.includes("Cyberpunk") || audioPrompt.includes("cyberpunk") || audioPrompt.includes("2077"), "Audio prompt must include cyberpunk lens");
});

test("Task 1: HTML prompt enrichment: decomposed route, media capabilities, and domain session state", async () => {
  clearSiteMemory();

  // 1. Test updateAndGetDomainState with query parameters
  const stateWithQuery = updateAndGetDomainState("https://shop.example.com/search?q=wireless+headphones&category=audio&sort=price_asc");
  assert.ok(stateWithQuery.includes('q="wireless headphones"'), "Domain state should capture search query");
  assert.ok(stateWithQuery.includes('category="audio"'), "Domain state should capture category");
  assert.ok(stateWithQuery.includes('sort="price_asc"'), "Domain state should capture sort");

  // 2. Test updateAndGetDomainState with Form POST (login)
  const stateWithPost = updateAndGetDomainState(
    "https://shop.example.com/login",
    "username=alice&password=SuperSecretPassword123&action=login"
  );
  assert.ok(stateWithPost.includes('username="alice"'), "Domain state should capture username");
  assert.ok(stateWithPost.includes('password="********"'), "Password must be masked with ********");
  assert.ok(!stateWithPost.includes("SuperSecretPassword123"), "Raw password must NEVER appear in domain state");
  assert.ok(stateWithPost.includes('authenticated="true"'), "Successful credentials should set authenticated=true");

  // 3. Test persistence across another URL on the same domain
  const retrievedState = getDomainState("https://shop.example.com/account");
  assert.ok(retrievedState.includes('authenticated="true"'), "Domain state must persist across domain navigations");
  assert.ok(retrievedState.includes('username="alice"'), "Username must persist across domain navigations");

  // 4. Test generateStructuredPrompt("html", ...) includes all enriched fields
  const structured = await generateStructuredPrompt("html", {
    requestUrl: "https://shop.example.com/search?q=wireless+headphones&category=audio#products",
    pathname: "/search",
    queryParams: 'q="wireless headphones", category="audio"',
    hash: "#products",
    mediaCapabilities: "Images: DISABLED (Do NOT emit external <img> tags; use rich inline <svg> vector illustrations, CSS art, or <canvas> instead); Video: ENABLED; Audio: ENABLED",
    domainState: retrievedState,
    lensInstruction: "Modern Web standard",
  });

  assert.ok(structured.prompt.includes("Decomposed Route: Path=/search | Query=q=\"wireless headphones\", category=\"audio\" | Hash=#products"), "Prompt must include decomposed route");
  assert.ok(structured.prompt.includes("Active Media Capabilities: Images: DISABLED"), "Prompt must include media capabilities");
  assert.ok(structured.prompt.includes("Do NOT emit external <img> tags"), "Prompt must instruct fallback when images disabled");
  assert.ok(structured.prompt.includes("Active Domain Session State"), "Prompt must include active domain session state");
  assert.ok(structured.prompt.includes('authenticated="true"'), "Prompt must include authenticated state");
  assert.ok(structured.prompt.includes('username="alice"'), "Prompt must include persistent username");
});

test("Task 2: Image prompt enrichment: role, aspectRatio, siteColors, and colorScheme", async () => {
  clearSiteMemory();

  // Establish site profile with color variables
  extractAndSaveSiteProfile("https://studio.example.com/", `
    <!DOCTYPE html><html><head><title>Studio</title>
    <style>:root { --brand-primary: #6366f1; --brand-accent: #ec4899; }</style></head>
    <body><img src="https://studio.example.com/logo.png?role=logo" alt="Logo"></body></html>
  `);

  const palette = getDomainColorPalette("https://studio.example.com/banner.jpg");
  assert.ok(palette.includes("--brand-primary: #6366f1"), "Should extract domain color palette");

  const prompt = await generatePrompt("image", {
    description: "futuristic music production suite",
    width: "1920",
    height: "1080",
    role: "hero",
    aspectRatio: "16:9 (Widescreen)",
    siteColors: palette,
    colorScheme: "dark",
    lensInstruction: "2077 Cyberpunk Net",
  });

  assert.ok(prompt.includes("Role & Framing: hero (Aspect Ratio: 16:9 (Widescreen))"), "Image prompt must include role & aspect ratio");
  assert.ok(prompt.includes("Site Brand Palette & Theme: --brand-primary: #6366f1"), "Image prompt must include brand colors");
  assert.ok(prompt.includes("(Color Scheme: dark)"), "Image prompt must include color scheme");
  assert.ok(prompt.includes("Role Framing Guidance:"), "Image prompt must include role framing guidance");
});

test("Task 3: Video prompt enrichment: posterDescription, camera, and aspectRatio", async () => {
  const prompt = await generatePrompt("video", {
    description: "high-speed hyperloop train departing terminal",
    width: "1280",
    height: "720",
    aspectRatio: "16:9 (Widescreen)",
    camera: "dolly forward following train",
    posterDescription: "Sleek train docked at glowing platform",
    lensInstruction: "Modern Web standard",
  });

  assert.ok(prompt.includes("Aspect Ratio: 16:9 (Widescreen)"), "Video prompt must include aspect ratio");
  assert.ok(prompt.includes("Camera / Cinematography Motion: dolly forward following train"), "Video prompt must include camera motion");
  assert.ok(prompt.includes("Starting Poster Frame Context: Sleek train docked at glowing platform"), "Video prompt must include poster description");
});

test("Task 4: Audio prompt & procedural synthesizer: bpm, mood, lens, and transcript", async () => {
  // 1. Prompt interpolation
  const prompt = await generatePrompt("audio", {
    description: "retro arcade stage theme",
    type: "chiptune",
    bpm: "145",
    mood: "energetic",
    transcript: "Level 1 Start!",
    lensInstruction: "Arcade 8-Bit Era",
  });

  assert.ok(prompt.includes("Tempo / BPM: 145"), "Audio prompt must include BPM");
  assert.ok(prompt.includes("Mood / Vibe: energetic"), "Audio prompt must include mood");
  assert.ok(prompt.includes("Transcript: Level 1 Start!"), "Audio prompt must include transcript");

  // 2. Synth execution with lens & mood
  const synthCyberpunk = synthesizeWav({
    description: "ambient neon rain",
    type: "music",
    bpm: 110,
    mood: "tense",
    lens: "cyberpunk-2077",
    durationSeconds: 2.0,
  });
  assert.equal(synthCyberpunk.mimeType, "audio/wav");
  assert.ok(synthCyberpunk.buffer.length > 5000, "Cyberpunk synth buffer should be generated");

  // 3. Synth execution with speech transcript duration scaling
  const synthSpeech = synthesizeWav({
    type: "speech",
    transcript: "Welcome to Fauxmium synthetic web browser! How can I assist your journey?",
    mood: "helpful",
  });
  assert.equal(synthSpeech.mimeType, "audio/wav");
  assert.ok(synthSpeech.buffer.length > 50000, "Speech buffer duration should scale with transcript length");
});




