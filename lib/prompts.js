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

  const now = new Date();
  const defaultValues = {
    currentDate: now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    currentTime: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }),
    currentDateTime: now.toString(),
  };

  const mergedValues = { ...defaultValues, ...values };

  return interpolate(promptTemplate, mergedValues);
}
