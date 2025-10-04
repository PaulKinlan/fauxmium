/**
 * Reusable CLI option builders
 */

export function commonNetOptions(y) {
  return y
    .option("hostname", {
      alias: "H",
      type: "string",
      default: "127.0.0.1",
      describe: "The hostname to run the server on",
    })
    .option("port", {
      alias: "p",
      type: "number",
      default: 3001,
      describe: "The port to run the server on",
    })
    .option("devtools", {
      type: "boolean",
      default: false,
      describe: "Open DevTools on launch",
    });
}

export function keyOptions(y) {
  return y
    .option("api-key", {
      type: "string",
      describe: "Explicit API key for text provider (overrides env)",
    })
    .option("image-api-key", {
      type: "string",
      describe: "Explicit API key for image provider (overrides env)",
    })
    .option("video-api-key", {
      type: "string",
      describe: "Explicit API key for video provider (overrides env)",
    });
}

export function textModelOptions(y, { defaultModel, choices }) {
  return y.option("model", {
    alias: "m",
    type: "string",
    default: defaultModel,
    describe: "The model to use for text generation",
    choices: choices?.length ? choices : undefined,
  });
}

export function imageOptions(
  y,
  { defaultProvider, defaultModel, choices, supportedProviders = [] }
) {
  return y
    .option("image-provider", {
      type: "string",
      default: defaultProvider,
      describe:
        "AI provider for image generation (default matches the chosen command provider). Non-Google image providers currently return a placeholder PNG.",
      choices: supportedProviders.length ? supportedProviders : undefined,
    })
    .option("image-model", {
      alias: "i",
      type: "string",
      default: defaultModel,
      describe: "The model to use for image generation",
      choices: choices?.length ? choices : undefined,
    });
}

export function videoOptions(
  y,
  { defaultProvider, defaultModel, choices, supportedProviders = [] }
) {
  return y
    .option("video-provider", {
      type: "string",
      default: defaultProvider,
      describe:
        "AI provider for video generation (default matches the chosen command provider). Non-Google video providers currently return a placeholder MP4.",
      choices: supportedProviders.length ? supportedProviders : undefined,
    })
    .option("video-model", {
      alias: "v",
      type: "string",
      default: defaultModel,
      describe: "The model to use for video generation",
      choices: choices?.length ? choices : undefined,
    });
}
