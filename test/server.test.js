import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { startServer } from "../server.js";

const models = { text: { provider: "test" }, image: { provider: "test" }, video: { provider: "test" } };
const auth = { authorization: "Bearer test-token" };
const generators = {
  async *text() { yield { text: "<!doctype html><p>hello</p>" }; },
  async image() { return { body: Buffer.from("image"), mimeType: "image/png" }; },
  async video() { return { body: Buffer.from("0123456789"), mimeType: "video/mp4" }; },
};
async function serve(t, overrides = {}) {
  const server = await startServer({ hostname: "127.0.0.1", port: 0, token: "test-token", models, generators, ...overrides });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, server, get: (path, init = {}) => fetch(base + path, { ...init, headers: { ...auth, ...init.headers } }) };
}
const target = "?url=https%3A%2F%2Fexample.test%2F";

test("HTTP validation, authentication and disabled capabilities happen before generation", async (t) => {
  let calls = 0;
  const { base, get } = await serve(t, { models: { ...models, video: null }, generators: { async *text() { calls++; } } });
  assert.equal((await fetch(base + "/html" + target)).status, 403);
  for (const [path, status] of [["/html", 400], ["/html?url=nonsense", 400], ["/html?url=file:///etc/passwd", 400], ["/html?url=https://name:pass@example.test/", 400], ["/missing" + target, 404], ["/video" + target, 404]]) {
    assert.equal((await get(path)).status, status);
  }
  assert.equal((await get("/html" + target, { method: "POST" })).status, 405);
  assert.equal(calls, 0);
});

test("HTML streams early, filters secrets out of prompts, and carries security headers", async (t) => {
  let release;
  let prompt;
  const ready = new Promise((resolve) => { release = resolve; });
  const { get } = await serve(t, { generators: { ...generators, async *text(value) {
    prompt = value;
    yield { text: "<html><body>first" };
    await ready;
    yield { text: " second</body></html>" };
  } } });
  const response = await get("/html" + target + "&headers=SECRET_COOKIE&language=fr", { headers: { cookie: "SECRET", "x-api-key": "SECRET_API" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(response.headers.get("content-type"), /charset=utf-8/);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /first/);
  assert.doesNotMatch(prompt, /SECRET/);
  assert.match(prompt, /Preferred language: fr/);
  release();
  assert.match(new TextDecoder().decode((await reader.read()).value), /second/);
  await reader.cancel();
});

test("malformed media URLs cannot crash the server; repeated/range requests use one generation", async (t) => {
  let calls = 0;
  const { get } = await serve(t, { generators: { ...generators, async video() { calls++; return generators.video(); } } });
  assert.equal((await get("/image?url=bad")).status, 400);
  assert.equal(await (await get("/image" + target)).text(), "image");
  const full = await get("/video" + target);
  assert.equal(await full.text(), "0123456789");
  for (const [range, content, expected] of [["bytes=2-4", "234", "bytes 2-4/10"], ["bytes=-3", "789", "bytes 7-9/10"], ["bytes=8-", "89", "bytes 8-9/10"], ["bytes=8-99", "89", "bytes 8-9/10"]]) {
    const response = await get("/video" + target, { headers: { range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), expected);
    assert.equal(await response.text(), content);
  }
  for (const range of ["bytes=20-", "bytes=4-2", "bytes=-0", "bytes=-", "bytes=0-1,3-4", "nonsense"]) {
    assert.equal((await get("/video" + target, { headers: { range } })).status, 416);
  }
  assert.equal(calls, 1);
});

test("failures before headers are non-200, plaintext and do not echo provider HTML", async (t) => {
  const { get } = await serve(t, { generators: { ...generators, async *text() { throw new Error("<script>secret</script>"); } } });
  const response = await get("/html" + target);
  assert.equal(response.status, 502);
  assert.match(response.headers.get("content-type"), /text\/plain/);
  assert.doesNotMatch(await response.text(), /script|secret/);
});

test("disconnect and timeout abort upstream work", async (t) => {
  let stopped;
  let aborted = new Promise((resolve) => { stopped = resolve; });
  const { get } = await serve(t, { timeoutMs: 100, generators: { ...generators, async *text(_, signal) {
    try { await delay(10000, null, { signal }); }
    finally { stopped(); }
  } } });
  const response = await get("/html" + target);
  assert.equal(response.status, 504);
  await aborted;

  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  aborted = new Promise((resolve) => { stopped = resolve; });
  const second = await serve(t, { generators: { ...generators, async *text(_, signal) {
    started();
    try { await delay(10000, null, { signal }); }
    finally { stopped(); }
  } } });
  const controller = new AbortController();
  const pending = second.get("/html" + target, { signal: controller.signal });
  await ready;
  controller.abort();
  await assert.rejects(pending);
  await aborted;
});

test("partial upstream failure is a broken stream, not an error script or success", async (t) => {
  const { get } = await serve(t, { generators: { ...generators, async *text() {
    yield { text: "<p>partial</p>" };
    await delay(20);
    throw new Error("private");
  } } });
  const response = await get("/html" + target);
  await assert.rejects(response.text());
});

test("port conflicts reject startup cleanly", async (t) => {
  const { server } = await serve(t);
  await assert.rejects(startServer({ hostname: "127.0.0.1", port: server.address().port, token: "test", models, generators }), { code: "EADDRINUSE" });
});

test("CLI help/list need no credentials; invalid options fail before Chrome launches", () => {
  const list = execFileSync(process.execPath, ["index.js", "--list-models"], { encoding: "utf8" });
  assert.match(list, /claude-sonnet-5/);
  assert.match(list, /grok-imagine-video-1.5/);
  assert.match(execFileSync(process.execPath, ["index.js", "--help"], { encoding: "utf8" }), /video-generation-model/);
  for (const args of [["--port", "NaN"], ["--hostname", "0.0.0.0"], ["--request-timeout", "-1"], ["--unknown"]]) {
    assert.notEqual(spawnSync(process.execPath, ["index.js", ...args]).status, 0);
  }
});
