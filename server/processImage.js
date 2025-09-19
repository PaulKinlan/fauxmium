import { generatePrompt } from "../lib/prompts.js";
import { generateImage } from "../lib/aiAdapter.js";

export async function processImage(res, url, imageConfig) {
  const requestUrl = url.searchParams.get("url");
  const newUrl = new URL(requestUrl);
  const description = newUrl.searchParams.get("description");

  let contentType = "image/png";
  res.setHeader("Content-Type", contentType);

  console.log(
    `Image request for URL: ${requestUrl} with description: ${description}`
  );
  console.log(`Server generating image for: ${requestUrl}`);
  try {
    const prompt = await generatePrompt("image", {
      description: description || requestUrl,
    });

    const { mimeType, base64Data } = await generateImage(imageConfig, prompt);

    // Decode base64 to binary using Buffer
    const binaryData = Buffer.from(base64Data, "base64");

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
