# Active context

Updated 2026-09-17.

The project now has independently selected text/image/video providers, a dated model catalog, Gemini Interactions/Veo, OpenAI Responses/Images, Claude Messages and xAI/DeepSeek/Mistral support. Video is opt-in. The catalog and official references are in `lib/models.js` and `docs/UPGRADE-PLAN.md`.

This update also addresses request-header privacy, private proxy authentication, startup/shutdown, malformed URLs, raw/fenced HTML streaming, cancellation, backpressure, bounded media caching and video byte ranges. Dependencies were refreshed; the npm audit changed from 12 findings to zero.

Offline provider/HTTP tests and a real-Chrome smoke test are available. No paid provider calls were made, so account access, output quality and actual generated-video playback are unverified. See the plan's release gates before publishing.

Next: budgeted live validation and trusted video approval, then persistent media jobs and site memory. Do not add Sora: OpenAI documents its video API shutdown for 2026-09-24. The current browser is experimental, not a complete network sandbox.
