import test from "node:test";
import assert from "node:assert/strict";
import { syncBuiltinESMExports } from "node:module";
import { createGenerators } from "../lib/generation.js";
import { defaults, listModels, resolveModel } from "../lib/models.js";
import { interpolate } from "../lib/interpolate.js";
import { streamCodeBlocks } from "../lib/streamCodeBlocks.js";
import { readSSE } from "../lib/sse.js";
import { mediaCache } from "../lib/mediaCache.js";

const env = Object.fromEntries(["GEMINI", "OPENAI", "ANTHROPIC", "XAI", "DEEPSEEK", "MISTRAL"].map((p) => [`${p}_API_KEY`, "test-only-key"]));
const json = (value) => Response.json(value);
const events = (values) => new Response(values.map((v) => `data: ${JSON.stringify(v)}\r\n\r\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
const signal = () => AbortSignal.timeout(3000);
const collect = async (stream) => Array.fromAsync(stream);
const interaction = (model, content) => ({
  id: "test-id", model, object: "interaction", status: "completed",
  steps: [{ type: "model_output", content }],
});

function generator(value, kind, fetchImpl) {
  return createGenerators({ [kind]: resolveModel(value, kind) }, {
    env,
    fetchImpl: async (url, init) => url instanceof Request
      ? fetchImpl(url.url, { method: url.method, headers: Object.fromEntries(url.headers), body: await url.text(), signal: url.signal })
      : fetchImpl(url, init),
  });
}

test("catalog has usable provider/capability pairs; legacy bare IDs still resolve", () => {
  for (const { kind, model } of listModels()) assert.ok(resolveModel(model, kind));
  assert.equal(resolveModel("gemini-2.5-flash-lite", "text").provider, "gemini");
  assert.equal(resolveModel("claude-sonnet-5", "text").provider, "anthropic");
  assert.equal(resolveModel(defaults.video, "video"), null);
  assert.throws(() => resolveModel("none", "text"));
  assert.throws(() => resolveModel("anthropic:claude-sonnet-5", "image"));
  assert.throws(() => resolveModel("gpt-image-2.5-flare", "text"));
  assert.throws(() => resolveModel("grok-imagine-video-1.5", "image"));
  assert.throws(() => resolveModel("openai:x:y", "text"));
  assert.throws(() => resolveModel("openai:", "text"));
  assert.throws(() => createGenerators({ text: resolveModel("gpt-6-astra", "text") }, { env: {} }), /OPENAI_API_KEY/);
  assert.doesNotThrow(() => createGenerators({ text: resolveModel("claude-sonnet-5", "text") }, { env: { ANTHROPIC_API_KEY: "test" } }));
  assert.doesNotThrow(() => createGenerators({ text: resolveModel(defaults.text, "text") }, { env: { API_KEY: "legacy" } }));
});

test("prompt values are literal and substituted once", () => {
  assert.equal(interpolate("###url### ###name###", { url: "$& $' ###name###", name: "World" }), "$& $' ###name### World");
});

test("HTML extraction survives every chunk boundary, raw HTML and usage-only chunks", async () => {
  const html = '<!doctype html><p>hello 🌍</p><script>const x = "```";</script>';
  for (const source of [html, `Here is the page:\n\n\`\`\`html\n${html}\n\`\`\`\nignored`]) {
    for (let size = 1; size <= source.length; size++) {
      const extract = streamCodeBlocks("html");
      let output = "";
      for (let i = 0; i < source.length; i += size) {
        output += (await collect(extract({ text: source.slice(i, i + size) }))).join("");
        assert.deepEqual(await collect(extract({ usageMetadata: {} })), []);
      }
      output += (await collect(extract({ END: true }))).join("");
      assert.equal(output, html);
      assert.deepEqual(await collect(extract({ END: true })), []);
    }
  }
  await assert.rejects(collect(streamCodeBlocks("html")({ END: true })), /no HTML/);
});

