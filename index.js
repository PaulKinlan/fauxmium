#!/usr/bin/env node

import dotenv from "dotenv";
dotenv.config();
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { startServer } from "./server/index.js";
import { startBrowser } from "./browser.js";
import { loadCosts } from "./lib/costCalculator.js";

function resolveApiKey(provider) {
  const p = (provider || "google").toLowerCase();
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

const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    type: "number",
    default: 3001,
    description: "The port to run the server on",
  })
  .option("hostname", {
    alias: "H",
    type: "string",
    default: "127.0.0.1",
    description: "The hostname to run the server on",
  })
  .option("provider", {
    alias: "r",
    type: "string",
    default: "google",
    description:
      "AI provider for text generation (google|openai|anthropic|groq)",
  })
  .option("text-generation-model", {
    alias: "t",
    type: "string",
    default: "gemini-2.5-flash-lite",
    description:
      "The model to use for text generation. Defaults to Gemini 2.5 Flash Lite",
  })
  .option("image-provider", {
    type: "string",
    default: "google",
    description: "AI provider for image generation",
  })
  .option("image-generation-model", {
    alias: "i",
    type: "string",
    default: "gemini-2.5-flash-image-preview",
    description: "The model to use for image generation",
  })
  .option("api-key", {
    type: "string",
    description: "Explicit API key for text provider (overrides env)",
  })
  .option("image-api-key", {
    type: "string",
    description: "Explicit API key for image provider (overrides env)",
  })
  .option("devtools", {
    type: "boolean",
    default: false,
    description: "Open DevTools on launch",
  }).argv;

const hostname = argv.hostname;
const port = argv.port;
const textProvider = argv["provider"];
const imageProvider = argv["image-provider"];
const textGenerationModel = argv["text-generation-model"];
const imageGenerationModel = argv["image-generation-model"];
const enableDevTools = argv["devtools"];
const textApiKey = argv["api-key"] || resolveApiKey(textProvider);
const imageApiKey = argv["image-api-key"] || resolveApiKey(imageProvider);

if (!textApiKey) {
  console.warn(
    `No API key found for provider '${textProvider}'. Set via --api-key or environment variable.`
  );
  process.exit(1);
}
if (!imageApiKey) {
  console.warn(
    `No API key found for image provider '${imageProvider}'. Set via --image-api-key or environment variable.`
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
  { provider: imageProvider, apiKey: imageApiKey, model: imageGenerationModel }
);
startBrowser(hostname, port, enableDevTools);
