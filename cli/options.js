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
    })
    .option("verbose", {
      type: "boolean",
      default: false,
      describe: "Enable verbose logging to see raw LLM inputs and stream responses in real-time",
    })
    .option("lens", {
      type: "string",
      default: "modern",
      describe: "Browsing Lens aesthetic (modern, geocities-1997, web2-2007, cyberpunk-2077, solarpunk-2040, noir-1940s, custom)",
    })
    .option("custom-lens", {
      type: "string",
      describe: "Custom prompt text when --lens=custom is selected",
    })
    .option("sync-models", {
      type: "boolean",
      default: false,
      describe: "Force sync latest model pricing catalog from remote repository on start",
    })
    .option("images", {
      type: "boolean",
      default: true,
      describe: "Enable image generation (use --no-images to disable)",
    })
    .option("video", {
      type: "boolean",
      default: true,
      describe: "Enable video generation (use --no-video to disable)",
    })
    .option("audio", {
      type: "boolean",
      default: true,
      describe: "Enable audio generation (use --no-audio to disable)",
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
    })
    .option("audio-api-key", {
      type: "string",
      describe: "Explicit API key for audio provider (overrides env)",
    });
}

export function textModelOptions(y, { defaultModel, choices } = {}) {
  const describe = choices?.length
    ? `The model to use for text generation. Suggested: ${choices.join(", ")}`
    : "The model to use for text generation";

  return y.option("model", {
    alias: "m",
    type: "string",
    default: defaultModel,
    describe,
  });
}

export function imageOptions(
  y,
  { defaultProvider, defaultModel, choices } = {}
) {
  const modelDescribe = choices?.length
    ? `The model to use for image generation. Suggested: ${choices.join(", ")}`
    : "The model to use for image generation";

  return y
    .option("image-provider", {
      type: "string",
      default: defaultProvider,
      describe: "AI provider for image generation (gemini, openai, etc.)",
    })
    .option("image-model", {
      alias: "i",
      type: "string",
      default: defaultModel,
      describe: modelDescribe,
    });
}

export function videoOptions(
  y,
  { defaultProvider, defaultModel, choices } = {}
) {
  const modelDescribe = choices?.length
    ? `The model to use for video generation. Suggested: ${choices.join(", ")}`
    : "The model to use for video generation";

  return y
    .option("video-provider", {
      type: "string",
      default: defaultProvider,
      describe: "AI provider for video generation (gemini, etc.)",
    })
    .option("video-model", {
      alias: "v",
      type: "string",
      default: defaultModel,
      describe: modelDescribe,
    });
}

export function audioOptions(
  y,
  { defaultProvider, defaultModel, choices } = {}
) {
  const modelDescribe = choices?.length
    ? `The model to use for audio generation. Suggested: ${choices.join(", ")}`
    : "The model to use for audio generation";

  return y
    .option("audio-provider", {
      type: "string",
      default: defaultProvider || "synth",
      describe: "Audio generation provider (synth [zero-cost procedural WAV], openai [tts], gemini)",
    })
    .option("audio-model", {
      alias: "a",
      type: "string",
      default: defaultModel || "synth-wav",
      describe: modelDescribe,
    });
}