test("SSE frames, multiline JSON, UTF-8 and CRLF survive byte-by-byte delivery", async () => {
  const bytes = new TextEncoder().encode(': ping\r\nevent: text\r\ndata: {"text":\r\ndata: "🌍"}\r\n\r\ndata: [DONE]\r\n\r\n');
  const response = new Response(new ReadableStream({
    start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); },
  }));
  assert.deepEqual(await collect(readSSE(response)), [{ text: "🌍" }, "[DONE]"]);
  assert.deepEqual(await collect(readSSE(new Response('data: {"text":"end"}'))), [{ text: "end" }]);
  await assert.rejects(collect(readSSE(new Response('data: invalid\n\n'))), /invalid streaming JSON/);
});

test("OpenAI uses Responses streaming, drops reasoning, and reports usage", async () => {
  const gen = generator("gpt-6-astra", "text", async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.model, "gpt-6-astra");
    assert.ok(init.signal);
    return events([
      { type: "response.reasoning_summary_text.delta", delta: "private" },
      { type: "response.output_text.delta", delta: "<html>" },
      { type: "response.completed", response: { usage: { input_tokens: 2, output_tokens: 3 } } },
    ]);
  });
  assert.deepEqual(await collect(gen.text("prompt", signal())), [
    { text: "<html>" }, { usageMetadata: { promptTokenCount: 2, totalTokenCount: 5 } },
  ]);
});

test("Claude Messages streams only text and uses the provider's key", async () => {
  const gen = generator("claude-sonnet-5", "text", async (url, init) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    assert.equal(init.headers["x-api-key"], "test-only-key");
    assert.equal(init.headers["anthropic-version"], "2023-06-01");
    assert.equal(JSON.parse(init.body).max_tokens, 16384);
    return events([
      { type: "message_start", message: { usage: { input_tokens: 2 } } },
      { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "private" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "<p>Hi</p>" } },
      { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 4 } },
      { type: "message_stop" },
    ]);
  });
  assert.deepEqual(await collect(gen.text("prompt", signal())), [
    { text: "<p>Hi</p>" }, { usageMetadata: { promptTokenCount: 2, totalTokenCount: 6 } },
  ]);
});

