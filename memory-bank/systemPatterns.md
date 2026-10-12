# System Patterns: Fauxmium Architecture & Design Patterns

This document details the system architecture, design patterns, data flows, and technical decisions implemented across Fauxmium.

## Architecture Overview

```
                      +---------------------------------------+
                      |          Chromium Browser             |
                      |   (Puppeteer + Fauxmium Extension)    |
                      +-------------------+-------------------+
                                          |
                        Interception & Dynamic Navigation
                                          v
                      +---------------------------------------+
                      |         Proxy Server (HTTP)           |
                      |          server/index.js              |
                      +---+-----------+-----------+-------+---+
                          |           |           |       |
            +-------------+     +-----+-----+     |   +---+-----------+
            v                   v           v     v   v               v
      GET /html             GET /image  GET /video  GET /audio   GET & POST /config, /cost
   (processHTML.js)       (processImage) (processVideo) (processAudio) (sessionState & costCalculator)
            |                   |           |         |
            +------------+------+-----+-----+---------+
                         |            |
                         v            v
               +---------------+  +-------------------------+
               | Vercel AI SDK |  | Procedural Audio Synth  |
               | (aiAdapter.js)|  |     (audioSynth.js)     |
               +---------------+  +-------------------------+
                         |
      +------------------+------------------+
      |                  |                  |
Google Gemini         OpenAI            Anthropic / Groq
 (3.8 Flash,       (GPT-6 Sol,         (Claude 5.5 Sonnet,
  Veo 3.1)           DALL-E)              GPT-OSS 120B)
```

## Core Modules & Responsibilities

1. **Browser Controller (`browser.js`)**:
   - Launches headful Chromium via Puppeteer.
   - Installs `extension/` via CDP `Extensions.setStorageItems` with proxy host & port.
   - Exposes `__fauxmiumCaptureClick` and `__fauxmiumUpdateColorScheme` to browser runtime.
   - Injects progress bar, shimmer skeleton styling, and link intent interceptor on `DOMContentLoaded`.
   - Intercepts requests, forwarding navigation to `/html`, images to `/image`, videos to `/video`, and audio to `/audio`. Handles POST navigation data.

2. **Proxy Server (`server/index.js`)**:
   - Router dispatching requests to modular processors:
     - `server/processHTML.js`: Decomposes routes, inspects media capabilities, fetches site memory & domain state, and streams token-by-token HTML.
     - `server/processImage.js`: Handles in-flight promise deduplication (`registerPendingImage`), aspect ratio calculation, role inference, and cached image reuse.
     - `server/processVideo.js`: Waits for companion poster frame generation, calls Veo 3.1, and streams video with HTTP 206 byte-ranges.
     - `server/processAudio.js`: Parses BPM, mood, and transcripts; routes to OpenAI TTS, Gemini TTS, or zero-latency procedural synth.

3. **Site Memory & Coherence (`lib/siteMemory.js`)**:
   - `extractAndSaveSiteProfile(pageUrl, htmlContent)`: Extracts brand names, typography, `:root` CSS variables, nav links, and cached `<img>` tags.
   - `recordLinkContext(ctx)` & `consumeLinkContext(targetUrl)`: Pairs clicked cards, link text, snippet, and `data-context` with the next destination URL.
   - `updateAndGetDomainState(pageUrl, postData)`: Bounded domain state map tracking search queries, categories, cart items, masked passwords (`********`), and authenticated flags.
   - `appendNavigationTurn(pageUrl, userPrompt, assistantHtml)` & `getNavigationThread(pageUrl)`: Sliding window of immutable conversation turns.
   - `clearSiteMemory()`: Flushes all domain memory upon cache flush or active lens switch.

4. **Prompt Prefix Caching Architecture (`lib/prompts.js`)**:
   - Invariant System Prompt (`prompts/html-system.txt`): Variable-free, >1,800 tokens, 100% static across requests to guarantee 75%–90% prompt cache discounts across Gemini, OpenAI, and Anthropic.
   - Tiered User Prompt (`prompts/html.txt`):
     - `[SESSION ENVIRONMENT - STABLE]`: 64px bucketed viewport, normalized language, day-level date.
     - `[SITE COHERENCE PROFILE]`: Domain state and design tokens.
     - `[NAVIGATION & LINK INTENT - DYNAMIC]`: Decomposed URL route, media capabilities, referrer, POST data, and link context.

5. **Multi-Modal Cost Calculator (`lib/costCalculator.js`)**:
   - Tracks text input/output/cached tokens, image generations, video durations, and audio characters.
   - Applies a 75% discount to cached input tokens (`cachedInputTokens`).

6. **Procedural WAV Synthesizer (`lib/audioSynth.js`)**:
   - Pure Node.js 16-bit mono 22.05kHz PCM WAV generator.
   - Lens-aware and tempo-scaled sound design: square-wave chiptune arpeggios, detuned sawtooth synthwave, jazz seventh chords, formant-modulated speech with word-scaled durations.

7. **Runtime Session State (`lib/sessionState.js`)**:
   - Singleton tracking active text, image, video, and audio configs, active lens, custom lens prompt, and navigation breadcrumbs.
   - Automatically flushes site memory when `activeLens` or `customLensPrompt` changes.
