import { generatePrompt } from "../lib/prompts.js";
import { generateVideo } from "../lib/aiAdapter.js";
import { costCalculator } from "../lib/costCalculator.js";
import {
  waitForCachedImage,
  cacheVideo,
  getCachedVideo,
  normalizeCacheKey,
} from "../lib/imageCache.js";
import { serveMediaBuffer } from "../lib/rangeResponse.js";
import { FALLBACK_MP4_BUFFER } from "../lib/fallbackMedia.js";
import { getActiveLensInstruction } from "../lib/sessionState.js";

function calculateAspectRatio(w, h) {
  const width = parseFloat(w) || 1280;
  const height = parseFloat(h) || 720;
  if (height === 0) return "16:9 (Widescreen)";
  const ratio = width / height;
  if (ratio >= 0.9 && ratio <= 1.1) return "1:1 (Square)";
  if (ratio >= 1.65 && ratio <= 1.9) return "16:9 (Widescreen)";
  if (ratio >= 0.5 && ratio <= 0.65) return "9:16 (Vertical)";
  if (ratio >= 1.25 && ratio <= 1.45) return "4:3 (Standard)";
  if (ratio >= 2.1 && ratio <= 2.5) return "21:9 (Ultrawide)";
  return `${Math.round(ratio * 100) / 100}:1`;
}

export async function processVideo(req, res, url, VideoConfig) {
  const requestUrl = url.searchParams.get("url") || "";

  let newUrl;
  try {
    newUrl = new URL(requestUrl);
  } catch {
    newUrl = new URL("http://placeholder.local/video.mp4");
  }

  const description = newUrl.searchParams.get("description") || "";
  const width = newUrl.searchParams.get("width") || "1280";
  const height = newUrl.searchParams.get("height") || "720";
  const camera = newUrl.searchParams.get("camera") || "smooth cinematic motion";
  const aspectRatio = calculateAspectRatio(width, height);
  const cacheKey = normalizeCacheKey(requestUrl);

  // Safe poster URL parsing
  const posterParam = newUrl.searchParams.get("poster");
  let posterUrl = null;
  if (posterParam) {
    try {
      posterUrl = new URL(posterParam, requestUrl);
    } catch {
      posterUrl = null;
    }
  }

  const posterDescription = posterUrl
    ? posterUrl.searchParams?.get("description") || "Poster image frame"
    : "None specified";

  // 1. Check if video generation is disabled
  if (VideoConfig?.enabled === false) {
    console.log(`[video] Video generation disabled, serving fallback MP4 for: ${requestUrl}`);
    serveMediaBuffer(req, res, FALLBACK_MP4_BUFFER, "video/mp4");
    return;
  }

  // 2. Check Video Cache
  const cachedVideo = getCachedVideo(cacheKey) || getCachedVideo(requestUrl);
  if (cachedVideo) {
    console.log(`[video] Serving cached video for: ${requestUrl}`);
    const cost = costCalculator(VideoConfig.model, requestUrl, "video");
    cost({ cached: true, END: true });
    serveMediaBuffer(req, res, cachedVideo.buffer, cachedVideo.mimeType);
    return;
  }

  console.log(`[video] Video request for URL: ${requestUrl}, description: ${description}`);

  try {
    const prompt = await generatePrompt("video", {
      description: description || requestUrl,
      width,
      height,
      aspectRatio,
      camera,
      posterDescription,
      lensInstruction: getActiveLensInstruction() || "Standard video aesthetic",
    });

    // Check for cached poster image (or await active in-flight poster image generation)
    let posterImageData = null;
    if (posterUrl) {
      const posterUrlString = normalizeCacheKey(posterUrl.toString());
      console.log(`[video] Awaiting cached/pending poster image: ${posterUrlString}`);

      const cachedImage = await waitForCachedImage(posterUrlString, 8000, 250);
      if (cachedImage) {
        posterImageData = cachedImage;
        console.log(`[video] Using poster image (${cachedImage.mimeType})`);
      } else {
        console.log(`[video] No poster image found in time; proceeding without poster reference`);
      }
    }

    const { mimeType, base64Data } = await generateVideo(
      VideoConfig,
      prompt,
      posterImageData ? { image: posterImageData } : {}
    );

    const binaryData = Buffer.from(base64Data, "base64");

    // Cache the video
    cacheVideo(cacheKey, {
      buffer: binaryData,
      mimeType: mimeType || "video/mp4",
    });

    const cost = costCalculator(VideoConfig.model, requestUrl, "video");
    const usage = {
      durationSeconds: 8,
      outputTokens: 8,
      totalTokens: 8,
    };
    cost({ usage, END: true });

    console.log(`[video] Video generated successfully for ${requestUrl}`);
    serveMediaBuffer(req, res, binaryData, mimeType || "video/mp4");
  } catch (e) {
    console.error(`[video] Failed to generate video for ${requestUrl}:`, e.message);

    // Serve valid minimal MP4 so player doesn't crash or display broken icon
    serveMediaBuffer(req, res, FALLBACK_MP4_BUFFER, "video/mp4");
  }
}
