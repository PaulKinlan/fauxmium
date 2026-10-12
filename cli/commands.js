/**
 * Command factory functions
 */

import {
  commonNetOptions,
  keyOptions,
  textModelOptions,
  imageOptions,
  videoOptions,
  audioOptions,
} from "./options.js";
import {
  normalizeProvider,
  validateApiKeys,
  getProviderDefaults,
} from "./providers.js";
import { getProviderConfig, getProvidersWithFeature } from "../config/providers.js";
import { startServer } from "../server/index.js";
import { startBrowser } from "../browser.js";

/**
 * Main run function - handles server startup
 */
async function run(textProviderName, argv) {
  let effectiveTextProvider = textProviderName;
  let textGenerationModel = argv.model;
  if (textGenerationModel && textGenerationModel.includes(":")) {
    const colonIdx = textGenerationModel.indexOf(":");
    const possibleProvider = textGenerationModel.slice(0, colonIdx);
    const candidateConfig = getProviderConfig(possibleProvider);
    if (candidateConfig) {
      effectiveTextProvider = candidateConfig.key;
      textGenerationModel = textGenerationModel.slice(colonIdx + 1);
    }
  }

  const textProvider = normalizeProvider(effectiveTextProvider);
  const imageProvider = normalizeProvider(
    argv["image-provider"] || effectiveTextProvider
  );
  const videoProvider = normalizeProvider(
    argv["video-provider"] || effectiveTextProvider
  );
  const audioProvider = normalizeProvider(
    argv["audio-provider"] || "synth"
  );

  const { textApiKey, imageApiKey, videoApiKey, audioApiKey } = validateApiKeys(
    { text: textProvider, image: imageProvider, video: videoProvider, audio: audioProvider },
    argv
  );

  const hostname = argv.hostname;
  const port = argv.port;
  const enableDevTools = argv.devtools;

  const imageGenerationModel = argv["image-model"];
  const videoGenerationModel = argv["video-model"];
  const audioGenerationModel = argv["audio-model"];

  const activeLens = argv.lens || "modern";
  const customLensPrompt = argv["custom-lens"] || "";

  console.log(`Starting Fauxmium server on http://${hostname}:${port}`);
  console.log(`Browsing Lens: [${activeLens}]`);
  console.log(`Text provider: ${textProvider}, model: ${textGenerationModel}`);
  console.log(`Image provider: ${imageProvider}, model: ${imageGenerationModel} (enabled: ${argv.images !== false})`);
  console.log(`Video provider: ${videoProvider}, model: ${videoGenerationModel} (enabled: ${argv.video !== false})`);
  console.log(`Audio provider: ${audioProvider}, model: ${audioGenerationModel} (enabled: ${argv.audio !== false})`);

  if (!argv.verbose) {
    console.log(
      `\n💡 Tip: Run Fauxmium with --verbose to view raw prompts and streaming chunks in real-time!`
    );
  }

  await startServer(
    hostname,
    port,
    {
      provider: textProvider,
      apiKey: textApiKey,
      model: textGenerationModel,
      baseURL: argv["base-url"],
      verbose: argv.verbose,
    },
    {
      provider: imageProvider,
      apiKey: imageApiKey,
      model: imageGenerationModel,
      baseURL: argv["base-url"],
      enabled: argv.images !== false,
      verbose: argv.verbose,
    },
    {
      provider: videoProvider,
      apiKey: videoApiKey,
      model: videoGenerationModel,
      enabled: argv.video !== false,
      verbose: argv.verbose,
    },
    {
      provider: audioProvider,
      apiKey: audioApiKey,
      model: audioGenerationModel,
      enabled: argv.audio !== false,
      verbose: argv.verbose,
    },
    {
      activeLens,
      customLensPrompt,
      syncModels: Boolean(argv["sync-models"]),
    }
  );

  startBrowser(hostname, port, enableDevTools);
}

/**
 * Build a provider command (e.g., 'gemini', 'openai', 'anthropic', 'groq')
 */
