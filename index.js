#!/usr/bin/env node

import "dotenv/config";
import { randomUUID } from "node:crypto";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { startServer } from "./server.js";
import { startBrowser } from "./browser.js";
import { defaults, listModels, resolveModel } from "./lib/models.js";
import { createGenerators } from "./lib/generation.js";

const argv = yargs(hideBin(process.argv))
  .option("port", { alias: "p", type: "number", default: 3001, description: "Local proxy port" })
  .option("hostname", { alias: "H", type: "string", default: "127.0.0.1", choices: ["127.0.0.1", "localhost", "::1"], description: "Loopback address for the private proxy" })
  .option("text-generation-model", { alias: "t", type: "string", default: defaults.text, description: "provider:model for HTML generation" })
  .option("image-generation-model", { alias: "i", type: "string", default: defaults.image, description: "provider:model for images, or none" })
  .option("video-generation-model", { alias: "v", type: "string", default: defaults.video, description: "provider:model for video (opt-in), or none" })
  .option("list-models", { type: "boolean", default: false, description: "List suggested models and API key variables, without starting Chrome" })
  .option("request-timeout", { type: "number", default: 120, description: "HTML/image generation deadline in seconds" })
  .option("video-timeout", { type: "number", default: 600, description: "Video generation deadline in seconds" })
  .option("devtools", { type: "boolean", default: false, description: "Open DevTools on launch" })
  .check((args) => {
    if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) throw new Error("port must be an integer from 1 to 65535");
    for (const name of ["request-timeout", "video-timeout"]) {
      if (!Number.isInteger(args[name]) || args[name] < 1 || args[name] > 3600) throw new Error(`${name} must be from 1 to 3600 seconds`);
    }
    return true;
  })
  .strict()
  .help()
  .parse();

if (argv.listModels) {
  console.table(listModels());
  console.log("Verified 2026-09-17. Preview models may change; access depends on your account. See docs/UPGRADE-PLAN.md.");
} else {
  let server;
  let browser;
  let stopping = false;
  async function shutdown(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    server?.close();
    server?.closeAllConnections();
    await browser?.close().catch(() => {});
  }
  try {
    const models = {
      text: resolveModel(argv.textGenerationModel, "text"),
      image: resolveModel(argv.imageGenerationModel, "image"),
      video: resolveModel(argv.videoGenerationModel, "video"),
    };
    const generators = createGenerators(models); // Validate only the keys actually in use.
    const token = randomUUID();
    server = await startServer({
      hostname: argv.hostname, port: argv.port, token, models, generators,
      timeoutMs: argv.requestTimeout * 1000, videoTimeoutMs: argv.videoTimeout * 1000,
    });
    console.log(`Fauxmium proxy listening on ${argv.hostname}:${server.address().port}`);
    for (const [kind, model] of Object.entries(models)) console.log(`${kind}: ${model ? `${model.provider}:${model.id}` : "disabled"}`);
    if (models.video) console.warn("Video generation is enabled and billed by your provider. Stopping a request may not stop provider-side billing.");
    browser = await startBrowser({ hostname: argv.hostname, port: server.address().port, token, models, devtools: argv.devtools });
    browser.once("disconnected", () => void shutdown());
    process.once("SIGINT", () => void shutdown(130));
    process.once("SIGTERM", () => void shutdown(143));
  } catch (error) {
    console.error(`Unable to start Fauxmium: ${error.message}`);
    await shutdown(1);
  }
}
