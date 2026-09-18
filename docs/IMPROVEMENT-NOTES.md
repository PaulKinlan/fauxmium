# What to improve in fauxmium — measured notes

Written 2026-09-18, after preserving the uncommitted upgrade as commit `6846b10` and re-verifying the model
catalog. No paid provider calls were made: everything below is either published provider pricing or a fact
about this repository's source. Where I could not verify something I say so.

## 1. The catalog is current (re-verified 2026-09-18)

Every ID in `lib/models.js` was checked against first-party provider documentation today. **Nothing needed
changing** — the catalog was written 2026-09-17 and is still accurate:

| Provider | Checked | Evidence |
| --- | --- | --- |
| Google | `gemini-3.8-flash` (GA 2026-09-02), `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`; `gemini-3.1-flash-image` / `gemini-3.1-flash-lite-image` / `gemini-3-pro-image` (Nano Banana 2 / 2 Lite / Pro) | [Models](https://ai.google.dev/gemini-api/docs/models), [pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| OpenAI | `gpt-6-astra` ($10/$50), `gpt-5.6-sol` ($4/$20), `gpt-5.6-terra` ($2/$12), `gpt-5.6-luna`; `gpt-image-2.5-flare` / `-sunburst` | [Models](https://developers.openai.com/api/docs/models), [pricing](https://developers.openai.com/api/docs/pricing) |
| Anthropic | `claude-fable-5-1` ($10/$50, the recommended top tier), `claude-opus-5` ($5/$25), `claude-sonnet-5` ($2/$10), `claude-haiku-4-5` | [Models](https://platform.claude.com/docs/en/models/overview), [pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| xAI | `grok-4.6` ($2/$6); `grok-imagine-image-2.0` and `grok-imagine-video-1.5` — both confirmed on the **first-party Imagine page**, not a reseller | [Imagine](https://docs.x.ai/developers/model-capabilities/imagine), [models](https://docs.x.ai/developers/models) |
| DeepSeek | `deepseek-flash` (documented, with `deepseek-v4-flash` as a legacy alias), `deepseek-v4-pro` | [Models & pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| Mistral | `mistral-medium-3-5` ($1.50/$7.50), `mistral-small-2603` ($0.15/$0.60) | [Model selection guide](https://docs.mistral.ai/models/model-selection-guide) |

Two IDs I checked because they looked suspicious and are **correct**: `grok-imagine-image-2.0` (a reseller
listing also shows an unversioned `grok-imagine-image-quality`, which is why this needed the first-party page)
and `deepseek-flash` (the docs accept it, with `deepseek-v4-flash` as an alias).

## 2. What one generated artifact costs (published prices, 2026-09-18)

Using the request shapes this code actually produces — one HTML page per navigation, images by URL, at most one
video per page (`server.js`), and `prompts/video.txt` specifying **no duration** — the published prices give:

| Artifact | Cheap end | Default in this repo | Expensive end |
| --- | --- | --- | --- |
| HTML page (~2k in / ~4k out) | DeepSeek V4-Flash $0.14/$0.28 → **< $0.002** | `gemini:gemini-3.5-flash-lite` → **≲ $0.005** | `gpt-6-astra` $10/$50 → **≈ $0.22** |
| Image (1K) | GPT Image 2.5 low 1024² ≈ **$0.006** | `gemini:gemini-3.1-flash-lite-image` ($30/M image tokens) ≈ **$0.034** | Nano Banana 2 2K ≈ $0.101; GPT Image 2.5 high ≈ $0.053 |
| Video (8 s, provider default length) | `grok-imagine-video-1.5` @ $0.05/s (480p) ≈ **$0.40** | **disabled by default** | `veo-3.1` @ $0.20–$0.40/s ≈ **$1.60–$3.20** |

Read that table as one sentence: **one 8-second video costs roughly what 100–600 generated pages or 10–90
images cost.** Video is opt-in at the CLI, but once a video model is selected the *page prompt* decides whether
to request a clip, and nothing in the request path bounds how many clips a browsing session can trigger.

Gemini's `gemini-3.8-flash` pricing is also promotional: $0.75/$3.75 per 1M through 2026-12-31, doubling to
$1.50/$7.50 on 2027-01-01. A default that is cheap today will not be cheap in January.

## 3. The gaps this exposes in the code

1. **`lib/costCalculator.js` is a token logger, not a cost calculator.** It prints
   `Tokens: prompt=… total=… (not a price estimate)`. It is wired into the **text path only**
   (`server.js:82`), so the two expensive paths — images and video — are not counted at all. Meanwhile
   `lib/generation.js` already normalizes usage for every provider into `{ usageMetadata: { promptTokenCount,
   totalTokenCount } }` (Gemini Interactions, OpenAI Responses, Claude Messages, and the chat-completions
   trio). The data to price a request is already arriving; nothing prices it.
2. **No session spending ceiling.** Media *concurrency* is bounded (four jobs) and the cache deduplicates
   identical URLs, but nothing caps total spend — an unbounded browsing session can keep generating. The
   upgrade plan already asks for a trusted confirmation before the first video; the table above quantifies why
   that is the single highest-value control in this repository.
3. **Billable work can outlive cancellation.** `docs/UPGRADE-PLAN.md` records that provider-side billing may
   continue after local cancellation and that job IDs are not recorded before polling, so a cancelled Veo/xAI
   video can still be charged with nothing on screen or on disk showing it. `--video-timeout` (600 s default)
   bounds the *wait*, not the *charge*.
4. **The media cache is memory-only and per-session** (64 MiB, `lib/mediaCache.js`). A second run of the same
   browse path regenerates everything, paying again. Byte-range reuse and shared in-flight work are already
   solved; durability across runs is not.
5. **Video playback is unverified.** The Chrome test drives routing with mock bytes, not a decodable clip, so
   "does a generated video actually play in the page" is an open question, and the browser is experimental, not
   a sandbox (its own CSP cannot stop a generated page from issuing network requests the interception layer
   does not cover).

## 4. Recommended order

| # | Change | Size | Why first |
| --- | --- | --- | --- |
| 1 | Turn the existing usage into an **honest cost estimate** per request and per session (a small price table beside the catalog; keep the word "estimate") | S | Makes every later decision measurable; the counter is already wired for text, and media needs the same call |
| 2 | **Session ceilings + a trusted first-video confirmation**; record provider job IDs before polling; never auto-retry a billable submission | S–M | The only bounded-spend control; a single clip dominates a session's cost |
| 3 | Budgeted **live smoke** per advertised provider/capability (one page, one image, one short clip), kept manual and credential-gated | M | Nothing in the current evidence proves entitlements, MIME/decoding or billing |
| 4 | Persist media/jobs on disk and reuse across sessions; revisit the 64 MiB cap | M | Removes repeat spend for a repeated browse path |
| 5 | Keep the catalog dated and re-verify on a schedule, with the Jan-2027 Gemini price step in mind | S | Prices move faster than model IDs |

## 5. What was not verified

Provider account entitlements and regional access; output quality; real clip decoding and playback; actual
billing (cache-hit rates, DeepSeek's off-peak rates, Gemini's promotional window); whether
`gemini-3.1-pro-preview`/`veo-3.1-*-preview` are enabled for a given key. All of it needs a key and a budget.

## 6. First five minutes (how to test this today)

```bash
npm ci
node index.js --list-models          # no key needed: the catalog, keys and defaults
GEMINI_API_KEY=... npm start         # default: gemini-3.5-flash-lite + flash-lite image, no video
```

The app prints `Fauxmium proxy listening on 127.0.0.1:3001` and opens Chrome against it with a per-launch
token; browse links and the pages, images and (if enabled) video are generated on request. Then try the
expensive direction deliberately:

```bash
GEMINI_API_KEY=... node index.js -t gemini:gemini-3.8-flash -i gemini:gemini-3.1-flash-image
OPENAI_API_KEY=... node index.js -t openai:gpt-5.6-luna -i openai:gpt-image-2.5-flare
GEMINI_API_KEY=... node index.js -v gemini:veo-3.1-generate-preview     # the video path — budget it
```

Checks worth running before a live browse: `npm test` (offline provider/HTTP contracts), `npm run test:browser`
(real headless Chrome with mocked providers), `npm audit`. What an operator should watch first: the token line
per page (it is the only cost signal today) and whether a page that requests a video actually returns a
playable clip.
