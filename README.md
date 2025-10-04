# Fauxmium — The Infinite Generated Web

Everything you see inside the Fauxmium browser is generated on the fly. It is not real.

This project is a proof‑of‑concept showing how generative AI can create an effectively infinite “web” as you browse. Fauxmium launches Chrome, intercepts navigations and image requests, and routes them to a local proxy that asks AI models to generate HTML and images for the requested URL.

Not affiliated with any employer or product.

## Quick Start

Run with default settings (Google/Gemini for text and images):

```bash
npx fauxmium
```

Recommended: open DevTools

```bash
npx fauxmium --devtools
```

## Requirements

- Node.js
- API keys for the providers you intend to use (see Environment Variables below)

## Environment Variables

Place in a `.env` file at project root or export via your shell:

- GEMINI_API_KEY or GOOGLE_API_KEY — for Google text and images
- OPENAI_API_KEY — for OpenAI text
- ANTHROPIC_API_KEY — for Anthropic text
- GROQ_API_KEY — for Groq text

The CLI automatically resolves keys from the environment. You can override with flags (`--api-key`, `--image-api-key`, `--video-api-key`).

Example `.env`:

```
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GROQ_API_KEY=your_groq_key
```

## CLI Usage

Default command (no subcommand) uses Google/Gemini text and Google/Gemini images.

```
npx fauxmium [options]
```

Provider commands for text:

```
npx fauxmium gemini   [options]
npx fauxmium google   [options]   # alias of gemini
npx fauxmium openai   [options]
npx fauxmium anthropic [options]
npx fauxmium groq     [options]
```

Common options:

- --hostname, -H Default: 127.0.0.1
- --port, -p Default: 3001
- --devtools Open DevTools on launch (default: false)
- --model, -m Text model (provider-specific defaults/choices)
- --api-key Explicit API key for text provider (overrides env)
- --image-provider Image provider (currently gemini/google only)
- --image-model, -i Image model (e.g., gemini-2.5-flash-image-preview)
- --image-api-key Explicit API key for image provider (overrides env)
- --video-provider Video provider (currently gemini/google only)
- --video-model, -v Video model (e.g., veo-3.0-fast-generate-preview)
- --video-api-key Explicit API key for video provider (overrides env)

Image configuration:

- Images are currently supported only via Google/Gemini.
- You can configure image settings via:
  - the same provider command's nested `images` subcommand, or
  - the top-level `images` command with provider subcommands, or
  - the options on the main command.

Video configuration:

- Videos are currently supported only via Google/Gemini.
- You can configure video settings via:
  - the same provider command's nested `videos` subcommand, or
  - the top-level `video` command with provider subcommands, or
  - the options on the main command.

Examples:

```bash
# Default: Gemini text + images + videos
npx fauxmium

# OpenAI for text, Gemini for images and videos
npx fauxmium openai --api-key $OPENAI_API_KEY --image-api-key $GEMINI_API_KEY --video-api-key $GEMINI_API_KEY

# Change port/host and open DevTools
npx fauxmium -p 8080 -H 127.0.0.1 --devtools

# Choose text, image, and video models explicitly (Gemini)
npx fauxmium gemini -m gemini-2.5-flash -i gemini-2.5-flash-image-preview -v veo-3.0-fast-generate-preview

# Use top-level image command for image-specific configuration
npx fauxmium images gemini --image-model gemini-2.5-flash-image-preview

# Use top-level video command for video-specific configuration
npx fauxmium video gemini --video-model veo-3.0-generate-001

# Use nested subcommands for configuration
npx fauxmium anthropic images --image-provider gemini --image-model gemini-2.5-flash-image-preview
npx fauxmium anthropic videos --video-provider gemini --video-model veo-3.0-fast-generate-preview
```

For full help and the list of default models per provider:

```bash
npx fauxmium --help
```

## How It Works

High-level flow:

1. Fauxmium launches headful Chrome via Puppeteer.
2. It installs a bundled MV3 extension at runtime and configures it with the proxy host/port.
3. All page navigations and image requests are intercepted.
4. Intercepted requests are redirected to a local proxy server that asks AI models to generate HTML or images based on the requested URL.
5. The browser renders the returned content.

Components:

- Browser Controller (`browser.js`)
  - Headful Chrome launch, runtime extension install, configuration via CDP Extensions.setStorageItems.
  - Intercepts requests per page.
  - Shows a warning page on startup.
- Proxy Server (`server/index.js`)
  - Endpoints:
    - GET /html — Streams AI‑generated HTML (extracted from ```html fences).
    - GET /image — Returns AI‑generated image bytes (PNG/JPEG/etc.) or a 1×1 transparent PNG on error.
    - GET /cost — In‑memory session usage/cost summary (used by the extension).
  - Loads model pricing from Helicone for cost tracking (`loadCosts`).
- Text/Image Generation (`/lib`)
  - `lib/aiAdapter.js` — Text streaming via Vercel AI SDK across providers (Google/OpenAI/Anthropic/Groq). Images via `@google/genai` (Google only).
  - `lib/costCalculator.js` — Tracks token usage and cost per request/session.
  - `lib/processChunks.js` — Applies processors and manages stream flush with an END sentinel.
  - `lib/streamCodeBlocks.js` — Extracts ```html fenced content from the text stream.
  - `lib/prompts.js` — Loads and interpolates `prompts/html.txt` and `prompts/image.txt`.
- Chrome Extension (`extension/`)
  - Popup fetches `/cost` and displays total and per‑request costs.

Prompts:

- `prompts/html.txt`
- `prompts/image.txt`

These are read from disk on each request, so you can tweak prompts without restarting.

## Constraints and Behavior

- Subresources:
  - Only navigation (page) and image requests are forwarded to the proxy.
  - Other subresources (e.g., external CSS/JS) are blocked.
  - Generate inline CSS and JS within the HTML.
- State:
  - Navigations are stateless; there is no cross‑page memory at present.
- Images and Videos:
  - Only Google/Gemini image and video generation is supported at this time.
- Costs and usage:
  - Pricing is fetched from Helicone per model; unknown models default to 0.
  - Some providers may not report usage; such requests are counted as 0 cost.
  - Image and video generation costs are not currently tracked.
- Headers:
  - Referer is stripped (set to empty) for proxy‑bound requests as a temporary workaround.

## Roadmap (abridged)

- Improve image prompts with width/height/description parsed from image URLs.
- Optional session memory to carry context across navigations.
- Add additional image providers behind a common interface.
- Add `/reset-costs` endpoint and refresh/reset in the extension popup.
- Better error handling, timeouts, structured logs, and tests.

## License

Apache‑2.0 — see `LICENCE`.

## Contributing

Issues and PRs are welcome. Please describe changes clearly and include repro steps where relevant.
