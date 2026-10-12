# Active Context: Fauxmium

This document tracks active development goals, recent architecture updates, decisions, and system verification.

## Current Focus
- Comprehensive documentation update across `README.md` and `memory-bank/`.
- Interactive GitHub Pages website (`docs/`) showcasing the Synthetic Browser Simulator, Browsing Lens Audition audio player, and CLI Command Generator.
- Deployment automation via GitHub Actions (`.github/workflows/pages.yml`).
- Verification via unit test suite (`test/fauxmium.test.js`).

## Recent Architectural Milestones Completed
1. **Multi-Modal Synthesis Engine**:
   - Streaming HTML5 (`GET /html`) with decomposed routes, media capabilities, domain session state, and multi-turn threads.
   - AI Image (`GET /image`) with semantic role inference (`logo`, `avatar`, `hero`, `product`), aspect ratio calculation, site brand palette adoption, in-flight promise deduplication, and styled SVG fallbacks.
   - AI Video (`GET /video`) via Veo 3.1 with poster-frame continuity, camera motion directives, and HTTP 206 byte-range streaming.
   - Hybrid Audio (`GET /audio`) with OpenAI / Gemini TTS and zero-dependency procedural 16-bit PCM WAV synthesizer (`synth-wav`) with BPM scaling and lens-aware sound design.
2. **Browsing Lenses**:
   - 9 aesthetic lenses (`modern`, `retro-90s`, `y2k`, `cyberpunk-2077`, `brutalist`, `vaporwave`, `noir-1940s`, `arcade-8bit`, `custom`) integrated across HTML, image, video, and audio prompts.
3. **Site & Link-Level Coherence (`lib/siteMemory.js`)**:
   - Captures domain design DNA (typography, CSS variables, nav links, cached images).
   - Tracks `a => b` link intent via `__fauxmiumCaptureClick` and `data-context`.
   - Persists domain session state (`domainState`) across navigations for search, cart, and authenticated login sessions.
4. **Prompt Prefix Caching**:
   - Invariant system prompt (`prompts/html-system.txt`, >1,800 tokens, 0 placeholders) and tiered user prompt prefix for 75% prompt cache discounts in `costCalculator.js`.
5. **Chrome Extension Redesign**:
   - Native light/dark mode UI with tabular numerals, vector icons, auto-saving lens configuration, and guaranteed save before tab reload.
6. **2026 Model Catalog**:
   - Google Gemini 3.8 Flash / Pro / Flash-Lite, Veo 3.1, OpenAI GPT-6 Sol / Luna / Astra, Anthropic Claude 5.5 Sonnet, Groq GPT-OSS 120B.

## Active Decisions
- Keep system prompt completely invariant to leverage multi-provider prefix caching.
- Use native Web Audio API in documentation and client-side simulator to mirror backend procedural synthesis without heavyweight audio libraries.
- GitHub Pages is deployed purely from `docs/` using static HTML/CSS/JS without external build steps or frameworks.
