import test from "node:test";
import assert from "node:assert/strict";
import { startBrowser } from "../browser.js";
import { startServer } from "../server.js";

// Real Chrome, fake provider responses: no API keys or paid provider calls.
test("Chrome renders intercepted HTML/images, follows links/forms, and blocks live network APIs", { timeout: 45000 }, async (t) => {
  const models = { text: {}, image: {}, video: {} };
  const prompts = [];
  let images = 0;
  let videos = 0;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR0kAAAAASUVORK5CYII=", "base64");
  const server = await startServer({
    hostname: "127.0.0.1", port: 0, token: "browser-test", models,
    generators: {
      async *text(prompt) {
        prompts.push(prompt);
        yield { text: `<!doctype html><html lang="en"><head><title>Fauxmium test</title></head><body>
          <h1>Generated page</h1><img src="https://fiction.test/picture.png?description=a+test" width="1" height="1" alt="test">
          <a id="next" href="https://fiction.test/next">Next</a>
          <form action="https://fiction.test/search" method="get"><label>Search <input name="q" value="hello"></label><button>Search</button></form>
          <video controls preload="none" src="https://fiction.test/clip.mp4?description=short+clip"></video>
          <script>document.body.dataset.script = 'works'; fetch('https://must-not-leak.invalid/secret').catch(() => { document.body.dataset.blocked = 'yes'; });</script>
          </body></html>` };
      },
      async image() { images++; return { body: png, mimeType: "image/png" }; },
      async video() { videos++; return { body: Buffer.from("mock-video"), mimeType: "video/mp4" }; },
    },
  });
  t.after(() => { server.close(); server.closeAllConnections(); });
  const browser = await startBrowser({ hostname: "127.0.0.1", port: server.address().port, token: "browser-test", models, headless: true });
  t.after(() => browser.close());
  const [page] = await browser.pages();
  for (const [width, height] of [[390, 844], [1280, 720]]) {
    await page.setViewport({ width, height });
    assert.equal(await page.$eval("html", (el) => el.lang), "en");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok(await page.$("main"));
    if (process.env.FAUXMIUM_SCREENSHOTS) await page.screenshot({ path: `/tmp/fauxmium-warning-${width}.png`, fullPage: true });
  }
  await browser.defaultBrowserContext().setCookie({ name: "private", value: "COOKIE_SECRET", domain: "fiction.test", path: "/", secure: true });
  await page.setExtraHTTPHeaders({ authorization: "Bearer SITE_SECRET" });
  await page.goto("https://fiction.test/", { waitUntil: "networkidle0" });
  assert.equal(await page.title(), "Fauxmium test");
  assert.equal(await page.$eval("img", (el) => el.naturalWidth), 1);
  assert.equal(await page.$eval("body", (el) => el.dataset.script), "works");
  assert.equal(await page.$eval("body", (el) => el.dataset.blocked), "yes");
  assert.equal(videos, 0, "preload=none must not generate a video before playback");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#next")]);
  assert.equal(page.url(), "https://fiction.test/next");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);
  assert.equal(page.url(), "https://fiction.test/search?q=hello");
  assert.equal(images, 1, "repeated image requests must be cached");
  assert.ok(prompts.every((prompt) => !/COOKIE_SECRET|SITE_SECRET|browser-test/.test(prompt)));
  // Exercise the media interception path; fixture bytes are not a decodable video.
  await page.$eval("video", (el) => { el.load(); void el.play().catch(() => {}); });
  await page.waitForFunction(() => document.querySelector("video").error !== null);
  assert.equal(videos, 1);
});
