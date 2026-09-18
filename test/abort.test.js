// test/abort.test.js — the upstream request is actually CANCELLED, not merely
// un-polled (fauxmium abort work, 2026-09-18).
//
// The property under test is the one that costs money: when a caller aborts, the
// PROVIDER must see the connection go away. A test that only asserted "our loop
// stopped" would pass with no signal at all, so each case runs the REAL AI SDK
// against a local mock provider that records whether its socket was closed
// before the response finished, and the control case proves the close is caused
// by the abort rather than by the mock.
//
// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { streamText, generateImage, generateVideo } from "../lib/aiAdapter.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** close() alone waits for open sockets to finish — a held/aborted response can
 * keep a test process alive forever. Destroy the sockets, then close, bounded. */
const hardClose = (server) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, 1500);
    try {
      server?.closeAllConnections?.();
      server?.close?.(() => {
        clearTimeout(timer);
        resolve();
      }) ?? (clearTimeout(timer), resolve());
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
const waitFor = async (predicate, ms = 3000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(25);
  }
  return predicate();
};

/** A provider that answers 200 with headers and then holds the body open,
 * recording every request and whether the client vanished mid-response. */
async function holdingProvider({ sse = false, body = "" } = {}) {
  const state = { requests: 0, aborted: 0, urls: [] };
  const connections = new Set();
  const server = http.createServer((req, res) => {
    state.requests += 1;
    state.urls.push(req.url);
    req.resume();
    res.writeHead(200, {
      "content-type": sse ? "text/event-stream" : "application/json",
      "cache-control": "no-cache",
    });
    if (sse && body) res.write(body);
    res.on("close", () => {
      if (!res.writableFinished) state.aborted += 1;
    });
    // never res.end(): the response stays open until the client aborts
  });
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    state,
    port,
    close: async () => {
      for (const socket of connections) socket.destroy();
      await hardClose(server);
    },
  };
}

const sse = (text) =>
  'event: message_start\ndata: {"type":"message_start","message":{"id":"m1","type":"message","role":"assistant","content":[],"model":"claude-sonnet-5","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":5,"output_tokens":0}}}\n\n' +
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
  `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(text)}}}\n\n`;

const ANTHROPIC_SSE = sse("hello");
// The page pipeline extracts HTML from the stream, so this payload must contain
// something the extractor emits — otherwise the client sees no bytes and the
// disconnect test waits on a stream that never started.
const PAGE_SSE = sse("```html\n<html><body><h1>hi</h1></body></html>");

test("text: aborting the signal cancels the in-flight provider request", { timeout: 15000 }, async () => {
  const provider = await holdingProvider({ sse: true, body: ANTHROPIC_SSE });
  try {
    const cfg = {
      provider: "anthropic",
      model: "claude-sonnet-5",
      apiKey: "test",
      baseURL: `http://127.0.0.1:${provider.port}/v1`,
    };
    const controller = new AbortController();
    const stream = streamText(cfg, "say hello", { abortSignal: controller.signal });

    // Attach the consumer BEFORE aborting: the abort surfaces as a rejection in
    // whichever promise is waiting, and a bare next() would leave it unhandled.
    const chunks = [];
    const drain = (async () => {
      try {
        for await (const chunk of stream) chunks.push(chunk);
      } catch { /* an abort may surface as a throw; the wire is what matters */ }
    })();

    assert.ok(await waitFor(() => chunks.length > 0), "the stream never produced the mock's chunk");
    assert.equal(chunks[0].text, "hello", `first chunk was ${JSON.stringify(chunks[0])}`);
    assert.equal(provider.state.requests, 1);

    controller.abort();
    // Whatever the SDK does with the aborted stream (throw or end), the PROVIDER
    // must see the socket close — that is the property that stops the billing.
    await Promise.race([drain, sleep(2000)]);
    assert.ok(
      await waitFor(() => provider.state.aborted > 0),
      "the provider never saw the connection close: the signal did not reach the wire",
    );
  } finally {
    await provider.close();
  }
});

test("control: without an abort the provider connection stays open (the close is CAUSED by the abort)", { timeout: 15000 }, async () => {
  const provider = await holdingProvider({ sse: true, body: ANTHROPIC_SSE });
  try {
    const cfg = {
      provider: "anthropic",
      model: "claude-sonnet-5",
      apiKey: "test",
      baseURL: `http://127.0.0.1:${provider.port}/v1`,
    };
    const controller = new AbortController();
    const stream = streamText(cfg, "say hello", { abortSignal: controller.signal });
    const chunks = [];
    const drain = (async () => {
      try {
        for await (const chunk of stream) chunks.push(chunk);
      } catch { /* closed below */ }
    })();
    assert.ok(await waitFor(() => chunks.length > 0), "the stream never produced the mock's chunk");
    assert.equal(chunks[0].text, "hello");

    await sleep(400); // the same window in which the aborted case closes
    assert.equal(
      provider.state.aborted,
      0,
      "the provider saw a close WITHOUT an abort — the aborted case would prove nothing",
    );

    controller.abort();
    await Promise.race([drain, sleep(2000)]);
    assert.ok(await waitFor(() => provider.state.aborted > 0), "cleanup abort did not close the stream");
  } finally {
    await provider.close();
  }
});

