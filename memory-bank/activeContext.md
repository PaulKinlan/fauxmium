# Active Context

This document tracks the current work focus, recent changes, next steps, active decisions, and project insights.

## Current Focus

- Stabilize multi-provider text support (Google, OpenAI, Anthropic, Groq) and the Google-only image pipeline.
- Maintain and refine the Chrome extension cost dashboard that reads `/cost`.
- Keep documentation (Memory Bank) aligned with the current codebase and plan the next iteration (image context, optional state).

## Recent Changes

- CLI and Provider Support:
  - `index.js` now provides a yargs-based CLI with commands for `gemini/google`, `openai`, `anthropic`, and `groq`.
  - Image configuration supported via a nested `images` subcommand; images currently limited to Google/Gemini.
  - API key resolution via environment variables or CLI flags.
- Server and Endpoints:
  - `server/index.js` exposes `GET /html`, `GET /image`, and `GET /cost`.
  - `loadCosts(model)` fetches per-model pricing from Helicone to enable session cost tracking.
- Streaming Pipeline:
  - `server/processHTML.js` builds prompts from `prompts/html.txt`, streams with `lib/aiAdapter.js`, pipes through `lib/processChunks.js` with `lib/costCalculator.js`, and extracts ```html code via `lib/streamCodeBlocks.js`.
  - `server/processImage.js` builds prompts from `prompts/image.txt`, generates images via `lib/aiAdapter.js` (Google-only), serves binary with fallback 1x1 PNG on errors.
- Browser Controller:
  - `browser.js` launches headful Chrome, installs the MV3 extension at runtime, configures it via CDP `Extensions.setStorageItems`, sets up request interception per page, and shows `pages/warning.html` initially.
  - Interception policy: only navigation and image requests are forwarded; non-GET and other subresources are blocked; `Referer` is stripped for proxy-bound requests.
- Chrome Extension:
  - `extension/manifest.json`, `popup.html`, `popup.js` render session total and per-request costs by fetching `/cost`.
- Memory Bank:
  - Updated `systemPatterns.md` and `techContext.md` to reflect the above architecture, providers, constraints, and CLI usage.

## Active Decisions and Patterns

- Proxy Pattern with strict subresource policy (nav + images only); external CSS/JS are blocked and should be generated inline.
- Vercel AI SDK used for text streaming; `@google/genai` used directly for image generation (Google-only).
- Costs are computed from usage metadata when available; 0-cost fallback if usage is missing or pricing unavailable.
- Stateless navigations by design; no memory between requests (yet).
- Warning screen shown at startup to indicate synthetic content.

## Next Steps

- Image generation context:
  - Parse and pass width/height/alt-style description from image `src` query params through `/image` and into the prompt to improve relevance and aspect ratio.
- Optional state:
  - Introduce an opt-in session memory to carry context across navigations.
- Provider parity for images:
  - Add support for additional image providers or abstract image generation behind a common interface.
- Cost and UX improvements:
  - Add a `/reset-costs` endpoint and a refresh/reset control in the extension popup.
  - Handle providers that do not return usage by estimating tokens (or clearly labeling as “unknown/0”).
- Hardening and DX:
  - Better error handling/timeouts and structured logs.
  - Test coverage for request interception, streaming, and cost accounting.
  - Optional persistent user-data-dir to keep a browsing session (while still signaling synthetic content).

## Project Insights

- Inline CSS/JS in generated HTML is necessary given subresource blocking; prompts should encourage this.
- Fenced code extraction (```html) keeps the streaming robust and prevents non-HTML text from leaking into the response.
- Helicone pricing data can be missing for some models; systems should degrade gracefully.
