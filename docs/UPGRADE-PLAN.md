# Fauxmium investigation and upgrade plan

Reviewed 2026-09-17, starting at `36c9eb9`. This is a source review plus offline contract/HTTP tests and a real-Chrome smoke test. No paid generations were run. Model IDs below were checked against published provider documentation, not inferred from product names.

## Changes implemented

| Finding in the original code | Change |
| --- | --- |
| `server.js` called only Gemini; changing a CLI string could not select another provider. | Separate model catalog and generation module; independent text/image/video selection across six providers. |
| Gemini image default was an old preview ID; no video path existed. | Current native-image models, GPT Image and Grok Imagine; opt-in Omni, Veo and Grok video with polling/download support. |
| The HTML parser required a specific Markdown fence, appended `undefined` on metadata chunks, and could buffer a non-HTML response indefinitely. | Raw/fenced HTML handling, bounded preamble and chunk-boundary tests. |
| Full browser headers were included in model prompts; every generated chunk was logged. | Only URL and preferred language enter page prompts. No cookie/auth/referrer forwarding or generated-content logging. |
| The unauthenticated proxy had wildcard CORS; error HTML reflected URL/provider text. | Private per-launch token, loopback CLI binding, input validation and non-200 plaintext errors. CSP limits generated-page capabilities. |
| Invalid image URLs could throw outside the handler's `try`; filtered images could dereference missing parts. | URL validation before generation and checked media responses. |
| Startup launched Chrome without waiting for the listening socket and swallowed asynchronous failures. | Await server/browser startup; close resources on launch failure, signals and browser disconnect. |
| Requests kept generating after navigation; HTML writes ignored backpressure. | Abort signals, bounded deadlines and `drain` handling. Provider-side billing may still continue after cancellation. |
| Duplicate images and video range requests would need fresh generation. | Shared in-flight work, 64 MiB session media cache, byte-range responses, bounded concurrency. |
| README named the wrong environment key and incorrectly implied there was no CSS/JS. | Correct setup instructions, legacy key compatibility, and explicit distinction between inline and external CSS/JS. |
| The lockfile had 12 audit findings: 1 critical, 9 high, 2 moderate; Puppeteer used `*`. | Update Google SDK, Puppeteer, dotenv and yargs; constrain Puppeteer to its current major and declare Node 22.12+. Post-update audit: 0 findings. |
| `npm test` deliberately failed. | Node built-in tests; no test framework or additional provider SDK dependencies. |

The source remains small Node ES modules. No web framework, build system, database or plugin framework was introduced.

## Model catalog and evidence

`lib/models.js` is the maintained catalog. The CLI prints it directly. Defaults use Flash-Lite for lower latency/cost rather than silently moving every request to the most expensive flagship. Video remains disabled by default.

