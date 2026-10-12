import { generatePrompt } from "../lib/prompts.js";
import { generateAudio } from "../lib/aiAdapter.js";
import { costCalculator } from "../lib/costCalculator.js";
import {
  cacheAudio,
  getCachedAudio,
  normalizeCacheKey,
} from "../lib/imageCache.js";
import { serveMediaBuffer } from "../lib/rangeResponse.js";
import { synthesizeWav } from "../lib/audioSynth.js";

export async function processAudio(req, res, url, audioConfig) {
  const requestUrl = url.searchParams.get("url") || "";

  let newUrl;
  try {
    newUrl = new URL(requestUrl);
  } catch {
    newUrl = new URL("http://placeholder.local/audio.wav");
  }

  const description = newUrl.searchParams.get("description") || "";
  const type = newUrl.searchParams.get("type") || "music";
  const voice = newUrl.searchParams.get("voice") || "alloy";
  const durationParam = newUrl.searchParams.get("duration");
  const durationSeconds = durationParam ? parseFloat(durationParam) : undefined;

  const cacheKey = normalizeCacheKey(requestUrl);

  // 1. Check if audio generation is disabled
  if (audioConfig?.enabled === false) {
    console.log(`[audio] Audio generation disabled for: ${requestUrl}`);
    const emptyWav = synthesizeWav({ description: "disabled", type: "sfx", durationSeconds: 0.1 });
    serveMediaBuffer(req, res, emptyWav.buffer, emptyWav.mimeType);
    return;
  }

  // 2. Check Audio Cache
  const cachedAudio = getCachedAudio(cacheKey) || getCachedAudio(requestUrl);
  if (cachedAudio) {
    console.log(`[audio] Serving cached audio for: ${requestUrl}`);
    const cost = costCalculator(audioConfig?.model || "synth-wav", requestUrl, "audio");
    cost({ cached: true, END: true });
    serveMediaBuffer(req, res, cachedAudio.buffer, cachedAudio.mimeType);
    return;
  }

  console.log(`[audio] Audio request for URL: ${requestUrl}, type: ${type}, description: ${description}`);

  try {
    const prompt = await generatePrompt("audio", {
      description: description || requestUrl,
      type,
    });

    const { mimeType, buffer, usage } = await generateAudio(
      audioConfig || { provider: "synth" },
      prompt,
      {
        description,
        type,
        voice,
        durationSeconds,
      }
    );

    // Cache the audio
    cacheAudio(cacheKey, {
      buffer,
      mimeType,
    });

    const cost = costCalculator(audioConfig?.model || "synth-wav", requestUrl, "audio");
    cost({ usage, END: true });

    serveMediaBuffer(req, res, buffer, mimeType);
  } catch (e) {
    console.error(`[audio] Failed to generate audio for ${requestUrl}:`, e.message);

    // Fallback to procedural WAV synthesizer
    const fallback = synthesizeWav({ description, type, durationSeconds });
    serveMediaBuffer(req, res, fallback.buffer, fallback.mimeType);
  }
}
