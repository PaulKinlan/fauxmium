import { generatePrompt } from "../lib/prompts.js";
import { generateImage } from "../lib/aiAdapter.js";
import { costCalculator } from "../lib/costCalculator.js";
import { cacheImage } from "../lib/imageCache.js";

export async function processImage(res, url, imageConfig) {
  const requestUrl = url.searchParams.get("url");
  const newUrl = new URL(requestUrl);
  const description = newUrl.searchParams.get("description");
  const debug = false; // used later when we add global debuging

  const contentType = "image/png";
  const displayUrl = debug
    ? requestUrl
    : requestUrl.replace(/(http|https):\/\//, "").substring(0, 30);
  res.setHeader("Content-Type", contentType);

  console.log(
    `Image request for URL: ${displayUrl} with description: ${description}`
  );
  try {
    const prompt = await generatePrompt("image", {
      description: description || requestUrl,
    });

    const { mimeType, base64Data, usage } = await generateImage(
      imageConfig,
      prompt
    );

    newUrl.search = ""; // strip any params
    newUrl.hash = ""; // strip any hash
    console.log(
      `Base64 image generated for: ${base64Data.toString().substring(0, 30)}`
    );

    // Cache the generated image for potential use by video generation
    cacheImage(newUrl.toString(), {
      imageBytes: base64Data,
      mimeType,
    });

    // Decode base64 to binary using Buffer
    const binaryData = Buffer.from(base64Data, "base64");

    const cost = costCalculator(imageConfig.model, requestUrl);
    // https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-image-preview 1290 tokens = $0.000387
    const costResult = cost({ usage, END: true });

    console.log(
      `Image generated for ${displayUrl} with cost: $${costResult.cost.toFixed(
        6
      )}`
    );

    // Return binary data with proper content type
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", binaryData.length.toString());
    res.end(binaryData);
  } catch (e) {
    console.error(`Failed to generate image for ${requestUrl}:`);
    console.error("error name: ", e.name);
    console.error("error message: ", e.message);
    console.error("error status: ", e.status);

    // Fallback: transparent 1x1 PNG so the page still renders an image
    // Base64 of a 1x1 transparent PNG
    const placeholderBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
    const binaryData = Buffer.from(placeholderBase64, "base64");

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", binaryData.length.toString());
    res.end(binaryData);
  }
}
