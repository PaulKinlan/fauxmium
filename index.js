#!/usr/bin/env node

import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { startServer } from "./server.js";
import { startBrowser } from "./browser.js";

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
  .option("text-generation-model", {
    alias: "t",
    type: "string",
    default: "gemini-2.5-flash-lite",
    description:
      "The model to use for text generation. Defaults to Gemini 2.5 Flash Lite",
  })
  .option("image-generation-model", {
    alias: "i",
    type: "string",
    default: "gemini-2.5-flash-image-preview",
    description: "The model to use for image generation",
  }).argv;

const hostname = argv.hostname;
const port = argv.port;
const textGenerationModel = argv["text-generation-model"];
const imageGenerationModel = argv["image-generation-model"];
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn(
    "No GEMINI_API_KEY found in environment variables. Please set it in a .env file or your environment.\nYou can get an API key from https://aistudio.google.com/apikey"
  );

  process.exit(1);
}

console.log(`Starting server on http://${hostname}:${port}`);
console.log(`Using text generation model: ${textGenerationModel}`);
console.log(`Using image generation model: ${imageGenerationModel}`);

startServer(hostname, port, API_KEY, textGenerationModel, imageGenerationModel);
startBrowser(hostname, port);
