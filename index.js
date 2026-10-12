#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import {
  buildProviderCommand,
  buildImageProviderCommand,
  buildVideoProviderCommand,
  buildAudioProviderCommand,
  buildDefaultCommand,
} from "./cli/commands.js";
import { PROVIDERS, DEFAULT_TEXT_PROVIDER } from "./config/providers.js";

// Build provider commands from configuration
const providerCommands = Object.keys(PROVIDERS).map((providerKey) => {
  const config = PROVIDERS[providerKey];
  const description = `Use the ${
    config.aliases[0].charAt(0).toUpperCase() + config.aliases[0].slice(1)
  } provider`;
  return buildProviderCommand(config.aliases[0], description);
});

yargs(hideBin(process.argv))
  // Register all provider commands
  .command(providerCommands)
  // Top-level 'images' command with provider-specific subcommands
  .command({
    command: "images",
    describe: "Image generation commands",
    builder: (y) => {
      Object.entries(PROVIDERS).forEach(([key, config]) => {
        if (config.image?.supported) {
          y.command(
            buildImageProviderCommand(
              key,
              `Use ${key.charAt(0).toUpperCase() + key.slice(1)} for images`
            )
          );
        }
      });

      return y.demandCommand(
        1,
        "You need to specify an image provider command (e.g. gemini, openai)."
      );
    },
    handler: () => {},
  })
  // Top-level 'video' command with provider-specific subcommands
  .command({
    command: "video",
    describe: "Video generation commands",
    builder: (y) => {
      Object.entries(PROVIDERS).forEach(([key, config]) => {
        if (config.video?.supported) {
          y.command(
            buildVideoProviderCommand(
              key,
              `Use ${key.charAt(0).toUpperCase() + key.slice(1)} for videos`
            )
          );
        }
      });

      return y.demandCommand(
        1,
        "You need to specify a video provider command (e.g. gemini)."
      );
    },
    handler: () => {},
  })
  // Top-level 'audio' command with provider-specific subcommands
  .command({
    command: "audio",
    describe: "Audio generation commands",
    builder: (y) => {
      Object.entries(PROVIDERS).forEach(([key, config]) => {
        if (config.audio?.supported) {
          y.command(
            buildAudioProviderCommand(
              key,
              `Use ${key.charAt(0).toUpperCase() + key.slice(1)} for audio`
            )
          );
        }
      });

      return y.demandCommand(
        1,
        "You need to specify an audio provider command (e.g. synth, openai, gemini)."
      );
    },
    handler: () => {},
  })
  // Default command
  .command(buildDefaultCommand(DEFAULT_TEXT_PROVIDER))
  .strictCommands()
  .help()
  .parse();
