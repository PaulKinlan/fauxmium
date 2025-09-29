# Project Progress

This document tracks what works, what's left to build, the current status, known issues, and the evolution of project decisions. It reflects the current codebase.

## Current Status

- Multi-provider text generation is implemented and stable for Google (Gemini), OpenAI, Anthropic, and Groq via the Vercel AI SDK.
- Image generation is implemented for Google (Gemini) only via `@google/genai`.
- Cost tracking is active using usage metadata and Helicone pricing; surfaced via a Chrome extension popup.
- Request interception policy is enforced (navigation + images only), ensuring deterministic I/O to the proxy and inline assets in generated HTML.

## What Works

- Launching a headful Chrome with Puppeteer; auto-installs and configures an MV3 extension at runtime (CDP `Extensions.setStorageItems`).
- Intercepting requests and forwarding only:
  - Navigations to `GET /html`
  - Images to `GET /image`
- Local proxy server endpoints:
  - `GET /html` — streams AI-generated HTML (extracted from ```html fenced blocks).
  - `GET /image` — returns AI-generated image bytes (or a 1x1 PNG placeholder on error).
  - `GET /cost` — returns in-memory session usage/cost summary.
- Prompting pipeline:
  - `prompts/html.txt` and `prompts/image.txt` are loaded and interpolated dynamically at runtime (no restart required to tweak prompts).
  - Streamed text -> `processChunks` -> `costCalculator` + `streamCodeBlocks("html")` -> incremental HTTP response.
- Providers and models:
  - CLI via `yargs` with commands for `gemini/google`, `openai`, `anthropic`, `groq`; image configuration via nested `images` subcommand (Google-only).
  - API key resolution from environment or CLI flags.
- Cost accounting:
  - Per-model pricing fetched from Helicone, with 0-cost fallback if missing.
  - Per-request logs and session totals available at `/cost`.
  - Chrome extension popup displays total and a table of request costs.

## What's Left to Build

- Image generation context:
  - Parse width/height/description from image `src` query parameters (e.g., `?description=...&height=...&width=...`) and pass into the `/image` prompt to improve relevance and aspect ratio.
- Optional session memory:
  - Provide an opt-in state layer to carry context across navigations.
- Image provider parity:
  - Add non-Google image providers behind a common abstraction in `aiAdapter.js`.
- Cost UX and control:
  - Add a `/reset-costs` endpoint and refresh/reset UI in the extension popup.
  - Consider token estimation when providers omit usage, or explicitly mark unknown usage.
- Hardening and Developer Experience:
  - Timeouts, retries, and structured error logging for proxy and provider calls.
  - Tests for interception policy, streaming pipeline, and cost accounting.
  - Optional persistent user-data-dir profile for Chrome sessions (while retaining synthetic-content warning).
- Performance:
  - Consider simple caching for recent prompts/URLs to reduce latency and provider costs for repeated navigations within a session.

## Known Issues

- The extension popup is now responsive and handles long URLs correctly.
- Stateless navigations:
  - No persistent state between requests; content coherence across pages is limited.
- Subresource blocking:
  - External CSS/JS is blocked; HTML must contain inline CSS/JS (prompts encourage this).
- Image limitations:
  - Only Google/Gemini images are supported; selecting a different image provider will result in errors and a placeholder image being served.
- Usage reporting:
  - Some providers may not return token usage; affected requests will log 0 cost.
- Pricing data:
  - Helicone may not have pricing for certain models; costs default to 0 for those.
- Headers/Referer:
  - Referer is stripped (set to empty) as a temporary workaround; behavior may change with upstream Chromium updates.
- Error handling:
  - While the image path has a robust placeholder fallback, HTML generation errors return an error page. Broader error handling and clearer UX are planned.

## Decisions Evolution

- Adopted Vercel AI SDK for text to unify provider integrations and streaming behavior.
- Kept image generation with `@google/genai` for now due to capability and stability.
- Enforced a strict interception policy to simplify the pipeline and encourage fully self-contained HTML.
- Cost visibility is first-class via `/cost` and the Chrome extension; future work will improve controls and accuracy for providers without usage data.
