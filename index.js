#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { startServer } from "./server/index.js";
import { startBrowser } from "./browser.js";

/**
 * Map CLI command names to internal provider keys used by aiAdapter.
 * - gemini/google -> google
 * - openai -> openai
 * - anthropic -> anthropic
 * - groq -> groq
 */
function normalizeProvider(p) {
  const key = (p || "").toLowerCase();
  if (key === "gemini" || key === "google") return "google";
  return key;
}

function resolveApiKey(provider) {
  const p = normalizeProvider(provider);
  switch (p) {
    case "google":
      return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "groq":
      return process.env.GROQ_API_KEY;
    default:
      return undefined;
  }
}

async function run(providerFromCmd, argv) {
  const textProvider = normalizeProvider(providerFromCmd);
  const imageProvider = normalizeProvider(
    argv["image-provider"] || providerFromCmd
  );

  const hostname = argv.hostname;
  const port = argv.port;
  const enableDevTools = argv.devtools;

  const textGenerationModel = argv.model;
  const imageGenerationModel = argv["image-model"];

  const textApiKey = argv["api-key"] || resolveApiKey(textProvider);
  const imageApiKey = argv["image-api-key"] || resolveApiKey(imageProvider);

  if (!textApiKey) {
    console.warn(
      `No API key found for provider '${providerFromCmd}'. Set via --api-key or environment variable.`
    );
    process.exit(1);
  }
  if (!imageApiKey) {
    console.warn(
      `No API key found for image provider '${
        argv["image-provider"] || providerFromCmd
      }'. Set via --image-api-key or environment variable.`
    );
    process.exit(1);
  }

  console.log(`Starting server on http://${hostname}:${port}`);
  console.log(
    `Using text provider: ${textProvider}, model: ${textGenerationModel}`
  );
  console.log(
    `Using image provider: ${imageProvider}, model: ${imageGenerationModel}`
  );

  await startServer(
    hostname,
    port,
    { provider: textProvider, apiKey: textApiKey, model: textGenerationModel },
    {
      provider: imageProvider,
      apiKey: imageApiKey,
      model: imageGenerationModel,
    }
  );
  startBrowser(hostname, port, enableDevTools);
}

/**
 * Helpers to build per-command options
 */