test("Grok, DeepSeek and Mistral share chat completions without reasoning output", async () => {
  for (const model of ["grok-4.6", "deepseek-flash", "mistral-medium-3-5"]) {
    const gen = generator(model, "text", async (url, init) => {
      assert.ok(url.endsWith("/chat/completions"));
      assert.equal(JSON.parse(init.body).model, model);
      return events([
        { choices: [{ delta: { reasoning_content: "private" } }] },
        { choices: [{ delta: { content: "<p>OK</p>" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]);
    });
    assert.deepEqual(await collect(gen.text("prompt", signal())), [{ text: "<p>OK</p>" }]);
  }
});

test("Gemini streams through the installed SDK and opts out of interaction storage", async () => {
  const gen = generator("gemini-3.8-flash", "text", async (url, init) => {
    assert.match(String(url), /interactions/);
    assert.equal(JSON.parse(init.body).store, false);
    return events([
      { event_type: "step.delta", index: 0, delta: { type: "thought_signature", signature: "secret" } },
      { event_type: "step.delta", index: 1, delta: { type: "text", text: "<p>OK</p>" } },
      { event_type: "interaction.completed", interaction: { ...interaction("gemini-3.8-flash", []), usage: { total_input_tokens: 2, total_tokens: 5 } } },
    ]);
  });
  assert.deepEqual(await collect(gen.text("prompt", signal())), [
    { text: "<p>OK</p>" }, { usageMetadata: { promptTokenCount: 2, totalTokenCount: 5 } },
  ]);
});

test("image generation matches each API and handles missing/filtered results", async () => {
  const data = Buffer.from("image bytes").toString("base64");
  for (const model of ["gemini-3.1-flash-image", "gpt-image-2.5-flare", "grok-imagine-image-2.0"]) {
    const gen = generator(model, "image", async (url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.model, model);
      if (model.startsWith("gemini")) {
        assert.deepEqual(body.response_format, { type: "image" });
        return json(interaction(model, [{ type: "image", data, mime_type: "image/png" }]));
      }
      assert.ok(url.endsWith("/images/generations"));
      if (model.startsWith("grok")) assert.equal(body.response_format, "b64_json");
      else { assert.equal(body.output_format, "png"); assert.equal(body.response_format, undefined); }
      return json({ data: [{ b64_json: data }] });
    });
    assert.equal((await gen.image("prompt", signal())).body.toString(), "image bytes");
  }
  await assert.rejects(generator("gpt-image-2.5-flare", "image", async () => json({ data: [] })).image("x", signal()), /no media/);
  await assert.rejects(generator("gemini-3.1-flash-image", "image", async () => json(interaction("gemini-3.1-flash-image", []))).image("x", signal()), /no media/);
});

test("Omni produces video through Interactions, Veo uses its operation API", async () => {
  const omni = generator("gemini-omni-1.1-flash", "video", async (_, init) => {
    assert.equal(JSON.parse(init.body).response_format.type, "video");
    return json(interaction("gemini-omni-1.1-flash", [{ type: "video", mime_type: "video/mp4", data: "dmlkZW8=" }]));
  });
  assert.equal((await omni.video("prompt", signal())).body.toString(), "video");
  let requests = 0;
  const veo = generator("veo-3.1-generate-preview", "video", async (url, init) => {
    requests++;
    if (requests === 1) {
      assert.match(String(url), /predictLongRunning/);
      return json({ name: "operations/test", done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: "https://generativelanguage.googleapis.com/v1beta/files/test:download" } }] } } });
    }
    if (requests === 2) {
      assert.match(String(url), /files\/test:download/);
      assert.equal(init.headers["x-goog-api-key"], "test-only-key");
      return new Response(null, { status: 302, headers: { location: "https://storage.googleapis.com/generated/test.mp4" } });
    }
    assert.deepEqual(init.headers, {}, "Google key must not follow the redirect to storage");
    return new Response("video");
  });
  assert.equal((await veo.video("prompt", signal())).body.toString(), "video");
  assert.equal(requests, 3);
});

test("xAI video job start, polling and downloads; key never reaches the CDN", async () => {
  const calls = [];
  const gen = generator("grok-imagine-video-1.5", "video", async (url, init) => {
    calls.push(String(url));
    if (calls.length === 1) return json({ request_id: "test-job" });
    if (calls.length === 2) return json({ status: "done", video: { url: "https://vidgen.x.ai/video.mp4" } });
    assert.deepEqual(init.headers, {});
    return new Response("video");
  });
  assert.equal((await gen.video("prompt", signal())).body.toString(), "video");
  assert.deepEqual(calls, ["https://api.x.ai/v1/videos/generations", "https://api.x.ai/v1/videos/test-job", "https://vidgen.x.ai/video.mp4"]);
});

test("video errors, polling cancellation and untrusted download URLs are rejected", async () => {
  for (const result of [{ status: "failed" }, { status: "expired" }, { status: "done", video: { url: "http://127.0.0.1/secret" } }]) {
    let calls = 0;
    const gen = generator("grok-imagine-video-1.5", "video", async () => ++calls === 1 ? json({ request_id: "job" }) : json(result));
    await assert.rejects(gen.video("prompt", signal()));
    assert.equal(calls, 2);
  }
  const controller = new AbortController();
  let calls = 0;
  const gen = generator("grok-imagine-video-1.5", "video", async () => {
    if (++calls === 1) return json({ request_id: "job" });
    controller.abort();
    return json({ status: "pending" });
  });
  await assert.rejects(gen.video("prompt", controller.signal), { name: "AbortError" });
});