export function buildProviderCommand(providerName, description) {
  const config = getProviderConfig(providerName);
  const defaults = getProviderDefaults(providerName);

  return {
    command: config.aliases,
    describe: description,
    builder: (y) => {
      let yy = textModelOptions(y, {
        defaultModel: defaults.text.defaultModel,
        choices: defaults.text.choices,
      });

      yy = imageOptions(yy, {
        defaultProvider: defaults.image.provider || "gemini",
        defaultModel: defaults.image.defaultModel,
        choices: defaults.image.choices,
      });

      yy = videoOptions(yy, {
        defaultProvider: defaults.video.provider || "gemini",
        defaultModel: defaults.video.defaultModel,
        choices: defaults.video.choices,
      });

      yy = audioOptions(yy, {
        defaultProvider: defaults.audio.provider || "synth",
        defaultModel: defaults.audio.defaultModel,
        choices: defaults.audio.choices,
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      // Add 'images' subcommand
      yy = yy.command({
        command: "images [provider]",
        describe: "Configure image generation provider and model",
        builder: (z) =>
          imageOptions(z, {
            defaultProvider: defaults.image.provider || "gemini",
            defaultModel: defaults.image.defaultModel,
            choices: defaults.image.choices,
          }),
        handler: (argv) => run(config.aliases[0], argv),
      });

      // Add 'videos' subcommand
      yy = yy.command({
        command: "videos [provider]",
        describe: "Configure video generation provider and model",
        builder: (z) =>
          videoOptions(z, {
            defaultProvider: defaults.video.provider || "gemini",
            defaultModel: defaults.video.defaultModel,
            choices: defaults.video.choices,
          }),
        handler: (argv) => run(config.aliases[0], argv),
      });

      // Add 'audio' subcommand
      yy = yy.command({
        command: "audio [provider]",
        describe: "Configure audio generation provider and model",
        builder: (z) =>
          audioOptions(z, {
            defaultProvider: defaults.audio.provider || "synth",
            defaultModel: defaults.audio.defaultModel,
            choices: defaults.audio.choices,
          }),
        handler: (argv) => run(config.aliases[0], argv),
      });

      return yy;
    },
    handler: (argv) => run(config.aliases[0], argv),
  };
}

/**
 * Build image-specific provider command (for 'images gemini' etc)
 */
export function buildImageProviderCommand(providerName, description) {
  const config = getProviderConfig(providerName);

  return {
    command: config.aliases,
    describe: description,
    builder: (y) => {
      let yy = imageOptions(y, {
        defaultProvider: providerName,
        defaultModel: config.image?.defaultModel,
        choices: config.image?.choices,
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => {
      argv["image-provider"] = providerName;
      return run("gemini", argv);
    },
  };
}

/**
 * Build video-specific provider command (for 'video gemini' etc)
 */
export function buildVideoProviderCommand(providerName, description) {
  const config = getProviderConfig(providerName);

  return {
    command: config.aliases,
    describe: description,
    builder: (y) => {
      let yy = videoOptions(y, {
        defaultProvider: providerName,
        defaultModel: config.video?.defaultModel,
        choices: config.video?.choices,
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => {
      argv["video-provider"] = providerName;
      return run("gemini", argv);
    },
  };
}

/**
 * Build audio-specific provider command (for 'audio synth' etc)
 */
export function buildAudioProviderCommand(providerName, description) {
  const config = getProviderConfig(providerName);

  return {
    command: config.aliases,
    describe: description,
    builder: (y) => {
      let yy = audioOptions(y, {
        defaultProvider: providerName,
        defaultModel: config.audio?.defaultModel,
        choices: config.audio?.choices,
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => {
      argv["audio-provider"] = providerName;
      return run("gemini", argv);
    },
  };
}

/**
 * Build default command (runs when no command is specified)
 */
export function buildDefaultCommand(defaultProvider) {
  const defaults = getProviderDefaults(defaultProvider);

  return {
    command: "$0",
    describe: "the default command",
    builder: (y) => {
      let yy = textModelOptions(y, {
        defaultModel: defaults.text.defaultModel,
        choices: defaults.text.choices,
      });

      yy = imageOptions(yy, {
        defaultProvider: defaults.image.provider || "gemini",
        defaultModel: defaults.image.defaultModel,
        choices: defaults.image.choices,
      });

      yy = videoOptions(yy, {
        defaultProvider: defaults.video.provider || "gemini",
        defaultModel: defaults.video.defaultModel,
        choices: defaults.video.choices,
      });

      yy = audioOptions(yy, {
        defaultProvider: defaults.audio.provider || "synth",
        defaultModel: defaults.audio.defaultModel,
        choices: defaults.audio.choices,
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => run(defaultProvider, argv),
  };
}
