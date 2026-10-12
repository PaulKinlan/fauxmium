# Fauxmium — The Infinite Synthetic Web

> **Everything you see inside the Fauxmium browser is generated on the fly. It is not real.**

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-blue.svg)](https://paulkinlan.github.io/fauxmium/)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENCE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)

**Fauxmium** is a synthetic AI browser engine that creates an effectively infinite web as you browse. Rather than requesting real servers, Fauxmium launches a Chromium browser with request interception and routes every navigation, image, video, and audio request to a local multi-modal proxy. Frontier LLMs and generative media models synthesize complete, authentic HTML5/CSS/JS documents, images, video clips, and soundscapes in real time.

Visit the interactive project site and live simulator at **[https://paulkinlan.github.io/fauxmium/](https://paulkinlan.github.io/fauxmium/)**.

---

## Key Capabilities

### 1. Multi-Modal Synthetic Engine
- **Streaming HTML5 Documents (`GET /html`)**: Synthesizes responsive, accessible HTML with semantic tags, inline CSS, modular JavaScript, forms, and client-side clocks. Streams tokens via SSE / chunked transfer encoding directly to the browser.
- **AI Image Generation (`GET /image`)**: Generates photorealistic or stylized imagery via Google Gemini and OpenAI DALL-E. Automatically infers semantic image roles (`logo`, `avatar`, `hero`, `product`, `thumbnail`), calculates human-readable aspect ratios (`16:9`, `1:1`, `9:16`, `4:3`, `21:9`), adopts the domain's brand color palette, and detects named real people to provide stylized artistic vector avatars rather than failing synthesis. Serves styled, lightweight SVG placeholders if image generation is disabled or fails.
- **AI Video Generation (`GET /video`)**: Synthesizes continuous video via Google Veo 3.1 (`veo-3.1-fast-generate-preview`). Supports poster-frame visual continuity (seeding video generation from the video's poster image), camera motion directives (`pan`, `dolly`, `drone`, `orbit`, `static`), and full HTTP `206 Partial Content` byte-range streaming for seamless video seeking.
- **Hybrid Audio Synthesis (`GET /audio`)**: Supports OpenAI TTS (`tts-1`, `gpt-4o-mini-tts`) and Google Gemini TTS (`gemini-3.8-flash-tts`) for spoken dialogue and podcasts. Includes a built-in, zero-dependency Node.js procedural 16-bit PCM WAV synthesizer (`synth-wav`) producing chiptunes, sound effects, ambient pads, and tempo-scaled music at 0ms latency and $0.00 cost.

### 2. Browsing Lenses (Era & Aesthetic Time-Travel)
Browse any modern or imaginary URL through distinct historical, subcultural, and artistic lenses:
- `modern` — Clean contemporary web standards, responsive layouts, subtle depth, neutral typography.
- `retro-90s` — 1990s GeoCities nostalgia, bevel tables, marquee banners, tiled backgrounds, Times New Roman, bright primary links.
- `y2k` — Late 90s/early 2000s glossy bubblegum cyber aesthetic, metallic gradients, futuristic rounded pill buttons, tech badges.
- `cyberpunk-2077` — Dark neon cyber-grid, high-contrast cyan/magenta palette, scanlines, monospace telemetry, terminal readouts.
- `brutalist` — Raw, high-contrast neobrutalism, stark borders, oversized sans-serif typography, asymmetric grid layouts.
- `vaporwave` — 1980s aesthetic, pastel sunset gradients, statues, Japanese typography, retro computer wireframes.
- `noir-1940s` — Monochromatic film noir, dramatic high-contrast lighting, vintage art-deco typography, smoky textures.
- `arcade-8bit` — 1980s coin-op arcade, scanline CRT simulation, pixel typography, flashing coin prompts.
- `custom` — Supply any freeform aesthetic prompt via `--lens custom --custom-lens "..."` or through the extension popup.

Lenses apply consistently across HTML layout, color palettes, typography, image framing, video cinematography, and procedural audio synthesis.

### 3. Site-Level & Link-Level Coherence (`lib/siteMemory.js`)
Fauxmium avoids the disjointed "amnesia" typical of LLM web generation by maintaining deep memory across clicks:
- **Design DNA Extraction**: Extracts established domain brand titles, typography (Google Fonts / `@font-face`), `:root` CSS variables, main navigation links, and cached media asset URLs. Sub-pages on the same domain automatically adopt the exact same CSS variables and navigation bars.
- **`a => b` Click Intent Capture**: When you click a link on page A, `__fauxmiumCaptureClick` inspects the enclosing card, article title, contextual snippet, and `data-context` attribute. When page B renders, it knows exactly which story, product, or video was selected—even for opaque slugs like `/watch?v=xyz` or `/item?id=42`.
- **Domain Session State (`domainState`)**: Automatically captures and tracks URL query parameters and form POST data (search queries, cart items, selected filters, categories). For form logins, masks sensitive passwords (`********`), marks `authenticated="true"`, and preserves the active username/session across all pages on the domain.
- **Multi-Turn Navigation Threads**: Preserves a sliding window of previous user and assistant turns for the active domain, allowing the LLM to inspect its own previous HTML structure for visual and structural consistency.

### 4. Prompt Prefix Caching Architecture
To maximize LLM cache hit rates and reduce inference costs by 75%–90%:
- **100% Invariant System Prompt (`prompts/html-system.txt`)**: A comprehensive, variable-free system prompt (>1,800 tokens) that remains byte-for-byte identical across every request, hitting provider prompt caches automatically.
- **Tiered User Prompt (`prompts/html.txt`)**: Segregates stable session environment variables (bucketed 64px viewports, normalized language, day-level date) from dynamic per-request routing.
- **Prompt Cache Cost Tracking**: Automatically extracts cached input token metrics from Anthropic, OpenAI, and Gemini responses, billing cached tokens at a 75% discount in `costCalculator.js`.

### 5. Declarative Model Catalog & Pluggable Providers (`config/models.json`)
Declarative JSON configuration declaring available models, capabilities, aliases, and pricing:
- **Google Gemini**: `gemini-3.8-flash` (default text), `gemini-3.8-pro`, `gemini-3.8-flash-lite`, `gemini-3.1-flash-image` (default image), `veo-3.1-fast-generate-preview` (default video), `gemini-3.8-flash-tts` (audio).
- **OpenAI**: `gpt-6-sol` (default text), `gpt-6.1-sol`, `gpt-6-luna`, `gpt-6-astra`, `gpt-image-2.5` (image), `gpt-4o-mini-tts` / `tts-1` (audio).
- **Anthropic**: `claude-sonnet-5-5` (default text), `claude-opus-5-5`, `claude-haiku-5-5`.
- **Groq**: `openai/gpt-oss-120b` (default text), `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`.
- **DeepSeek**: `deepseek-v4-flash` (default text), `deepseek-v4`, `deepseek-reasoner`, `deepseek-chat` (OpenAI-compatible protocol with automated `<think>` reasoning tag stripping).
- **Zhipu AI (GLM)**: `glm-5-flash` (default text), `glm-5-plus`, `glm-5-air`.
- **Moonshot AI (Kimi)**: `kimi-k2.5-flash` (default text), `kimi-k2.5`, `kimi-k2-thinking`.
- **OpenRouter**: `deepseek/deepseek-v4-flash`, `z-ai/glm-5`, `moonshotai/kimi-k2.5` multi-model gateway.
- **Ollama (Offline Local)**: `qwen3.8:14b`, `llama3.3:70b`, `deepseek-r1:14b` with zero-key local execution on `http://127.0.0.1:11434/v1`.
- **Synth**: `synth-wav` (built-in procedural WAV generator).
- **User Models Overlay**: Inject custom providers, models, and fallback pricing via `FAUXMIUM_MODELS_PATH`, `./fauxmium.models.json`, or `~/.fauxmium/models.json`.
- **Automatic Pricing & Model Discovery**: Fetches live Gemini models and updates token pricing from LiteLLM with a 24-hour disk cache fallback.

### 6. Dynamic In-Page APIs & Element Remix Wand
- **Dynamic In-Page Fetch (`/api/*`)**: Synthetic pages can make real `fetch('/api/todos')`, `fetch('/api/weather?city=tokyo')`, or `fetch('/api/search')` requests. Fauxmium dynamically synthesizes authentic, contextual JSON responses matching the page's design DNA and active browsing lens.
- **Alt+Click Element Remix Wand**: Hold `Alt` in any synthetic page to highlight elements with a purple wand indicator. Click any element to open a floating prompt modal and remix that individual element in-place with View Transitions!

### 7. Chrome Extension & Single-File Page Export
Fauxmium automatically installs a companion Chrome Extension (`extension/`) providing:
- **Live Browsing Lens Switcher**: Change the active lens in real time with auto-save and tab regeneration.
- **📦 Single-File Page Export**: Click the Export button to download a self-contained `.html` file with all cached images, videos, and audio converted into base64 data URIs for 100% offline viewing without a server!
- **Live Accounting & Token Tracker**: Real-time breakdown of API costs across Text, Image, Video, and Audio modalities with cache badge indicators (`⚡`).
- **Modality Toggles**: Enable or disable image, video, or audio generation on the fly.
- **Adaptive Light/Dark Theme**: Vector toolbar icon and popup UI matching your operating system color scheme.

---

## Quick Start

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/paulkinlan/fauxmium.git
cd fauxmium
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Google Gemini (Default for text, image, and video)
GEMINI_API_KEY=your_gemini_api_key

# OpenAI (Optional: for GPT-6 text, DALL-E, or TTS)
OPENAI_API_KEY=your_openai_api_key

# Anthropic (Optional: for Claude 5.5 Sonnet)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Groq (Optional: for ultra-fast Llama / Qwen / GPT-OSS inference)
GROQ_API_KEY=your_groq_api_key
```

### Launching Fauxmium

Launch Fauxmium with default settings (Gemini 3.8 Flash, Modern lens):

```bash
npm start
```

Or run via npx:

```bash
npx fauxmium
```

Launch with DevTools opened:

```bash
npm start -- --devtools
```

Launch in a specific Browsing Lens:

```bash
npm start -- --lens cyberpunk-2077
npm start -- --lens retro-90s
npm start -- --lens noir-1940s
npm start -- --lens arcade-8bit
```
```

---

## CLI Options & Flags

```
Usage: fauxmium [options] [command]

The infinite generative AI web browser

Options:
  -H, --hostname <host>          Proxy server hostname (default: "127.0.0.1")
  -p, --port <port>              Proxy server port (default: 3001)
  --devtools                     Launch browser with DevTools open (default: false)
  --verbose                      Log detailed prompt and model diagnostics (default: false)
  --lens <lens>                  Initial Browsing Lens (default: "modern")
  --custom-lens <prompt>         Custom aesthetic instructions when --lens is "custom"

Text Provider & Model:
  -m, --model <model>            Text generation model or provider:model (e.g. "gemini-3.8-flash", "deepseek:deepseek-v4-flash", "ollama:qwen3.8:14b")
  --api-key <key>                API key for active text provider
  --base-url <url>               Custom OpenAI-compatible base URL (e.g. "http://127.0.0.1:11434/v1")

Image Options:
  --image-provider <provider>    Image provider: "gemini" | "openai" (default: "gemini")
  -i, --image-model <model>      Image model (e.g. "gemini-3.1-flash-image", "gpt-image-2.5")
  --no-image                     Disable image generation (serves styled SVG fallbacks)

Video Options:
  --video-provider <provider>    Video provider: "gemini" (default: "gemini")
  -v, --video-model <model>      Video model (e.g. "veo-3.1-fast-generate-preview")
  --no-video                     Disable video generation (serves fallback MP4)

Audio Options:
  --audio-provider <provider>    Audio provider: "synth" | "gemini" | "openai" (default: "synth")
  --audio-model <model>          Audio model (e.g. "synth-wav", "gemini-3.8-flash-tts", "tts-1")
  --no-audio                     Disable audio generation (serves silent WAV)

Other Options:
  --no-model-sync                Skip background live model and pricing discovery
  -h, --help                     Display help for command
```

### CLI Command Examples

```bash
# 1. Cyberpunk 2077 net browsing with Gemini 3.8 Pro
npx fauxmium --lens cyberpunk-2077 -m gemini-3.8-pro

# 2. Browse with Anthropic Claude 5.5 Sonnet
npx fauxmium anthropic -m claude-sonnet-5-5

# 3. Fast local browsing with Groq GPT-OSS 120B and procedural audio
npx fauxmium groq -m openai/gpt-oss-120b --audio-provider synth

# 4. Zero-key 100% offline local inference with Ollama
npx fauxmium ollama -m qwen3.8:14b

# 5. DeepSeek V4 Reasoner with thinking tags stripped automatically
npx fauxmium deepseek -m deepseek-reasoner

# 6. Text-only reading mode (images, video, audio disabled for instant speed)
npx fauxmium --no-image --no-video --no-audio

# 7. Y2K Aesthetic with custom OpenAI TTS voice
npx fauxmium --lens y2k --audio-provider openai --audio-model tts-1
```

---

## Architecture & Server Endpoints

Fauxmium starts a lightweight Node.js HTTP proxy server (`server/index.js`) that Puppeteer routes network requests to:

| Endpoint | Method | Purpose |
|---|---|---|
| `/html` | `GET` | Generates streaming HTML document for target URL with decomposed route, link intent, and domain session state |
| `/image` | `GET` | Generates AI image matching description, dimensions, semantic role, and site color palette |
| `/video` | `GET` | Generates AI video clip (Veo 3.1) seeded by companion poster frame with HTTP 206 range streaming |
| `/audio` | `GET` | Generates audio track (TTS speech or procedural WAV) matching description, type, transcript, and tempo |
| `/api` / `/api/*` | `GET`/`POST` | Synthesizes dynamic in-page REST JSON API responses or executes Alt+Click Element Remix wand (`action=remix`) |
| `/export` | `GET` | Bundles and exports current cached page into a self-contained single-file HTML document with inlined base64 media |
| `/config` | `GET` | Returns active runtime configuration, model selections, and available lenses |
| `/config` | `POST` | Dynamically updates runtime configuration, active lens, and media enabled states |
| `/cost` | `GET` | Returns cumulative session cost and per-modality breakdown (Text, Image, Video, Audio) |
| `/cost/reset` | `POST` | Resets all accumulated session costs |
| `/cache/clear` | `POST` | Flushes in-memory image, video, audio, and HTML page caches, as well as site memory |
| `/cache/stats` | `GET` | Returns count of currently cached media and HTML assets |
| `/link-context`| `POST` | Receives clicked link metadata (`__fauxmiumCaptureClick`) from browser context |
| `/models` | `GET` | Returns available declarative models and live discovered models |

---

## Media URL Conventions

When Fauxmium synthesizes HTML documents, the LLM emits synthetic media URLs with rich query parameters that the proxy intercepts:

### 1. Images (`<img>`)
```html
<img src="https://example.com/img/hero.jpg?description=futuristic+autonomous+vehicle+on+rainy+highway&width=1280&height=720&role=hero"
     alt="Autonomous Vehicle"
     width="1280"
     height="720">
```
- `description`: Detailed visual description of the subject.
- `width` & `height`: Target pixel dimensions (used to calculate aspect ratio).
- `role`: Semantic framing: `logo`, `avatar`, `hero`, `thumbnail`, `product`, `icon`.

### 2. Video (`<video>`)
```html
<video poster="https://example.com/img/poster.jpg?description=starship+docked+at+orbital+station&width=1280&height=720&role=hero"
       src="https://example.com/vid/launch.mp4?description=starship+ignites+engines+and+accelerates+into+hyperspace&width=1280&height=720&camera=pan&poster=https://example.com/img/poster.jpg?description=starship+docked+at+orbital+station"
       controls playsinline width="1280" height="720"></video>
```
- `description`: Continuous video action description.
- `camera`: Camera cinematography motion: `pan`, `dolly`, `drone`, `orbit`, `static`.
- `poster`: URL of the starting poster frame image (provides visual continuity).

### 3. Audio (`<audio>`)
```html
<!-- Background Music / Ambience -->
<audio src="https://example.com/audio/theme.wav?description=cyberpunk+ambient+downtempo&type=music&bpm=110&mood=tense" controls loop></audio>

<!-- Spoken Dialogue / Speech -->
<audio src="https://example.com/audio/host.mp3?description=podcast+greeting&type=speech&transcript=Welcome+to+the+synthetic+web!&voice=alloy" controls></audio>
```
- `description`: Soundscape or audio description.
- `type`: `music`, `sfx`, `ambient`, `speech`, `chiptune`.
- `transcript`: Verbatim text to speak for speech synthesis.
- `bpm`: Music tempo (scaled note rate).
- `mood`: Emotional vibe (`chill`, `tense`, `heroic`, `mysterious`).
- `voice`: Preferred TTS voice (`alloy`, `echo`, `nova`).

---

## Running Tests

Fauxmium includes a comprehensive unit test suite covering declarative models, multi-modal cost calculations, byte-range video streaming, procedural WAV synthesis, prompt prefix caching, site memory coherence, and documentation integrity:

```bash
npm test
```

---

## License

Apache-2.0 — see [LICENCE](LICENCE) for details. Created by [Paul Kinlan](https://paul.kinlan.me/). Not affiliated with any employer or product.
