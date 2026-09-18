// test/registry.test.js — the registry/cost coupling, checked rather than
// trusted. `config/providers.js` is the CLI's allowlist (yargs enforces the
// choices) and `lib/costCalculator.js` prices MODELS BY ID, so a current model
// id missing a fallback silently prices at 0 whenever Helicone has no row.
// A newly-correct id that costs nothing is a worse failure than a stale one.
//
// Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { PROVIDERS } from "../config/providers.js";
import { costCalculator, sessionCosts, loadCosts } from "../lib/costCalculator.js";

const KINDS = ["text", "image", "video"];

// Groq hosts third-party models and was NOT re-verified in the registry pass, so
// its default is deliberately unpriced rather than guessed. Named here so the
// exemption is explicit and visible: adding a Groq price means deleting this.
const UNVERIFIED_PROVIDERS = new Set(["groq"]);

test("every provider default is one of its own choices", () => {
  for (const [provider, config] of Object.entries(PROVIDERS)) {
    for (const kind of KINDS) {
      const section = config[kind];
      if (!section?.defaultModel) continue;
      assert.ok(
        section.choices.includes(section.defaultModel),
        `${provider}.${kind}: default '${section.defaultModel}' is not in choices`,
      );
      assert.equal(
        new Set(section.choices).size,
        section.choices.length,
        `${provider}.${kind}: duplicate choice`,
      );
    }
  }
});

test("every selectable default prices above zero through the fallback table", async () => {
  // Force the fallback path: Helicone answers, with no row for the model. (An
  // ERROR response is a different path — see the "unknown price" test below.)
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const defaults = [];
    for (const [provider, config] of Object.entries(PROVIDERS)) {
      for (const kind of KINDS) {
        const model = config[kind]?.defaultModel;
        if (model && !UNVERIFIED_PROVIDERS.has(provider)) defaults.push({ provider, kind, model });
      }
    }
    assert.ok(defaults.length > 0, "the registry exposes no defaults to check");

    for (const { provider, kind, model } of defaults) {
      const before = sessionCosts.total;
      await loadCosts(model);
      const calc = costCalculator(model, `test:${provider}:${kind}`);
      // The AI SDK's usage shape (inputTokens/outputTokens/totalTokens), and a
      // case where OUTPUT < INPUT: the pre-fix mapping made that negative.
      calc({ text: "", usage: { inputTokens: 1_000_000, outputTokens: 400_000, totalTokens: 1_400_000 } });
      const entry = calc({ END: true });
      assert.ok(
        Number.isFinite(entry.cost) && entry.cost > 0,
        `${provider}.${kind} default '${model}' priced at ${entry.cost} — add it to the perMillion table in lib/costCalculator.js`,
      );
      assert.equal(entry.promptTokenCount, 1_000_000);
      assert.equal(entry.outputTokenCount, 400_000, "output tokens must be total minus input, never negative");
      assert.ok(sessionCosts.total > before, "session accounting did not advance");
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("floating Google -latest aliases price as their current equivalents", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    await loadCosts("gemini-flash-latest");
    const calc = costCalculator("gemini-flash-latest", "test:alias");
    calc({ text: "", usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 } });
    const entry = calc({ END: true });
    assert.equal(entry.model, "gemini-3.8-flash", "the alias must resolve to the current flash");
    assert.ok(entry.cost > 0, "the alias must price above zero");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a price that cannot be looked up is 0 and FINITE — never NaN, never negative", async () => {
  // Offline / provider error: the honest outcome is a 0 rate with a warning, and
  // the accounting never produces NaN or a negative number.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    await loadCosts("gemini-3.8-flash");
    const calc = costCalculator("gemini-3.8-flash", "test:offline");
    calc({ text: "", usage: { inputTokens: 1_000_000, outputTokens: 400_000, totalTokens: 1_400_000 } });
    const entry = calc({ END: true });
    assert.ok(Number.isFinite(entry.cost), `cost must be finite, got ${entry.cost}`);
    assert.ok(entry.cost >= 0, `cost must never be negative, got ${entry.cost}`);
    assert.equal(entry.outputTokenCount, 400_000);
  } finally {
    globalThis.fetch = realFetch;
  }
});
