# Project Progress: Fauxmium

This document tracks completed milestones, what works, open items, and test status for the Fauxmium project.

## Current Status: Production Proof-of-Concept & Fully Verified
- **Multi-Modal Synthesis**: Streaming HTML, DALL-E & Gemini Images with SVG fallback, Veo 3.1 Video with HTTP 206 byte-range streaming, and Hybrid Audio (TTS + procedural WAV synthesizer).
- **Aesthetic Time-Travel**: 9 Browsing Lenses across HTML, images, video, and audio.
- **Site-Level Coherence**: Domain design DNA extraction, `a => b` link intent capturing, domain session state (search, cart, login), and multi-turn navigation threads.
- **Cost Accounting & Prefix Caching**: Invariant system prompt (>1,800 tokens), 75% prompt cache discounts, live token spending by modality, and adaptive Chrome extension.
- **Test Suite**: 19 automated unit tests passing at 100% success (`node --test test/fauxmium.test.js`).

## What Works
- [x] Multi-modal local proxy server (`/html`, `/image`, `/video`, `/audio`, `/config`, `/cost`, `/cache/clear`, `/models`).
- [x] Puppeteer-driven headful Chromium with dynamic request interception, progress bar, and shimmering loading skeletons.
- [x] Dynamic color scheme detection (`prefers-color-scheme`) forwarded to proxy.
- [x] Complete Browsing Lenses system with live extension popup switcher and instant tab reload.
- [x] Link intent capture via `__fauxmiumCaptureClick` and `data-context` preserving context on opaque URLs.
- [x] Domain design DNA extraction (brand names, typography, `:root` CSS variables, navigation links, and cached media).
- [x] Persistent domain session state (`domainStates`) handling URL query parameters, form POST data, password masking (`********`), and login status.
- [x] Zero-dependency procedural 16-bit PCM WAV synthesizer (`lib/audioSynth.js`) supporting tempo scaling (`bpm`), lens-aware waveforms, and transcript-scaled speech durations.
- [x] HTTP 206 Partial Content byte-range streaming for generated MP4 video clips (`lib/rangeResponse.js`).
- [x] SVG and MP4 fallbacks with in-flight promise deduplication (`lib/imageCache.js`, `lib/fallbackMedia.js`).
- [x] Prompt prefix caching with 100% invariant system prompt and tiered user prompt.
- [x] 2026 Model catalog (`config/models.json`) with declarative pricing and live Gemini / LiteLLM background sync.
- [x] Completely redesigned Chrome extension with crisp vector icons, adaptive light/dark theme, and auto-save on change.
- [x] Modernized `README.md` and updated `memory-bank/`.
- [x] Interactive GitHub Pages documentation site (`docs/`) and GitHub Actions deployment workflow (`.github/workflows/pages.yml`).

## Test Coverage
- `test/fauxmium.test.js`:
  1. Declarative models, aliases, and lens configurations
  2. Multi-modal cost calculations and positive output tokens
  3. Video model factory uses google.video()
  4. Fallback media and Range response (200 & 206)
  5. Procedural WAV synthesizer produces valid playable audio
  6. Server endpoints (`/config`, `/cost`, `/cache/clear`, `/audio`, `/video`)
  7. registerPendingImage handles rejected promise without unhandledRejection
  8. syncGeminiModels discovers live models or reads disk cache
  9. Prompt prefix caching: static invariant system prompt and tiered user prompt prefix
  10. Prompt caching: costCalculator applies 75% discount for cached input tokens
  11. Chrome extension icons: exact PNG dimensions and manifest declarations
  12. Site memory & link intent: captures design DNA, reusable media, and a => b click intent
  13. Multi-turn navigation threads: preserves immutable chat turns and slides window
  14. POST /config changing activeLens updates sessionState and clears prior site memory
  15. Media prompts interpolate dimensions, active browsing lens, and audio transcript
  16. HTML prompt enrichment: decomposed route, media capabilities, and domain session state
  17. Image prompt enrichment: role, aspectRatio, siteColors, and colorScheme
  18. Video prompt enrichment: posterDescription, camera, and aspectRatio
  19. Audio prompt & procedural synthesizer: bpm, mood, lens, and transcript
