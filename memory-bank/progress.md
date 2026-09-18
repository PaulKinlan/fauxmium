# Progress

## Implemented

- Multi-provider streaming HTML and image generation; opt-in Google/xAI video.
- Current model suggestions, bare-ID compatibility, capability/key validation and `--list-models`.
- Private loopback proxy, minimized request data, generated-page CSP and plaintext errors.
- Awaited startup, shutdown cleanup, deadlines, disconnect cancellation and backpressure.
- Shared in-flight media generation, 64 MiB session cache, four concurrent media jobs and byte-range responses.
- Node built-in tests and a headless Chrome smoke test with mocked providers.

## Not yet validated live

Provider credentials/entitlements, paid model output quality, real clip decoding and provider-side cancellation/billing. The Chrome test uses mock video bytes to verify routing, not playback.

## Remaining limitations

- No cross-page story/site memory, persisted generation jobs or page history.
- Media prompts have no surrounding-page context; requested layout dimensions do not select provider output sizes.
- Media is buffered in memory and capped at 64 MiB per result.
- Concurrency limits are not session spending ceilings; generated HTML controls are not trusted billing approvals.
- CSP and page interception are not comprehensive Chromium egress isolation.
- External CSS/JS assets are unsupported; inline CSS/JS already works.

Priorities and acceptance criteria: `docs/UPGRADE-PLAN.md`.