test("Google SDK forwards cancellation and does not retry billable submissions", async () => {
  let attempts = 0;
  const failure = generator("gemini-3.1-flash-image", "image", async () => {
    attempts++;
    return new Response('{"error":{"message":"unavailable","code":503}}', { status: 503, headers: { "Content-Type": "application/json" } });
  });
  await assert.rejects(failure.image("x", signal()));
  assert.equal(attempts, 1);
  const controller = new AbortController();
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const gen = generator("gemini-3.8-flash", "text", async (_, init) => {
    started();
    return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }));
  });
  const pending = collect(gen.text("prompt", controller.signal));
  await ready;
  controller.abort();
  await assert.rejects(pending);
});

test("Veo and xAI poll pending jobs to completion without resubmitting", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  syncBuiltinESMExports();
  t.after(() => { t.mock.timers.reset(); syncBuiltinESMExports(); });
  for (const model of ["veo-3.1-generate-preview", "grok-imagine-video-1.5"]) {
    let calls = 0;
    const gen = generator(model, "video", async (url, init) => {
      calls++;
      if (model.startsWith("veo")) {
        if (calls === 1) return json({ name: "models/veo-3.1-generate-preview/operations/test", done: false });
        assert.match(String(url), /operations\/test/);
        assert.equal(init.method, "GET");
        return json({ name: "models/veo-3.1-generate-preview/operations/test", done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { encodedVideo: "dmlkZW8=", encoding: "video/mp4" } }] } } });
      }
      if (calls === 1) return json({ request_id: "job" });
      if (calls === 2) return json({ status: "pending" });
      if (calls === 3) return json({ status: "done", video: { url: "https://vidgen.x.ai/clip.mp4" } });
      return new Response("video");
    });
    const result = gen.video("prompt", new AbortController().signal);
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(10000);
    assert.equal((await result).body.toString(), "video");
    assert.equal(calls, model.startsWith("veo") ? 2 : 4);
  }
});

test("upstream HTTP, streamed errors, refusal, truncation and early EOF are failures", async () => {
  for (const [model, response] of [
    ["gpt-6-astra", new Response("private error contents", { status: 401 })],
    ["gpt-6-astra", events([{ type: "response.incomplete" }])],
    ["gpt-6-astra", events([{ type: "response.output_text.delta", delta: "partial" }])],
    ["claude-sonnet-5", events([{ type: "error", error: { message: "secret" } }])],
    ["claude-sonnet-5", events([{ type: "message_delta", delta: { stop_reason: "max_tokens" } }])],
    ["deepseek-flash", events([{ choices: [{ finish_reason: "length" }] }])],
  ]) {
    await assert.rejects(collect(generator(model, "text", async () => response).text("x", signal())), (error) => !/private|secret/.test(error.message));
  }
});

test("media cache deduplicates, retries failures, and evicts by bytes", async () => {
  const cache = mediaCache({ maxBytes: 6 });
  let count = 0;
  const generate = async () => { count++; return { body: Buffer.from("1234"), mimeType: "image/png" }; };
  const [a, b] = await Promise.all([cache.get("a", generate, signal()), cache.get("a", generate, signal())]);
  assert.equal(a, b);
  assert.equal(count, 1);
  await cache.get("b", generate, signal());
  await cache.get("a", generate, signal());
  assert.equal(count, 3);
  await assert.rejects(cache.get("bad", async () => { throw new Error("failed"); }, signal()));
  await cache.get("bad", generate, signal());
  assert.equal(count, 4);
  cache.close();
});

test("shared media generation survives one reader abort and cancels after the last", async () => {
  const cache = mediaCache({ maxPending: 1 });
  const first = new AbortController();
  const second = new AbortController();
  let shared;
  const generate = (signal) => {
    shared = signal;
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  };
  const a = cache.get("same", generate, first.signal);
  const b = cache.get("same", generate, second.signal);
  await Promise.resolve();
  await assert.rejects(cache.get("other", generate, signal()), /Too many/);
  first.abort();
  await assert.rejects(a);
  assert.equal(shared.aborted, false);
  second.abort();
  await assert.rejects(b);
  assert.equal(shared.aborted, true);
  cache.close();
});
