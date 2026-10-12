# Technical Context: Fauxmium

This document outlines the technologies, development environment, runtime dependencies, model configurations, and technical constraints of the Fauxmium project.

## Technology Stack
- **Runtime Environment**: Node.js >= 20.0.0 (ECMAScript Modules, `"type": "module"`).
- **Browser Automation**: Puppeteer launching Chromium headful with pipe mode, runtime extension installation, and request interception.
- **AI Integration**: Vercel AI SDK (`ai`), `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/groq`.
- **Command-Line Interface**: `commander` / `yargs` CLI with rich flag parsing, alias resolution, and `.env` support (`dotenv`).
- **Procedural Audio**: Pure Node.js RIFF WAVE PCM 16-bit 22.05kHz mono synthesizer (`lib/audioSynth.js`).
- **Chrome Extension**: Manifest V3 extension with adaptive light/dark UI, vector icons, real-time cost tracking, and dynamic configuration synchronization.
- **Testing**: Native Node.js test runner (`node:test`, `node:assert/strict`).

## Supported Providers & 2026 Model Catalog (`config/models.json`)

| Provider | Modality | Default Model | Available Choices & Aliases |
|---|---|---|---|
| **Google Gemini** | Text | `gemini-3.8-flash` | `gemini-3.8-pro`, `gemini-3.8-flash-lite`, `gemini-2.5-pro` |
| **Google Gemini** | Image | `gemini-3.1-flash-image` | `imagen-3.0-generate-002` |
| **Google Gemini** | Video | `veo-3.1-fast-generate-preview` | `veo-2.0-generate-001` |
| **Google Gemini** | Audio | `gemini-3.8-flash-tts` | Spoken audio modality |
| **OpenAI** | Text | `gpt-6-sol` | `gpt-6.1-sol`, `gpt-6-luna`, `gpt-6-astra`, `gpt-4o` |
| **OpenAI** | Image | `dall-e-3` | `gpt-image-2.5` |
| **OpenAI** | Audio | `gpt-4o-mini-tts` | `tts-1`, `tts-1-hd` |
| **Anthropic** | Text | `claude-sonnet-5-5` | `claude-opus-5-5`, `claude-haiku-5-5` |
| **Groq** | Text | `openai/gpt-oss-120b` | `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile` |
| **Synth** | Audio | `synth-wav` | Zero-dependency procedural WAV generator |

## Whitelisted External Domains (`config/allowedDomains.js`)
To enable rich client-side styling without compromising synthetic isolation, Fauxmium whitelists trusted CDNs directly:
- **Fonts**: `fonts.googleapis.com`, `fonts.gstatic.com`, `fonts.bunny.net`.
- **CSS**: `cdn.tailwindcss.com`.
- **JavaScript Modules**: `esm.sh` (React, Preact, Lucide, Three.js, Tone.js, Chart.js, D3.js).
- **Public CDNs**: `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`.

## File Tree Structure
```
fauxmium/
├── browser.js                 # Puppeteer launcher, request interception, skeleton injection
├── cli/                       # CLI commands, options, and model flags
├── config/
│   ├── allowedDomains.js      # Whitelisted external CDNs (fonts, scripts, tailwind)
│   ├── models.json            # Declarative model catalog, aliases, and pricing
│   └── providers.js           # Browsing lenses, model aliases, provider features
├── docs/                      # Interactive GitHub Pages website
│   ├── index.html             # Synthetic browser simulator, CLI builder, docs
│   ├── styles.css             # Light/dark theme styling
│   ├── app.js                 # Simulator engine, Web Audio synth preview, interactive UI
│   └── icon.svg               # Vector brand prism
├── extension/                 # Chrome MV3 Extension
│   ├── manifest.json          # Manifest V3 declarations & icons
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Adaptive light/dark styling
│   ├── popup.js               # Live lens changer, cost tracker, tab reload
│   └── icons/                 # Crisp vector and optically adjusted PNG icons
├── lib/
│   ├── aiAdapter.js           # Multi-modal Vercel AI SDK wrapper
│   ├── audioSynth.js          # Procedural 16-bit PCM WAV synthesizer
│   ├── costCalculator.js      # Cumulative spend tracker with 75% prompt cache discount
│   ├── fallbackMedia.js       # Styled SVG and minimal MP4 fallbacks
│   ├── imageCache.js          # In-memory image, video, audio, and HTML cache
│   ├── modelSync.js           # Live Gemini discovery and LiteLLM pricing sync
│   ├── prompts.js             # Prompt loader, template caching, structured split
│   ├── rangeResponse.js       # HTTP 206 Partial Content byte-range streamer
│   ├── sessionState.js        # Global runtime session state singleton
│   └── siteMemory.js          # Domain design DNA, click intent, and domainState
├── prompts/
│   ├── audio.txt              # Audio prompt template (BPM, mood, transcript, lens)
│   ├── html-system.txt        # 100% static invariant system prompt (>1800 tokens)
│   ├── html.txt               # Tiered user prompt (environment, domain, dynamic intent)
│   ├── image.txt              # Image prompt template (role, aspect ratio, site colors)
│   └── video.txt              # Video prompt template (aspect ratio, camera, poster)
├── server/
│   ├── index.js               # Proxy HTTP server & route dispatcher
│   ├── processAudio.js        # /audio handler
│   ├── processHTML.js         # /html streaming handler
│   ├── processImage.js        # /image handler with promise deduplication
│   └── processVideo.js        # /video handler with poster await & range streaming
└── test/
    └── fauxmium.test.js       # Comprehensive unit test suite (19+ tests)
```
