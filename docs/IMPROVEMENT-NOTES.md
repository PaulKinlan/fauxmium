# What to improve in fauxmium — measured notes

2026-09-18, against current `main` (`8ee0228`, v0.0.8). Everything here is either a fact about this repository's
source or a published provider price; nothing was verified live because no paid calls were made. Plan for the
port of the earlier branch's work: [`TEST-PORT-PLAN.md`](TEST-PORT-PLAN.md).

## 1. The model registry is stale — this is the first thing to change (fixed on `feat/registry-refresh`)

`config/providers.js` is the live registry, and its choices lag the providers by a generation or two:

- Google **text**: default `gemini-3.5-flash`, with `gemini-2.5-pro` / `gemini-2.5-flash` / `-latest` aliases still
  listed. **`gemini-3.8-flash` (GA 2026-09-02) is absent.**
- Google **image**: `gemini-2.5-flash-image` is the default *and the only choice*. The current image line is
  `gemini-3.1-flash-image` (Nano Banana 2), `gemini-3.1-flash-lite-image` and `gemini-3-pro-image`.
- OpenAI **text**: default `gpt-5.5-instant`, choices still include `gpt-4-mini`; the current line is
  `gpt-6-astra` / `gpt-5.6-sol` / `-terra` / `-luna`.
- OpenAI **image**: `dall-e-3` / `dall-e-2`; the current line is `gpt-image-2.5-flare` / `-sunburst`.
- Anthropic: default `claude-sonnet-4-6` with 3.x-era choices; the current line is `claude-fable-5-1`,
  `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5`.
- Groq: third-party-hosted models; **not re-verified here** — check separately rather than guessing.
- Video: the `veo-3.1` family is current.

`lib/costCalculator.js` carries fallbacks keyed to the **old** ids, so a registry refresh has to move both files
together or new ids price at 0 whenever Helicone has no row. The README's examples (`gemini-2.5-flash-image`,
`veo-3.0-fast-generate-preview`) are stale for the same reason.

**Deliberately not re-cut**: `--model image-model` style provider-qualified ids should keep working for models
newer than the catalog, so the registry is a suggestion list, not an allowlist.

## 2. Cost is visible — and not capped

Good news first, because it narrows the recommendation: cost tracking is real here.
`lib/costCalculator.js` fetches per-model prices from Helicone with hardcoded fallbacks, and it is wired into
**all three** generation paths — `server/processHTML.js`, `server/processImage.js`, `server/processVideo.js` —
with `sessionCosts` accumulated in `server/index.js` and exposed at `GET /cost`. So "you cannot see what you
spend" is not the problem.

Two caveats before trusting the number, then the real problem.

First, the accounting itself was wrong until the registry refresh landed with it: the usage mapping read
`usage.totalTokens` but assigned `usage.outputTokens` to the total, so the derived output count was **negative
whenever input > output** — the usual shape for page generation (long prompt, shorter page) — and `NaN` when a
provider reported only totals. The floating `-latest` aliases additionally priced at 0 because they were loaded
under the alias key and looked up under the canonical one. Both are fixed on `feat/registry-refresh`; treat any
cost figure recorded before it as unreliable.

Second, the problem is that **nothing acts on the number**: there is no ceiling, budget, confirmation or alert
anywhere in the JS, and `processVideo` logs its work but records **no provider job IDs**, so a clip that is
cancelled locally or times out during polling can still be billed with nothing afterwards showing it. With published prices and the
request shapes this code produces, the asymmetry is stark:

| Artifact | Cheap end | Expensive end |
| --- | --- | --- |
| HTML page (~2k in / ~4k out) | DeepSeek-class ≈ $0.002 | `gpt-6-astra` ($10/$50) ≈ **$0.22** |
| Image (1K) | `gpt-image-2.5` low 1024² ≈ **$0.006** | Nano Banana 2 2K ≈ **$0.10** |
| Video (8 s, provider default length) | xAI Imagine $0.05/s ≈ **$0.40** | `veo-3.1` $0.20–0.40/s ≈ **$1.60–3.20** |

