import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { interpolate } from "./interpolate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generatePrompt(name, values) {
  const promptTemplate = await fs.readFile(
    path.join(__dirname, "..", "prompts", `${name}.txt`),
    "utf8"
  );
  return interpolate(promptTemplate, values);
}
