# Project Brief: Fauxmium

This document outlines the core requirements, goals, and architectural scope of the Fauxmium project.

## Project Goals
- Create a synthetic AI web browser where everything you see—HTML, CSS, JavaScript, Images, Video, and Audio—is generated on the fly by frontier AI models.
- Provide a responsive proof-of-concept demonstrating dynamic, coherent, and infinite web synthesis with consistent brand identities, navigation continuity, and time-travel aesthetics.
- Deliver an extensible developer platform with multi-provider model catalogs (Gemini, OpenAI, Anthropic, Groq), live pricing sync, prompt prefix caching optimization, and comprehensive cost tracking.

## Core Requirements & Capabilities
1. **Headful Chromium with Request Interception**:
   - Uses Puppeteer to launch headful Chromium, automatically installing the Fauxmium companion Chrome Extension and intercepting all navigations and media requests.
   - Preserves navigational referrer headers, handles POST form submissions, and injects client-side progress indicators and loading skeletons.
2. **Multi-Modal Proxy Architecture**:
   - A local Node.js HTTP server handles intercepted traffic across dedicated endpoints:
     - `GET /html`: Streams generative HTML5 documents using Vercel AI SDK and frontier LLMs.
     - `GET /image`: Synthesizes AI imagery via Google Gemini or OpenAI DALL-E with automatic semantic role inference, aspect ratio calculation, site palette adoption, and styled SVG fallback.
     - `GET /video`: Generates continuous video via Google Veo 3.1 with poster-frame seeding, camera motion directives, and HTTP 206 Partial Content byte-range streaming.
     - `GET /audio`: Delivers spoken dialogue (OpenAI / Gemini TTS) and zero-dependency procedural 16-bit PCM WAV audio (music, chiptunes, ambient soundscapes, sfx).
3. **Browsing Lenses (Aesthetic Time-Travel)**:
   - Declarative aesthetic filters (`modern`, `retro-90s`, `y2k`, `cyberpunk-2077`, `brutalist`, `vaporwave`, `noir-1940s`, `arcade-8bit`, `custom`) applied across all modalities.
4. **Site & Link-Level Coherence (`lib/siteMemory.js`)**:
   - Domain design DNA extraction (brand title, typography, `:root` CSS variables, navigation links, cached media assets).
   - `a => b` click intent capture (`__fauxmiumCaptureClick` + `data-context`) for continuity on opaque URLs.
   - Sliding-window multi-turn navigation threads and per-domain session state (`domainState`) for forms, authentication, and search persistence.
5. **Prompt Prefix Caching**:
   - 100% static invariant system prompt (`prompts/html-system.txt`, >1,800 tokens) paired with tiered user prompts for 75%–90% cost discounts.
6. **Live Extension & Accounting**:
   - Adaptive light/dark Chrome Extension popup with real-time per-modality spend tracking, live lens switching, and instant tab regeneration.
7. **Documentation & Showcase**:
   - Interactive GitHub Pages website (`https://paulkinlan.github.io/fauxmium/`) with in-browser simulator, lens audition audio player, and CLI builder.
