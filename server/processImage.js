import { generatePrompt } from "../lib/prompts.js";
import { generateImage } from "../lib/aiAdapter.js";
import { costCalculator } from "../lib/costCalculator.js";
import {
  cacheImage,
  getCachedImage,
  getPendingImage,
  registerPendingImage,
  normalizeCacheKey,
} from "../lib/imageCache.js";
import { generatePlaceholderSvg } from "../lib/fallbackMedia.js";
import { getActiveLensInstruction } from "../lib/sessionState.js";
import { getDomainColorPalette } from "../lib/siteMemory.js";

function inferImageRole(urlStr, desc, w, h) {
  const text = `${urlStr} ${desc}`.toLowerCase();
  if (text.includes("logo") || text.includes("brand") || text.includes("wordmark")) return "logo";
  if (text.includes("icon") || text.includes("favicon") || text.includes("symbol") || text.includes("badge")) return "icon";
  if (text.includes("avatar") || text.includes("headshot") || text.includes("profile") || text.includes("portrait") || text.includes("author") || text.includes("user")) return "avatar";
  if (text.includes("hero") || text.includes("banner") || text.includes("cover") || text.includes("header") || (parseInt(w) >= 1000 && parseInt(h) <= 600)) return "hero";
  if (text.includes("product") || text.includes("item") || text.includes("merch") || text.includes("shop")) return "product";
  if (text.includes("thumb") || text.includes("preview") || text.includes("card") || (parseInt(w) <= 400 && parseInt(h) <= 400)) return "thumbnail";
  return "illustration/photo";
}

function calculateAspectRatio(w, h) {
  const width = parseFloat(w) || 800;
  const height = parseFloat(h) || 600;
  if (height === 0) return "16:9 (Widescreen)";
  const ratio = width / height;
  if (ratio >= 0.9 && ratio <= 1.1) return "1:1 (Square)";
  if (ratio >= 1.65 && ratio <= 1.9) return "16:9 (Widescreen)";
  if (ratio >= 0.5 && ratio <= 0.65) return "9:16 (Vertical)";
  if (ratio >= 1.25 && ratio <= 1.45) return "4:3 (Standard)";
  if (ratio >= 2.1 && ratio <= 2.5) return "21:9 (Ultrawide)";
  return `${Math.round(ratio * 100) / 100}:1`;
}

export async function processImage(res, url, imageConfig, { abortSignal } = {}) {
  const requestUrl = url.searchParams.get("url") || "";

  // Guard against data: URIs if ever passed to /image
  if (requestUrl.startsWith("data:")) {
    const match = requestUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (match) {
      const mimeType = match[1] || "image/gif";
      const isBase64 = Boolean(match[2]);
      const dataBuf = isBase64
        ? Buffer.from(match[3], "base64")
        : Buffer.from(decodeURIComponent(match[3]));
      res.statusCode = 200;
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", dataBuf.length.toString());
      res.end(dataBuf);
      return;
    }
  }

  let newUrl;
  try {
    newUrl = new URL(requestUrl);
  } catch {
    newUrl = new URL("http://placeholder.local/image.png");
  }

  const description = newUrl.searchParams.get("description") || "";
  const width = newUrl.searchParams.get("width") || "800";
  const height = newUrl.searchParams.get("height") || "600";
  const role = newUrl.searchParams.get("role") || inferImageRole(requestUrl, description, width, height);
  const aspectRatio = calculateAspectRatio(width, height);
  const siteColors = getDomainColorPalette(requestUrl, newUrl.searchParams.get("origin") || "");
  const colorScheme = newUrl.searchParams.get("colorScheme") || "light";
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

  // 3. Generate Image with in-flight Promise deduplication
  try {
    let generationPromise = getPendingImage(cacheKey);
    const isSharedPromise = Boolean(generationPromise);

    if (!generationPromise) {
      const prompt = await generatePrompt("image", {
        description: description || requestUrl,
        width,
        height,
        role,
        aspectRatio,
        siteColors,
        colorScheme,
        lensInstruction: getActiveLensInstruction() || "Standard web imagery",
      });

      generationPromise = generateImage(imageConfig, prompt, { abortSignal });
      registerPendingImage(cacheKey, generationPromise);
    }

    const { mimeType, base64Data, usage } = await generationPromise;

    if (!isSharedPromise) {
      // Cache the generated image
      cacheImage(cacheKey, {
        imageBytes: base64Data,
        mimeType,
      });
    }

    const binaryData = Buffer.from(base64Data, "base64");

    const cost = costCalculator(imageConfig.model, requestUrl, "image");
    cost({ usage, END: true });

    res.statusCode = 200;
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", binaryData.length.toString());
    res.end(binaryData);
  } catch (e) {
    if (abortSignal?.aborted === true || e?.name === "AbortError") {
      console.log(`Image generation cancelled for ${displayUrl} (client disconnected)`);
      if (!res.writableEnded) res.end();
      return;
    }
    console.error(`[image] Failed to generate image for ${requestUrl}:`, e.message);

    // Clean, styled SVG fallback matching width/height
    const placeholder = generatePlaceholderSvg({
      width,
      height,
      description: description || "Image preview unavailable",
      title: "Image Generation Error",
    });

    if (res.writableEnded) return;
    res.statusCode = 200;
    res.setHeader("Content-Type", placeholder.mimeType);
    res.setHeader("Content-Length", placeholder.buffer.length.toString());
    res.end(placeholder.buffer);
  }
}
