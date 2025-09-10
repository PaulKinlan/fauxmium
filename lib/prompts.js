import fs from "fs/promises";
import { interpolate } from "./interpolate.js";

export async function generatePrompt(name, values) {
  const promptTemplate = await fs.readFile(`./prompts/${name}.txt`, "utf8");
  return interpolate(promptTemplate, values);
}