test("image: aborting the signal cancels the in-flight image generation", { timeout: 15000 }, async () => {
  const provider = await holdingProvider();
  try {
    const cfg = {
      provider: "openai",
      model: "gpt-image-2.5-flare",
      apiKey: "test",
      baseURL: `http://127.0.0.1:${provider.port}/v1`,
    };
    const controller = new AbortController();
    const pending = generateImage(cfg, "a red kite", { abortSignal: controller.signal });
    const settled = pending.then(
      () => "resolved",
      (err) => `rejected:${err?.name ?? err}`,
    );
    await waitFor(() => provider.state.requests > 0);
    assert.equal(provider.state.requests, 1, `no image request reached the provider: ${provider.state.urls}`);

    controller.abort();
    // Bounded: with the signal dropped the promise never settles, and the
    // failure should name THAT rather than surface as a bare test timeout.
    assert.ok(["resolved", "rejected:AbortError", "rejected:DOMException", "rejected:Error"].includes(
      await Promise.race([settled, sleep(3000).then(() => "hung")]),
    ), "the image request neither settled nor aborted within 3 s");
    assert.ok(
      await waitFor(() => provider.state.aborted > 0),
      "the provider never saw the connection close: the image signal did not reach the wire",
    );
  } finally {
    await provider.close();
  }
});

test("video: aborting the signal cancels the in-flight video request", { timeout: 15000 }, async () => {
  const provider = await holdingProvider();
  try {
    // NOTE: the Veo model resolves to the LANGUAGE-model endpoint today (see the
    // finding recorded on the bead) — the request still goes out, which is what
    // the abort plumbing must be able to cancel.
    const cfg = {
      provider: "google",
      model: "veo-3.1-fast-generate-preview",
      apiKey: "test",
      baseURL: `http://127.0.0.1:${provider.port}/v1beta`,
    };
    const controller = new AbortController();
    const pending = generateVideo(cfg, "a small red kite", { abortSignal: controller.signal });
    const settled = pending.then(
      () => "resolved",
      (err) => `rejected:${err?.name ?? err}`,
    );
    await waitFor(() => provider.state.requests > 0);
    assert.equal(provider.state.requests, 1, `no video request reached the provider: ${provider.state.urls}`);
    // The video model must be a VIDEO model: before this was pinned, the Veo id
    // was resolved through the language-model factory and the request went to
    // :generateContent (a text endpoint) instead of :predictLongRunning.
    assert.match(
      String(provider.state.urls[0]),
      /:predictLongRunning/,
      `the video request did not use the video endpoint: ${provider.state.urls[0]}`,
    );

    controller.abort();
    await Promise.race([settled, sleep(3000)]);
    assert.ok(
      await waitFor(() => provider.state.aborted > 0),
      "the provider never saw the connection close: the video signal did not reach the wire",
    );
  } finally {
    await provider.close();
  }
});

test("server: a client disconnecting mid-stream aborts the upstream provider request", { timeout: 15000 }, async () => {
  const provider = await holdingProvider({ sse: true, body: PAGE_SSE });
  let server;
  try {
    const { startServer } = await import("../server/index.js");
    const port = 0; // ask the kernel, then read it back from the listener
    server = await startServer(
      "127.0.0.1",
      port,
      {
        provider: "anthropic",
        model: "claude-sonnet-5",
        apiKey: "test",
        baseURL: `http://127.0.0.1:${provider.port}/v1`,
      },
      null,
      null,
    );
    // startServer now returns the http.Server, so the test can find its port and
    // (below) close it — after the listener is actually up.
    if (!server?.listening) {
      await new Promise((resolve) => server?.once?.("listening", resolve) ?? resolve());
    }
    const listenPort = server?.address?.()?.port;
    assert.ok(listenPort, "the server did not report a listening port");

    // A real HTTP client that reads the first bytes and then goes away.
    await new Promise((resolve) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: listenPort, path: "/html?url=https%3A%2F%2Fexample.com%2F", method: "GET" },
        (res) => {
          res.once("data", () => {
            req.destroy(); // the browser navigated away mid-stream
            resolve();
          });
        },
      );
      req.on("error", () => resolve());
      req.end();
    });

    assert.ok(
      await waitFor(() => provider.state.aborted > 0, 4000),
      "the server did not abort the provider request after the client disconnected",
    );
  } finally {
    await hardClose(server);
    await provider.close();
  }
});
