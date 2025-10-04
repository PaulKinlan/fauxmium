/**
 * Command factory functions
 */

import {
  commonNetOptions,
  keyOptions,
  textModelOptions,
  imageOptions,
  videoOptions,
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
  const textProvider = normalizeProvider(textProviderName);
  const imageProvider = normalizeProvider(
    argv["image-provider"] || textProviderName
  );
  const videoProvider = normalizeProvider(
    argv["video-provider"] || textProviderName
  );

  const { textApiKey, imageApiKey, videoApiKey } = validateApiKeys(
    { text: textProvider, image: imageProvider, video: videoProvider },
    argv
  );

  const hostname = argv.hostname;
  const port = argv.port;
  const enableDevTools = argv.devtools;

  const textGenerationModel = argv.model;
  const imageGenerationModel = argv["image-model"];
  const videoGenerationModel = argv["video-model"];

  console.log(`Starting server on http://${hostname}:${port}`);
  console.log(
    `Using text provider: ${textProvider}, model: ${textGenerationModel}`
  );
  console.log(
    `Using image provider: ${imageProvider}, model: ${imageGenerationModel}`
  );
  console.log(
    `Using video provider: ${videoProvider}, model: ${videoGenerationModel}`
  );

  await startServer(
    hostname,
    port,
    { provider: textProvider, apiKey: textApiKey, model: textGenerationModel },
    {
      provider: imageProvider,
      apiKey: imageApiKey,
      model: imageGenerationModel,
    },
    {
      provider: videoProvider,
      apiKey: videoApiKey,
      model: videoGenerationModel,
    }
  );
  startBrowser(hostname, port, enableDevTools);
}

/**
 * Build a provider command (e.g., 'gemini', 'openai', 'anthropic')
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
        supportedProviders: getProvidersWithFeature("image"),
      });

      yy = videoOptions(yy, {
        defaultProvider: defaults.video.provider || "gemini",
        defaultModel: defaults.video.defaultModel,
        choices: defaults.video.choices,
        supportedProviders: getProvidersWithFeature("video"),
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      // Add 'images' subcommand
      yy = yy.command({
        command: "images [provider]",
        describe:
          "Configure image generation provider and model (defaults to this command's provider)",
        builder: (z) =>
          imageOptions(z, {
            defaultProvider: defaults.image.provider || "gemini",
            defaultModel: defaults.image.defaultModel,
            choices: defaults.image.choices,
            supportedProviders: getProvidersWithFeature("image"),
          }),
        handler: (argv) => run(config.aliases[0], argv),
      });

      // Add 'videos' subcommand
      yy = yy.command({
        command: "videos [provider]",
        describe:
          "Configure video generation provider and model (defaults to this command's provider)",
        builder: (z) =>
          videoOptions(z, {
            defaultProvider: defaults.video.provider || "gemini",
            defaultModel: defaults.video.defaultModel,
            choices: defaults.video.choices,
            supportedProviders: getProvidersWithFeature("video"),
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
        defaultModel: config.image.defaultModel,
        choices: config.image.choices,
        supportedProviders: getProvidersWithFeature("image"),
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => {
      // Force the image provider to this command's provider
      argv["image-provider"] = providerName;
      // Keep text provider defaulting to Gemini
      return run("gemini", argv);
    },
  };
}

/**
 * Build video-specific provider command (for 'videos gemini' etc)
 */
export function buildVideoProviderCommand(providerName, description) {
  const config = getProviderConfig(providerName);

  return {
    command: config.aliases,
    describe: description,
    builder: (y) => {
      let yy = videoOptions(y, {
        defaultProvider: providerName,
        defaultModel: config.video.defaultModel,
        choices: config.video.choices,
        supportedProviders: getProvidersWithFeature("video"),
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => {
      // Force the video provider to this command's provider
      argv["video-provider"] = providerName;
      // Keep text provider defaulting to Gemini
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
        supportedProviders: getProvidersWithFeature("image"),
      });

      yy = videoOptions(yy, {
        defaultProvider: defaults.video.provider || "gemini",
        defaultModel: defaults.video.defaultModel,
        choices: defaults.video.choices,
        supportedProviders: getProvidersWithFeature("video"),
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => run(defaultProvider, argv),
  };
}