| Provider | Included text IDs | Included media IDs | Official evidence |
| --- | --- | --- | --- |
| Google | `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview` | `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3-pro-image`; `gemini-omni-1.1-flash`, `veo-3.1-generate-preview`, `veo-3.1-lite-generate-preview` | [Models](https://ai.google.dev/gemini-api/docs/models), [image generation](https://ai.google.dev/gemini-api/docs/image-generation), [Omni](https://ai.google.dev/gemini-api/docs/omni), [Veo](https://ai.google.dev/gemini-api/docs/veo) |
| OpenAI | `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` | `gpt-image-2.5-flare`, `gpt-image-2.5-sunburst` | [Models](https://developers.openai.com/api/docs/models), [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [image generation](https://developers.openai.com/api/docs/guides/image-generation), [deprecations](https://developers.openai.com/api/docs/deprecations) |
| Anthropic | `claude-fable-5-1`, `claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5-20251001` | No native image/video output | [Models](https://platform.claude.com/docs/en/models/overview), [Fable 5.1](https://platform.claude.com/docs/en/models/fable-5-1/overview) |
| xAI | `grok-4.6` | `grok-imagine-image-2.0`, `grok-imagine-video-1.5` | [Models](https://docs.x.ai/developers/models), [images](https://docs.x.ai/developers/model-capabilities/images/generation), [video](https://docs.x.ai/developers/model-capabilities/video/generation) |
| DeepSeek | `deepseek-flash`, `deepseek-v4-pro` | — | [Models and pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| Mistral | `mistral-medium-3-5`, `mistral-small-2603` | — | [Medium 3.5](https://docs.mistral.ai/models/mistral-medium-3-5-26-04), [Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03) |

**Deliberate exclusions:** OpenAI lists Sora 2 and the Videos API for shutdown on **2026-09-24**, with no replacement. Google lists Imagen 4 as deprecated. Neither is a sensible new integration. Gemini Pro/Veo IDs ending in `preview` remain explicitly marked by their IDs; access and lifecycle differ from stable models. Restricted research/security models and audio/embedding models do not serve this project's generation paths.

Gemini now uses the [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview), generally available and recommended for new work; native images and Omni return media through it. Veo still has a separate operation API. OpenAI uses [Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses), Claude uses [Messages streaming](https://platform.claude.com/docs/en/api/messages-streaming), and Grok/DeepSeek/Mistral use compatible chat completions. These adapters normalize text/usage rather than pretending every vendor has the same request format.

## Validation and limits of the evidence

Run `npm test`, `npm run test:browser` and `npm audit` from the checkout.

The offline checks cover the installed Google SDK against mock HTTP responses, all other provider request/response contracts, split UTF-8/SSE/HTML chunks, rejected/truncated generations, no-key CLI listing, proxy authentication, malformed URLs, cancellation, timeouts, shared caching and range handling. The Chrome check verifies real interception, image rendering, navigation/forms, blocked fetches and that cookie/auth values do not enter prompts. Video interception is tested with mock bytes, not a decodable provider clip.

Measured functional improvements: duplicate media consumers share one generation; repeated video ranges reuse one result; the first HTML chunk reaches the HTTP client before completion. These tests do **not** establish provider latency, image quality, playback compatibility or a percentage speedup. Token logs are usage counts, not money accounting. No live account access or model entitlement was verified.

## Next work, in order

Effort labels are rough implementation sizes: S = a focused change; M = several coordinated changes; L = a product/architecture change. They are not delivery estimates.

### 1. Release gates and spending controls — P0, S–M

Before publishing the new integrations:

- Run an explicitly budgeted live smoke test for each advertised provider/capability: one small page, one image, and one short video where supported. Check actual MIME types, decoding, model access and billing. Test Veo/xAI pending → done and failure states against the service, not only fixtures.
- Add a trusted, non-generated confirmation before the first video job and a per-session generation-count ceiling. `preload="none"` is currently a prompt instruction; generated JS can bypass it. Concurrency limits stop bursts but do not cap total spend.
- Record provider job IDs before polling, and show when a job may still be running after local cancellation. Never retry a billable submission automatically unless the endpoint's idempotency contract is verified.
- Add CI for the offline tests on Node 22/24 and the pinned Chrome smoke test. Keep paid tests manual/credential-gated.

Acceptance: a clean checkout runs the offline suite; each live path has a dated result and cost; declining a video confirmation creates zero jobs; a reached session ceiling prevents subsequent submissions.

### 2. Separate trusted browser controls from generated content — P1, L

`browser.js` still rewrites requests in a real browser whose address bar displays the simulated site's origin. A page CSP and HTTP interception are useful restrictions, but they are not comprehensive Chromium network isolation. Popup target timing, browser-internal traffic, downloads and non-HTTP transports need their own threat model.

Prototype a Fauxmium-owned viewer with an opaque-origin sandboxed content frame and a trusted toolbar outside it. Keep URL-driven exploration, but explicitly evaluate the tradeoff with the current address-bar experience before replacing it. Route all permitted navigation and media actions through the controller; deny other network paths at the browser/proxy boundary. Keep the generated-page warning outside model control.

Acceptance: adversarial generated content cannot reach a local service, open an unintercepted window, register a service worker, leak data through a socket, or trigger paid media without approval. Model output cannot obscure the trusted simulation/status controls.

### 3. Make media generation a job, not a long HTTP request — P1, M

A video request currently occupies an HTTP connection while the provider generates and downloads the clip. The session cache prevents duplicate work, but a restart loses jobs and results. Large files are buffered in memory and are rejected above 64 MiB.

Introduce a small job record containing provider/model, prompt hash, operation ID, state and asset path. Return a loading/poster state immediately, poll a local status endpoint and serve a stable asset URL once ready. Stream downloads to a bounded temporary directory and serve byte ranges from disk. Start with a local manifest, adding SQLite only if restart recovery/concurrent mutations justify it. Do not add a queue service for a single-user desktop demo.

Acceptance: no duplicate jobs on seeking/reload; a bounded disk budget; expired provider URLs do not break saved clips; timeout/restart states are visible and do not cause silent resubmission.

### 4. Measure first content and control media cost — P1, M

Add opt-in local JSONL metrics: route, provider/model, queue delay, first HTML byte, completion time, reported token usage, cache hit, cancellation and error category. Do not record full URLs, prompts or generated content. Build a fixed small navigation corpus with a cold and warm pass.

Then compare:

- Flash-Lite/default vs flagship models using p50/p95 first-content latency and a scored HTML-validity/accessibility check.
- Requested image dimensions/aspect ratio mapped to each provider's supported sizes, rather than always paying for a large generic image. URL dimensions currently constrain layout, not the generated asset resolution.
- Visible-first image generation and explicit media budgets. Prompted lazy loading already helps, but a controller-enforced policy is stronger.
- A bounded page cache keyed by normalized URL, model, prompt version and session-world state. Only cache complete successful documents; offer an explicit regenerate action.

Acceptance: publish cold/warm measurements and quality scores before changing defaults. Budget checks must cover background tabs and media, not only the main document. Avoid claiming speed gains from token counts alone.

### 5. Give a fictional site memory — P2, M

Today `/about` and `/products` are unrelated generations. Store a short per-site brief: identity, palette, characters/products, invented facts and visited paths. Pass a bounded summary to subsequent pages and media descriptions; keep the model/provider neutral so switching vendors does not reset the world. A session `Map` is enough initially.

Acceptance: a three-page journey retains the same site name, navigation and key facts without feeding the entire browsing history back into every request. Form state remains fictional/local and never requests credentials.

### 6. Keep the catalog current without surprising users — P2, S

Add an explicit discovery/check command that queries provider model endpoints where capability metadata is reliable, and reports deprecations separately. Review catalog updates and link official release notes. Never silently switch a pinned model, enable a modality or increase the spend profile during a session. Refresh the verification date only when the IDs and endpoint contracts have been checked.

Acceptance: unavailable/deprecated IDs are visible before browsing; an unknown new ID in a supported API family can be selected explicitly; a catalog refresh does not alter configured defaults.

## Product experiments after the release gates

| Idea | Small first version | Why try it |
| --- | --- | --- |
| World seed | A launch prompt such as “the web in 1998” or “a city on Europa,” carried through the site brief. | Creates coherent exploration rather than isolated novelty pages. |
| Freeze and share | Save one page plus generated assets and a provenance manifest with model IDs/date. No keys or source cookies. Disable active scripts in the shared export by default. | A useful result survives regeneration and provider shutdowns. |
| Branch history | “Regenerate this page” creates an alternative without deleting the previous version; retain a small bounded history. | Users can explore variations without losing a good page. |
| Model comparison | Generate the same URL with two explicitly selected text models, recording latency, token use and a user rating. Paid, opt-in, fixed request count. | Choose defaults from this workload rather than generic benchmarks. |
| Accessible-web mode | Prefer native controls; run a browser accessibility check after generation and offer one bounded repair pass. | Makes quality inspectable without an unlimited self-repair loop. |

Recommended next increment: **budgeted live validation plus trusted video approval**, followed by the job/asset layer. Shared site memory is the most promising product addition once those costs and lifecycles are under control.
