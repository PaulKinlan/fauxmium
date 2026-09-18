# Technical context

- Node.js 22.12+; ES modules, native HTTP/fetch/streams, built-in test runner.
- Puppeteer 25.x with its matching Chrome for Testing. Interactive launches are headed; the smoke test is headless.
- `@google/genai` 2.x for current Gemini Interactions and Veo operations.
- yargs 18.x for CLI parsing; dotenv 17.x for working-directory `.env` loading.
- Native HTTP adapters for OpenAI, Anthropic, xAI, DeepSeek and Mistral; no additional SDKs.

Development: `npm ci`, configure only selected providers' environment keys, then `npm start`. Use `node index.js --list-models` without credentials. See README for all keys/options and `API_KEY`/`GOOGLE_API_KEY` compatibility.

Checks: `npm test`, `npm run test:browser`, `npm audit`. No live provider calls are part of these tests. If install scripts are disabled, install matching Chrome with `npx puppeteer browsers install chrome`.

The HTTP proxy is loopback-only through the CLI and uses a private launch token. API keys remain server-side. Requests have deadlines; media is bounded to 64 MiB per result/cache and concurrent work is limited. These safeguards do not cancel provider-side charges or make Chrome a complete security sandbox.