function commonNetOptions(y) {
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

function keyOptions(y) {
  return y
    .option("api-key", {
      type: "string",
      describe: "Explicit API key for text provider (overrides env)",
    })
    .option("image-api-key", {
      type: "string",
      describe: "Explicit API key for image provider (overrides env)",
    });
}

function imageOptions(y, { defaultProvider, defaultImageModel, imageChoices }) {
  return y
    .option("image-provider", {
      type: "string",
      default: defaultProvider,
      describe:
        "AI provider for image generation (default matches the chosen command provider). Non-Google image providers currently return a placeholder PNG.",
      choices: ["gemini", "google"],
    })
    .option("image-model", {
      alias: "i",
      type: "string",
      default: defaultImageModel,
      describe: "The model to use for image generation",
      choices: imageChoices?.length ? imageChoices : undefined,
    });
}

function buildCommand(cmdNames, describe, defaults) {
  const {
    defaultTextModel,
    textChoices,
    defaultImageProvider,
    defaultImageModel,
    imageChoices,
  } = defaults;

  return {
    command: Array.isArray(cmdNames) ? cmdNames : [cmdNames],
    describe,
    builder: (y) => {
      let yy = y.option("model", {
        alias: "m",
        type: "string",
        default: defaultTextModel,
        describe: "The model to use for text generation",
        choices: textChoices?.length ? textChoices : undefined,
      });

      yy = imageOptions(yy, {
        defaultProvider: Array.isArray(defaultImageProvider)
          ? defaultImageProvider[0]
          : defaultImageProvider,
        defaultImageModel,
        imageChoices,
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      // Nested 'images' subcommand to configure image provider/model with contextual help
      yy = yy.command({
        command: "images [provider]",
        describe:
          "Configure image generation provider and model (defaults to this command's provider)",
        builder: (z) =>
          imageOptions(z, {
            defaultProvider: Array.isArray(defaultImageProvider)
              ? defaultImageProvider[0]
              : defaultImageProvider,
            defaultImageModel,
            imageChoices,
          }),
        handler: (argv) =>
          run(Array.isArray(cmdNames) ? cmdNames[0] : cmdNames, argv),
      });

      return yy;
    },
    handler: (argv) =>
      run(Array.isArray(cmdNames) ? cmdNames[0] : cmdNames, argv),
  };
}

/**
 * Build an image-only provider command. This lets users run:
 *   my-cli images gemini
 * and see image-specific help/options per provider.
 *
 * By default, text provider remains Gemini to preserve current behavior.
 * Users can still override text settings with flags if desired.
 */
function buildImagesProviderCommand(cmdName, describe, defaults) {
  const { defaultImageModel, imageChoices, defaultImageProvider } = defaults;

  return {
    command: defaultImageProvider,
    describe,
    builder: (y) => {
      let yy = imageOptions(y, {
        defaultProvider: cmdName,
        defaultImageModel,
        imageChoices,
      });

      yy = keyOptions(yy);
      yy = commonNetOptions(yy);

      return yy;
    },
    handler: (argv) => {
      // Force the image provider to this command's provider
      argv["image-provider"] = cmdName;

      // Keep text provider defaulting to Gemini for now
      return run("gemini", argv);
    },
  };
}

const defaultTextProvider = "gemini";
const defaultTextModel = "gemini-2.5-flash-lite";
const defaultTextModels = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];
const defaultImageProvider = "gemini";
const defaultImageModel = "gemini-2.5-flash-image-preview";
const imageChoices = ["gemini-2.5-flash-image-preview"];

yargs(hideBin(process.argv))
  // Gemini / Google
  .command(
    buildCommand(["gemini", "google"], "Use the Gemini (Google) provider", {
      defaultTextModel,
      textChoices: defaultTextModels,
      defaultImageProvider,
      defaultImageModel,
      imageChoices,
    })
  )
  // OpenAI
  .command(
    buildCommand("openai", "Use the OpenAI provider", {
      defaultTextModel: "gpt-5-nano",
      textChoices: ["gpt-5-nano", "gpt-4-mini", "gpt-5-pro"],
      defaultImageProvider: "gemini",
      defaultImageModel: "gemini-2.5-flash-image-preview",
      imageChoices: ["gemini-2.5-flash-image-preview"],
    })
  )
  // Anthropic
  .command(
    buildCommand("anthropic", "Use the Anthropic provider", {
      defaultTextModel: "claude-3-7-sonnet-latest",
      textChoices: [
        "claude-sonnet-4-0",
        "claude-3-7-sonnet-latest",
        "claude-3-opus-latest",
      ],

      defaultImageProvider: "gemini",
      defaultImageModel: "gemini-2.5-flash-image-preview",
      imageChoices: ["gemini-2.5-flash-image-preview"],
    })
  )
  // Groq
  .command(
    buildCommand("groq", "Use the Groq provider", {
      defaultTextModel: "moonshotai/kimi-k2-instruct-0905",
      textChoices: [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "openai/gpt-oss-120b",
        "moonshotai/kimi-k2-instruct-0905",
        "qwen/qwen3-32b",
        "groq/compound",
      ],

      defaultImageProvider: "gemini",
      defaultImageModel: "gemini-2.5-flash-image-preview",
      imageChoices: ["gemini-2.5-flash-image-preview"],
    })
  )
  // Top-level 'images' command with provider-specific subcommands and contextual help
  .command({
    command: "images",
    describe: "Image generation commands",
    builder: (y) => {
      // we can only use gemini/google for images right now
      y.command(
        buildImagesProviderCommand("gemini", "Use Gemini for images", {
          defaultImageModel: "gemini-2.5-flash-image-preview",
          imageChoices: ["gemini-2.5-flash-image-preview"],
        })
      );

      return y.demandCommand(
        1,
        "You need to specify an image provider command (gemini)."
      );
    },
    handler: () => {},
  })
  .command(
    "$0",
    "the default command",
    (yy) => {
      yy = yy.option("model", {
        alias: "m",
        type: "string",
        default: defaultTextModel,
        describe: "The model to use for text generation",
        choices: defaultTextModels,
      });
      yy = keyOptions(yy);
      yy = commonNetOptions(yy);
      yy = imageOptions(yy, {
        defaultProvider: defaultImageProvider,
        defaultImageModel: defaultImageModel,
        imageChoices: imageChoices,
      });

      return yy;
    },
    (argv) => {
      run(defaultTextProvider, argv);
    }
  )
  .strictCommands()
  .help()
  .parse();