One 8-second clip is therefore **100–600 generated pages**, or 10–90 images. Nothing in the prompt pipeline
bounds how many clips a browsing session can trigger (`processHTML` may include a video element per page, and the
video prompt specifies no duration).

Two price facts worth keeping in view: Google's `gemini-3.8-flash` rate ($0.75/$3.75 per 1M) is **introductory
through 2026-12-31 and doubles on 2027-01-01**, and DeepSeek has off-peak/peak tiers that make a fixed default
look cheaper than it is.

## 3. The risk cluster: visible-but-uncapped cost + no abort + an open proxy

These three compound, which is why they should be read together rather than as three separate items:

1. cost is **measured** but never **capped** (above);
2. `lib/aiAdapter.js` passes **no abort signal**, so a page that has started a billable job has no lever to stop
   it — navigation, timeout and shutdown all let the provider keep generating and billing;
3. the proxy is **open to any local page**: `server/index.js` sets `Access-Control-Allow-Origin: *` and requires
   no token, so any page that can reach `127.0.0.1:3001` can drive generation on your key.

Together: an unbounded, unstoppable, locally-triggerable spending path. Individually each is a small fix; the
combination is the reason the ceiling belongs near the top of the list rather than at the bottom.

## 4. Other measured gaps (upstream, today)

1. **The proxy is open to any local page.** `server/index.js` sets `Access-Control-Allow-Origin: *` and takes no
   token, so any page that can reach `127.0.0.1:3001` can drive generation on your key. (The stale branch added a
   per-launch token and dropped the wildcard; that is worth porting.)
2. **No generated-page containment headers.** No CSP, Referrer-Policy or Permissions-Policy is set; generated
   pages run with whatever the browser default allows.
3. **No cancellation path.** `lib/aiAdapter.js` passes no abort signal, so a navigated-away page or a timeout
   keeps the upstream request alive and billable.
4. **No automated coverage at all.** `npm test` is `echo "Error: no test specified" && exit 1`; `puppeteer` is
   pinned to `*`. Every behaviour above is currently unprotected.
5. **Prompt content is not filtered.** Page context enters prompts; cookie/auth/referrer values should not.

## 5. Recommended order

| # | Change | Why first |
| --- | --- | --- |
| 1 | Registry refresh (`config/providers.js` + cost fallbacks + README examples) — **done on `feat/registry-refresh`** | Self-contained, user-visible, and it fixed two silent cost-accounting bugs on the way |
| 2 | A test seam in `lib/aiAdapter.js` (or configurable base URLs) | Enables every other item to be pinned |
| 3 | Proxy auth + drop the CORS wildcard; CSP/Referrer-Policy/Permissions-Policy | Cheap, closes a local-page attack and containment gap |
| 4 | Abort signal wiring + recorded provider job IDs + no auto-retry of billable submissions | Stops paying for work nobody is waiting for |
| 5 | A session spend ceiling and a trusted confirmation before the first video | One clip dominates a session's cost (see §2) |
| 6 | Port the branch's tests/hardening per the port plan | Coverage arrives with the behaviours it describes |

## 6. Not verified (needs a key and a budget)

Account entitlements and regional access; output quality; whether the `veo-3.1`/`gpt-image-2.5` ids are enabled
for a given key; actual billing (cache-hit rates, off-peak tiers, the January 2027 Gemini step); real clip
decoding and playback.

## 7. First five minutes

```bash
npm ci
GEMINI_API_KEY=... npm start          # default command: Google text + Google images
# or pick a provider explicitly, with a model from the registry:
GEMINI_API_KEY=... npx fauxmium gemini --model gemini-3.8-flash --image-model gemini-3.1-flash-image
```

Then browse a few links: pages and images generate on request. Watch, in this order — `GET http://127.0.0.1:3001/cost`
accruing per page, whether an image request is served from cache on a repeat visit, and (only when you have
decided to spend it) a video request, with its runtime and the eventual `sessionCosts` delta. The registry's
stale ids are the first thing to fix, so comparisons made before step 1 are comparisons against older models.
