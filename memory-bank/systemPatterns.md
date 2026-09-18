# System patterns

`index.js` resolves model selections and validates the necessary provider keys, starts the authenticated local server, then awaits Chrome launch. It closes resources on startup failure, browser disconnect and termination signals.

`browser.js` rewrites HTTP(S) navigation, image and enabled video requests to the private proxy. Only the proxy token, byte range and preferred language are forwarded; site cookies and authorization are discarded. Generated pages allow inline styles/scripts but block external scripts, frames, workers and network APIs through CSP. This is not a complete Chromium network sandbox.

`server.js` validates requests and generates prompts. Text is normalized into `{text, usageMetadata}` chunks by `lib/generation.js`, extracted as raw/fenced HTML and streamed with backpressure. HTTP connection closure aborts upstream work. Media generation shares in-flight jobs through `lib/mediaCache.js`; completed binary results are byte-bounded and support range requests.

`lib/models.js` owns provider capabilities, API-key names and a dated suggested catalog. The Google SDK handles Interactions and Veo. Other providers use native `fetch`; OpenAI uses Responses, Claude uses Messages, and Grok/DeepSeek/Mistral use compatible chat completions. `lib/sse.js` handles HTTP event framing.

No framework, build step or database. Prompts remain editable files; cached media is cleared by restarting. Future structure changes are documented in `docs/UPGRADE-PLAN.md`, not scaffolded into the runtime.
