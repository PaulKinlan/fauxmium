# Fauxmium: the infinite generated web

**The websites in this browser are fictitious, generated as you browse. Do not enter passwords, payment details or personal information.** This demo is not affiliated with my employer or its products.

Fauxmium launches a separate Chrome for Testing profile and intercepts page, image and optional video requests. A local server asks your selected AI providers to generate the responses. Inline CSS and JavaScript work; external scripts, stylesheets, frames and network APIs are blocked on generated pages.

## Run from this checkout

Requires **Node.js 22.12+** and a desktop environment for Chrome.

```sh
npm ci
# Create .env in your working directory:
# GEMINI_API_KEY=your_key
npm start
```

Puppeteer installs its matching Chrome. If install scripts were disabled, run `npx puppeteer browsers install chrome` before starting. The published package can also be run with `npx fauxmium`; local changes take effect with `npm start`, not a previously published version.

The defaults favor speed and cost:

- HTML: `gemini:gemini-3.5-flash-lite`
- Images: `gemini:gemini-3.1-flash-lite-image`
- Video: disabled

Only providers selected for an enabled capability need keys. Put them in `.env` or your environment:

| Provider | Environment variable | Generation |
| --- | --- | --- |
| Google Gemini | `GEMINI_API_KEY` | Text, images, video |
| OpenAI | `OPENAI_API_KEY` | Text, images |
| Anthropic Claude | `ANTHROPIC_API_KEY` | Text |
| xAI Grok | `XAI_API_KEY` | Text, images, video |
| DeepSeek | `DEEPSEEK_API_KEY` | Text |
| Mistral | `MISTRAL_API_KEY` | Text |

`GOOGLE_API_KEY` and the previously documented `API_KEY` also work for Gemini; `GEMINI_API_KEY` takes precedence. No API keys are sent to generated pages.

## Choose models

```sh
node index.js --list-models

# Claude pages with OpenAI images (requires both keys)
node index.js -t anthropic:claude-sonnet-5 -i openai:gpt-image-2.5-flare

# OpenAI pages without images; no Google key needed
node index.js -t openai:gpt-5.6-terra -i none

# Gemini's newest Flash model and opt-in Omni video
node index.js -t gemini:gemini-3.8-flash -v gemini:gemini-omni-1.1-flash

# Grok for every modality
node index.js -t xai:grok-4.6 -i xai:grok-imagine-image-2.0 -v xai:grok-imagine-video-1.5
```

`--list-models` lists a curated catalog re-verified on **2026-09-18** (per-artifact costs and what to improve next: `docs/IMPROVEMENT-NOTES.md`), including GPT-6 Astra, GPT-5.6, Claude Fable 5.1/Opus 5/Sonnet 5, Nano Banana, Veo, DeepSeek and Mistral. Bare IDs such as `gemini-3.8-flash` still work. Provider-qualified IDs allow newer models in supported API families without waiting for a catalog update. Model access, preview availability, pricing and regional restrictions depend on your provider account.

Claude does not generate image/video files; choose another provider for those capabilities. Sora is not offered because OpenAI schedules its video API shutdown for September 24, 2026. See [the upgrade plan and official sources](docs/UPGRADE-PLAN.md).

### Options

| Option | Default | Meaning |
| --- | --- | --- |
| `--port`, `-p` | `3001` | Local proxy port |
| `--hostname`, `-H` | `127.0.0.1` | Loopback only: `127.0.0.1`, `localhost`, `::1` |
| `--text-generation-model`, `-t` | See above | HTML model |
| `--image-generation-model`, `-i` | See above | Image model, or `none` |
| `--video-generation-model`, `-v` | `none` | Video model, or `none` |
| `--request-timeout` | `120` | HTML/image deadline in seconds |
| `--video-timeout` | `600` | Video deadline in seconds |
| `--list-models` | — | Print models without keys or launching Chrome |
| `--devtools` | `false` | Open Chrome DevTools |

Video generation can take minutes and incur substantial charges. It is opt-in; the HTML prompt requests `controls preload="none"` and no autoplay. These are model instructions, **not a per-play billing approval**. Generated scripts could still start media loads. Disconnecting stops local work and polling, but a provider may continue an already-submitted job and charge for it. There are no automatic billable retries or provider fallbacks.

## Implementation

- `index.js`: CLI, key validation, startup and shutdown.
- `browser.js`: request interception, private proxy authentication and header minimization.
- `lib/models.js`: provider capabilities and dated model suggestions.
- `lib/generation.js`: Gemini Interactions/Veo, OpenAI Responses/Images, Claude Messages, and compatible chat/media APIs. Other than the existing Google SDK, this uses Node's built-in `fetch`.
- `server.js`: input validation, HTML streaming with backpressure, deadlines, disconnect cancellation and media byte ranges.
- `lib/mediaCache.js`: shared in-flight media requests and a 64 MiB session LRU cache. Four media jobs and four page generations can run concurrently; excess work gets HTTP 429 rather than an unbounded queue.
- `prompts/`: editable generation templates. Prompts are read on generation; restart to discard cached media after editing a prompt.

The server prints token counts when providers report them, **not dollar estimates**. Individual media responses are limited to 64 MiB. Media is cached in memory and in Chrome's session profile; nothing is saved as an export.

## Privacy and limits

Visited URLs, query strings (including GET form inputs) and media descriptions go to the selected providers. Cookies, site authorization headers and referrers are not included in prompts. Generation requests disable optional interaction storage where supported; that does not override providers' data retention policies.

The proxy is loopback-only through the CLI and requires a per-launch token. Generated pages get a restrictive Content Security Policy and no camera, microphone or geolocation permissions. **This remains an experimental browser, not a complete network/security sandbox.** Browser-internal pages and other Chromium network paths are not all governed by page request interception. Use only the disposable profile; do not sign into accounts or browse sensitive URLs.

Pages have no shared story/site memory and may change on each navigation. Media uses only its URL description, not the surrounding page. External CSS/JS generation, persistent history, a trusted cost/status toolbar and provider cost ceilings are still future work.

## Checks

```sh
npm test              # Offline parser, provider-contract, cache, HTTP and CLI tests
npm run test:browser  # Real headless Chrome with fake providers; no API charges
npm audit
```

The browser check exercises HTML, images, navigation, forms, CSP and video interception. Its video bytes are a mock, so it does not validate playback of a real generated clip. Live provider availability, generation quality and paid-video playback require separate opt-in checks.

See [docs/UPGRADE-PLAN.md](docs/UPGRADE-PLAN.md) for the investigation, release gates, performance work and product ideas.

## Contributing and license

Issues and pull requests are welcome. Licensed under Apache-2.0; see `LICENCE`.
