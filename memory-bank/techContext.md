# Technical Context

This document outlines the technologies used, development setup, technical constraints, dependencies, and configuration for the Fauxmium project. It reflects the current codebase.

## Technologies

- Node.js — runtime environment
- Puppeteer — controls a visible Chrome instance, installs/sets up the extension, and intercepts network requests
- Vercel AI SDK (`ai`) — unified streaming interface for multiple text providers
- AI provider SDKs:
  - `@ai-sdk/google` (text via Vercel AI SDK)
  - `@ai-sdk/openai` (text via Vercel AI SDK)
  - `@ai-sdk/anthropic` (text via Vercel AI SDK)
  - `@ai-sdk/groq` (text via Vercel AI SDK)
  - `@google/genai` (images for Google/Gemini only)
- `yargs` — command-line interface and subcommands
- `dotenv` — environment variable configuration

## Providers and Models

- Text providers: Google (Gemini), OpenAI, Anthropic, Groq (via Vercel AI SDK)
- Image provider: Google (Gemini) only at present
- Defaults and examples:
  - Default text provider: Google/Gemini with model `gemini-2.5-flash-lite`
  - Default image provider: Google/Gemini with model `gemini-2.5-flash-image-preview`
- Notes:
  - Selecting a non-Google image provider is not supported and will cause the image pipeline to error; the server returns a transparent placeholder image.

## Environment Variables

Set in a `.env` file at the project root or via your shell environment:

- GEMINI_API_KEY or GOOGLE_API_KEY — for Google text and images
- OPENAI_API_KEY — for OpenAI text
- ANTHROPIC_API_KEY — for Anthropic text
- GROQ_API_KEY — for Groq text

index.js resolves keys automatically per selected provider. You can also pass explicit keys via CLI flags.

## Development Setup

1. Install dependencies:
   - npm install
2. Configure API keys:
   - Create `.env` and add the relevant keys (see Environment Variables).
3. Run:
   - npx fauxmium
   - Optional flags:
     - --hostname|-H (default 127.0.0.1)
     - --port|-p (default 3001)
     - --devtools (open DevTools on launch)
     - --model|-m (text model)
     - --image-provider (currently must be gemini/google)
     - --image-model|-i (image model)
     - --api-key (text provider override)
     - --image-api-key (image provider override)

## CLI Usage Overview

- Default command (no subcommand):
  - Text: Google/Gemini (`gemini-2.5-flash-lite`) and Images: Google/Gemini (`gemini-2.5-flash-image-preview`)
- Provider commands for text:
  - fauxmium gemini
  - fauxmium openai
  - fauxmium anthropic
  - fauxmium groq
- Image configuration:
  - Per provider, there is a nested `images` subcommand that adjusts image settings; image provider must remain Google/Gemini for now.
  - Example: fauxmium gemini images --image-model gemini-2.5-flash-image-preview

## Server Endpoints

- GET /html — streams AI-generated HTML (inside ```html fenced blocks), extracted and sent to the browser
- GET /image — returns AI-generated image binary (PNG/JPEG etc.) or a 1x1 transparent PNG on failure
- GET /cost — returns in-memory session usage/cost summary

## Streaming and Processing Pipeline

- server/processHTML.js:
  - Builds prompts from prompts/html.txt and request metadata
  - Streams text via lib/aiAdapter.js (Vercel AI SDK)
  - Pipes through lib/processChunks.js with:
    - lib/costCalculator.js — accumulates per-request/session cost from usage metadata
    - lib/streamCodeBlocks.js — incrementally extracts ```html code fences
- server/processImage.js:
  - Builds prompts from prompts/image.txt
  - Uses lib/aiAdapter.js generateImage for Google/Gemini only
  - Sends binary image response (fallback to transparent PNG on error)

## Chrome Extension

- MV3 extension installed at runtime by Puppeteer
- Configured via CDP Extensions.setStorageItems with `hostname` and `port`
- popup.js reads `chrome.storage.local` and fetches `/cost` to render a session cost table and total

## Technical Constraints

- Subresource policy:
  - Only navigation requests and image requests are forwarded to the proxy
  - All other subresources (e.g., external CSS/JS) are blocked
- CSS/JS handling:
  - External CSS/JS files are not fetched; generate inline CSS and JS within the streamed HTML
- Stateless navigations:
  - No persistent state between page loads; each navigation is independent
- Images:
  - Only Google/Gemini image generation is supported; others fall back to a placeholder image
- Pricing and usage:
  - Cost tracking is based on token usage reported by the Vercel AI SDK; some providers may not return usage, in which case costs default to 0 for that request
  - Pricing is fetched from Helicone per model; unknown models default to 0 cost
  - Image generation costs are not currently tracked
- Browser/runtime:
  - Headful Chrome is launched (not headless) to support extension install and devtools
  - Referer is stripped (set to empty) when forwarding requests to the proxy as a temporary workaround

## Dependencies (from package.json)

- ai
- @ai-sdk/google
- @ai-sdk/openai
- @ai-sdk/anthropic
- @ai-sdk/groq
- @google/genai
- puppeteer
- yargs
- dotenv
