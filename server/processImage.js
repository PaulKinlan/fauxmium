import { generatePrompt } from "../lib/prompts.js";
import { generateImage } from "../lib/aiAdapter.js";
import { costCalculator } from "../lib/costCalculator.js";
import {
  cacheImage,
  getCachedImage,
  registerPendingImage,
  normalizeCacheKey,
} from "../lib/imageCache.js";
import { generatePlaceholderSvg } from "../lib/fallbackMedia.js";

export async function processImage(res, url, imageConfig) {
  const requestUrl = url.searchParams.get("url") || "";

  let newUrl;
  try {
    newUrl = new URL(requestUrl);
  } catch {
    newUrl = new URL("http://placeholder.local/image.png");
  }

  const description = newUrl.searchParams.get("description") || "";
  const width = newUrl.searchParams.get("width") || "800";
  const height = newUrl.searchParams.get("height") || "600";
  const cacheKey = normalizeCacheKey(requestUrl);

  const displayUrl = requestUrl
    .replace(/(http|https):\/\//, "")
    .substring(0, 40);

  // 1. Check if image generation is disabled via config
  if (imageConfig?.enabled === false) {
    console.log(`[image] Generation disabled, serving styled placeholder for: ${displayUrl}`);
    const placeholder = generatePlaceholderSvg({
      width,
      height,
      description: description || "Image generation disabled",
      title: "Fauxmium Image",
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", placeholder.mimeType);
    res.setHeader("Content-Length", placeholder.buffer.length.toString());
    res.end(placeholder.buffer);
    return;
  }

  // 2. Check Cache
  const cached = getCachedImage(cacheKey) || getCachedImage(requestUrl);
  if (cached) {
    console.log(`[image] Serving from cache: ${displayUrl}`);
    const binaryData = Buffer.from(cached.imageBytes, "base64");
    const cost = costCalculator(imageConfig.model, requestUrl, "image");
    cost({ cached: true, END: true });

    res.statusCode = 200;
    res.setHeader("Content-Type", cached.mimeType);
    res.setHeader("Content-Length", binaryData.length.toString());
    res.end(binaryData);
    return;
  }

  console.log(`[image] Request for URL: ${displayUrl} with description: ${description}`);

  // 3. Generate Image with in-flight Promise tracking
  try {
    const prompt = await generatePrompt("image", {
      description: description || requestUrl,
      width,
      height,
    });

    const generationPromise = generateImage(imageConfig, prompt);
    registerPendingImage(cacheKey, generationPromise);

    const { mimeType, base64Data, usage } = await generationPromise;

    // Cache the generated image
    cacheImage(cacheKey, {
      imageBytes: base64Data,
      mimeType,
    });

    const binaryData = Buffer.from(base64Data, "base64");

    const cost = costCalculator(imageConfig.model, requestUrl, "image");
    cost({ usage, END: true });

    res.statusCode = 200;
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", binaryData.length.toString());
    res.end(binaryData);
  } catch (e) {
    console.error(`[image] Failed to generate image for ${requestUrl}:`, e.message);

    // Clean, styled SVG fallback matching width/height
    const placeholder = generatePlaceholderSvg({
      width,
      height,
      description: description || "Image preview unavailable",
      title: "Image Generation Error",
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", placeholder.mimeType);
    res.setHeader("Content-Length", placeholder.buffer.length.toString());
    res.end(placeholder.buffer);
  }
}
