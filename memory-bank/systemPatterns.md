# System Patterns

This document describes the system architecture, key technical decisions, design patterns, and component relationships for the Fauxmium project. It reflects the current codebase.

## Architecture Overview

Fauxmium is composed of these main components:

1. Browser Controller (`browser.js`)

   - Launches a visible Chrome via Puppeteer.
   - Installs the bundled Chrome Extension at runtime and configures it via Chrome DevTools Protocol (CDP) `Extensions.setStorageItems` with `hostname` and `port`.
   - Intercepts requests on every open page.
   - Shows a warning page on startup for each page.

2. Proxy Server (`server/index.js`)

   - Minimal HTTP server exposing endpoints:
     - `GET /html` — streams AI-generated HTML (fenced ```html blocks) back to the browser.
     - `GET /image` — returns an AI-generated image (binary) or a 1x1 PNG placeholder on failure.
     - `GET /cost` — returns in-memory session cost data.
   - Initializes usage-based pricing by loading model rates from Helicone (`loadCosts(model)`).

3. Main Entry Point (`index.js`)

   - CLI entry (`bin`) built with `yargs`.
   - Parses provider/model/API key options for text and image generation.
   - Starts the proxy server and then launches the browser controller.
   - Supports multiple text providers and a Google-only image provider (configurable models).

4. Chrome Extension (`extension/`)

   - MV3 action popup that reads `hostname` and `port` from `chrome.storage.local`.
   - Fetches `/cost` and renders a table of request-level costs plus the session total.

5. Libraries (`/lib`)

   - `aiAdapter.js` — Provider-agnostic text streaming via Vercel AI SDK; image generation via `@google/genai` (Google only).
   - `costCalculator.js` — Loads per-model costs from Helicone and accumulates per-request/session costs using usage metadata.
   - `prompts.js` — Loads and interpolates prompt templates from `prompts/*.txt`.
   - `processChunks.js` — Applies processors to streamed chunks and flushes an `END` sentinel.
   - `streamCodeBlocks.js` — Extracts a specific fenced code block (e.g., ```html) from streamed text safely and incrementally.

6. Prompts and Pages
   - `prompts/html.txt`, `prompts/image.txt` — Prompt templates for text/image generation.
   - `pages/warning.html` — Warning shown at startup to signal that content is synthetic.

## Request/Response Flow

1. User enters any URL in the Fauxmium browser window.
2. `browser.js` intercepts requests:
   - Non-GET requests are blocked.
   - Only navigation requests and `image` resource types are forwarded to the proxy; all other subresources are answered with empty responses.
   - Requests to the local proxy itself (`http://{hostname}:{port}/...`) bypass interception and continue normally.
   - Requests are reissued to the proxy with stripped `Referer` header (set to empty pending upstream Chromium changes).
3. Proxy handling:
   - `/html`:
     - Builds a prompt via `generatePrompt("html", { requestUrl, requestType, requestHeaders })`.
     - Streams text via `streamText(textConfig, prompt)`.
     - Pipes through `processChunks([costCalculator(model, url)], streamCodeBlocks("html"), result)`.
     - Writes extracted HTML code block(s) to the client incrementally.
   - `/image`:
     - Builds an image prompt via `generatePrompt("image", { description })`.
     - Calls `generateImage(imageConfig, prompt)` (Google-only for now).
     - Returns binary image bytes with correct `Content-Type` and length.
     - On failure, serves a transparent 1x1 PNG placeholder.
   - `/cost`:
     - Returns `sessionCosts` containing all request logs and a running total.

## Providers and Models

- Text generation providers (via Vercel AI SDK): Google (Gemini), OpenAI, Anthropic, Groq.
- Image generation provider: Google (Gemini) only for now. Non-Google image provider selections will error and fall back to a placeholder image in the server handler.

## CLI Commands (high level)

- Default (no command): Uses Google/Gemini text with `gemini-2.5-flash-lite` by default and Google/Gemini images.
- Provider commands: `gemini`/`google`, `openai`, `anthropic`, `groq` with per-provider model defaults and choices.
- Nested `images` subcommand under each provider to adjust image settings contextually, with images currently limited to Google.
- Common options:
  - `--hostname|-H`, `--port|-p`, `--devtools`
  - `--model|-m`, `--image-model|-i`, `--image-provider`
  - `--api-key` (text), `--image-api-key` (images)

## Cost Tracking

- On server start, `loadCosts(textModel)` fetches pricing from Helicone (`/api/llm-costs?model=...`).
- During streaming, `costCalculator` reads `usageMetadata` (prompt/total token counts) from the Vercel AI SDK result and computes costs:
  - `input`: per-prompt-token rate
  - `output`: per-completion-token rate
- Accumulates:
  - Per-request logs: `{ url, model, promptTokenCount, outputTokenCount, totalTokenCount, cost }`
  - Session total: `sessionCosts.total`
- `/cost` exposes this data for the extension.

## Key Technical Decisions

- Puppeteer for request interception and extension install/configuration.
- Node.js HTTP server with minimal routing for speed and simplicity.
- Vercel AI SDK (`ai`) for uniform streaming across multiple text providers.
- Direct `@google/genai` usage for image generation (until image parity exists across providers).
- Dynamic prompt templates on disk for hot updates without restart.
- Externalized cost model lookup (Helicone), with 0-cost fallback on errors.

## Design Patterns

- Proxy Pattern: Local server replaces “the web” with AI-generated responses.
- Pipeline/Stream Processing: Incremental text -> processors (`costCalculator`) -> code block extractor -> HTTP stream.
- Configuration Injection: CLI -> `index.js` -> server/browser.
- In-memory Event Log: Session-level accounting via `sessionCosts`.
