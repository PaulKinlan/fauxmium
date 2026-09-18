# Porting the stale branch's work onto upstream `main` — classification and plan

2026-09-18. `feat/model-reverify-and-notes` (`da130a2`) was cut from `36c9eb9` **before** main diverged, so it
is 34 behind and 2 ahead — it is **not a merge candidate**. It is a source of value to port, and this document
is the survey that decides what transfers, what does not, and what upstream is missing. Nothing here has been
implemented yet.

## 0. The finding that should go first: the trunk's model registry is stale

Paul's ask was "update the models", and on the live trunk that is `config/providers.js` — not the branch's
catalog file. Measured against first-party documentation today (2026-09-18):

| Provider / kind | Upstream today | Current (verified 2026-09-18) | Evidence |
| --- | --- | --- | --- |
| Google text | default `gemini-3.5-flash`; choices include `gemini-2.5-pro`, `gemini-2.5-flash`, `-latest` aliases, previews | `gemini-3.8-flash` (**GA 2026-09-02**) as default; keep `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview` | [Models](https://ai.google.dev/gemini-api/docs/models), [3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) |
| Google image | default `gemini-2.5-flash-image`, and it is the **only** choice | `gemini-3.1-flash-image` (Nano Banana 2), `gemini-3.1-flash-lite-image` (2 Lite), `gemini-3-pro-image` (Pro) | [3.1 Flash-Lite Image](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-image) |
| Google video | `veo-3.1-fast-generate-preview` + `veo-3.1-*` | current; optionally add `gemini-omni-1.1-flash` | [Veo](https://ai.google.dev/gemini-api/docs/veo) |
| OpenAI text | default `gpt-5.5-instant`, choices still list `gpt-4-mini` | `gpt-6-astra` (flagship), `gpt-5.6-sol` / `-terra` / `-luna` | [Models](https://developers.openai.com/api/docs/models) |
| OpenAI image | default `dall-e-3`, choices `dall-e-3`/`dall-e-2` | `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` | [Pricing](https://developers.openai.com/api/docs/pricing) |
| Anthropic text | default `claude-sonnet-4-6`, choices from the 3.x/4.0 era | `claude-fable-5-1` (top tier), `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5` | [Models](https://platform.claude.com/docs/en/models/overview) |
| Groq text | `llama-3.3-70b-versatile` and friends | **not re-verified** — Groq hosts third-party models; treat as a separate check, do not guess | — |

`lib/costCalculator.js` carries hand-written fallbacks keyed to the **old** ids (`dall-e-2`, `dall-e-3`,
`gemini-2.5-flash-image`, `gemini-3.5-flash`, `gemini-3.1-pro`, `gemini-3.1-flash-lite`, veo). A registry refresh
must move them together, or the new ids silently price at 0 when Helicone has no row.

## 1. Suite classification (23 tests on the branch)

Upstream's model layer is `lib/aiAdapter.js` (`streamText`, `generateImage`, `generateVideo`) over the Vercel AI
SDK; the server is split into `server/{index,processHTML,processImage,processVideo}.js`. **`aiAdapter` has no
injection seam** (it constructs SDK models directly) and passes **no abort signal**, which decides most of the
table.

### A. Architecture-independent — port with adaptation

| Branch test | Ports to | Adaptation |
| --- | --- | --- |
| prompt values literal + substituted once | `lib/prompts.js`, `lib/interpolate.js` | none beyond upstream's module names |
| HTML extraction at every chunk boundary / raw HTML / usage-only chunks | `lib/streamCodeBlocks.js`, `lib/processChunks.js` | feed the shapes `aiAdapter.streamText` actually yields |
| HTTP validation, auth and disabled-capability checks before generation | `server/index.js` | upstream has no private token — becomes part of the hardening port (below) |
| failures before headers are non-200, plaintext, provider HTML never echoed | `server/index.js`, `server/processHTML.js` | keep; it pins an upstream behaviour worth locking |
| partial upstream failure is a broken stream, never a success | `server/processHTML.js` | keep |
| port conflicts reject startup cleanly | `startServer` | direct |
| CLI help / invalid options fail before Chrome | upstream's **subcommand** CLI (`config/providers.js`, `provider` + `images`/`videos` commands) | rewrite for that shape; the branch's `--list-models` flag does not exist upstream and is proposed as an addition in step 1 |
| Chrome renders intercepted HTML/images, follows links/forms, blocks live network APIs | browser smoke | needs the step-2 seam to stub providers |

### B. Adapter-specific — do **not** port as-is

Anything asserting native provider request/response shapes is moot: upstream no longer calls those APIs
directly. That is 9 of the branch's tests: OpenAI Responses streaming, Claude Messages, the Grok/DeepSeek/Mistral
chat-completions trio, the Gemini SDK storage opt-out, per-API image shapes, Omni/Veo/xAI video job flows, and
the Gemini-SDK cancellation/no-retry test. **Two behaviours survive as requirements, not as ports**: cancellation
and "never auto-retry a billable submission" (upstream has no signal wiring at all — see step 5), and video job
polling. They get rewritten against `aiAdapter` once it has a seam, or dropped with this note as the reason.

### C. Newly needed — upstream has zero tests today (`npm test` exits 1)

- `processImage` and `processVideo` HTTP behaviour (the two expensive paths).
- Cost accounting: `loadCosts` (Helicone 200 / 404 / timeout → 0), `costCalculator` accumulation, `sessionCosts`.
- `lib/imageCache.js`: shared in-flight work, reuse, range responses.
- The third-party allowlist (Google Fonts / esm.sh / unpkg) added upstream — currently unpinned.
- Prompt-context injection (viewport, colour scheme, locale, date) added upstream — currently unpinned.

## 2. Proposed sequence (each step its own reviewed change)

1. **Registry refresh** — `config/providers.js` + `lib/costCalculator.js` fallbacks to the table in §0, with the
   evidence links in a comment. Self-contained, and it is Paul's actual ask. *No behaviour change beyond model ids.*
2. **Test seam** — an explicit, minimal injection point in `lib/aiAdapter.js` (or configurable base URLs) so a
   local mock can stand in for the SDK. This is the enabling refactor for everything in §1.A/§1.C; it must be
   reviewed as a product change, not smuggled in with tests.
3. **Port §1.A** against upstream's seams.
4. **Add §1.C** as the hardening lands (tests with the change they describe).
5. **Hardening, in risk order** (measured differences between the branch and upstream, not generic advice):
   - proxy auth + drop `Access-Control-Allow-Origin: *` (`server/index.js` sets the wildcard today);
   - CSP / Referrer-Policy / Permissions-Policy headers (upstream sets none);
   - abort/signal wiring so cancellation and timeouts stop upstream work;
   - secret filtering in page prompts (the branch strips cookie/auth/referrer values; upstream forwards context);
   - media cache + byte-range reuse (`lib/imageCache.js` exists; ranges do not);
   - a spend ceiling, a trusted first-video confirmation, and recorded provider job IDs.
6. **Re-based `docs/IMPROVEMENT-NOTES.md`** (already in this branch) updated as each step lands.

## 3. Explicitly NOT proposed

- Merging the branch, or reviving its native adapter layer: upstream's Vercel AI SDK is the model layer, and two
  model layers is the over-reach this classification exists to avoid. The branch stays as the comparison record.
- Turning `config/providers.js` into an allowlist: provider-qualified ids should keep working for models newer
  than the catalog.
- Any change to `main` before this plan is reviewed.
