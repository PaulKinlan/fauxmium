import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { interpolate } from "./interpolate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptsDir = path.join(__dirname, "..", "prompts");

const templateCache = new Map();

/**
 * Read prompt template file with in-memory caching
 * @param {string} filename
 * @returns {Promise<string|null>}
 */
async function readTemplate(filename) {
  if (templateCache.has(filename)) {
    return templateCache.get(filename);
  }
  const filePath = path.join(promptsDir, filename);
  try {
    const content = await fs.readFile(filePath, "utf8");
    templateCache.set(filename, content);
    return content;
  } catch (err) {
    if (err.code === "ENOENT") {
      templateCache.set(filename, null);
      return null;
    }
    throw err;
  }
}

/**
 * Common default values for prompt interpolation
 * Omits volatile minute-by-minute currentTime to maximize LLM prompt prefix caching
 */
function getDefaultValues() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return {
    currentDate: dateStr,
    currentDateTime: dateStr,
  };
}

/**
 * Generate a structured prompt splitting static system instructions and user prompt.
 * If prompts/${name}-system.txt exists, it is loaded (and cached in-memory) as system,
 * while prompts/${name}.txt is interpolated with values as prompt.
 * @param {string} name
 * @param {Record<string, any>} values
 * @returns {Promise<{ system: string, prompt: string }>}
 */
export async function generateStructuredPrompt(name, values = {}) {
  const systemTemplate = await readTemplate(`${name}-system.txt`);
  const userTemplate = (await readTemplate(`${name}.txt`)) || "";

  const defaultValues = getDefaultValues();
  const mergedValues = { ...defaultValues, ...values };

  const system = systemTemplate ? systemTemplate.trim() : "";
  const prompt = interpolate(userTemplate, mergedValues);

  return { system, prompt };
}

/**
 * Backwards-compatible prompt generator returning a single combined string.
 * @param {string} name
 * @param {Record<string, any>} values
 * @returns {Promise<string>}
 */
export async function generatePrompt(name, values = {}) {
  const { system, prompt } = await generateStructuredPrompt(name, values);
  if (system) {
    return `${system}\n\n${prompt}`;
  }
  return prompt;
}
