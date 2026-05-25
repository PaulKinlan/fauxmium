import { generatePrompt } from "../lib/prompts.js";
import { generateVideo } from "../lib/aiAdapter.js";
import { costCalculator } from "../lib/costCalculator.js";
import { waitForCachedImage } from "../lib/imageCache.js";

export async function processVideo(res, url, VideoConfig) {
  const requestUrl = url.searchParams.get("url");
  const newUrl = new URL(requestUrl);
  const description = newUrl.searchParams.get("description");
  const posterUrl = new URL(encodeURI(newUrl.searchParams.get("poster")));

  const contentType = "video/mp4";
  res.setHeader("Content-Type", contentType);

  console.log(
    `Video request for URL: ${requestUrl}
  with description: ${description}
  poster: ${posterUrl}`
  );
  console.log(`Server generating Video for: ${requestUrl}`);
  try {
    const prompt = await generatePrompt("video", {
      description: description || requestUrl,
    });

    // Wait for cached poster image if provided
    let posterImageData = null;
    if (posterUrl) {
      posterUrl.search = ""; // strip any params
      posterUrl.hash = ""; // strip any hash
      const posterUrlString = posterUrl.toString();
      console.log(`Waiting for cached poster image: ${posterUrlString}`);

      // Wait up to 30 seconds for the poster image to be generated and cached
      const cachedImage = await waitForCachedImage(
        posterUrlString,
        30000,
        1000
      );

      if (cachedImage) {
        posterImageData = cachedImage;
        console.log(`Using cached poster image (${cachedImage.mimeType})`);
      } else {
        console.warn(
          `Poster image not found in cache after timeout: ${posterUrl}`
        );
        console.warn(`Video will be generated without poster reference`);
      }
    }

    const { mimeType, base64Data } = await generateVideo(
      VideoConfig,
      prompt,
      posterImageData ? { image: posterImageData } : {}
    );

    const binaryData = Buffer.from(base64Data, "base64");

    const cost = costCalculator(VideoConfig.model, requestUrl);
    // // https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-Video-preview 1290 tokens = $0.000387
    const usage = {
      inputTokens: 0,
      outputTokens: 8,
    };
    const costResult = cost({ usage, END: true });

    console.log(
      `Video generated for ${requestUrl} with cost: $${costResult.cost.toFixed(
        6
      )}`
    );
    // Return binary data with proper content type
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Length",
      binaryData.length.toString()
    );
    res.end(binaryData);
  } catch (e) {
    console.error(`Failed to generate Video for ${requestUrl}:`);
    console.error("error name: ", e.name);
    console.error("error message: ", e.message);
    console.error("error status: ", e.status);

    // Fallback: transparent 1x1 PNG so the page still renders an Video
    // Base64 of a 1x1 transparent PNG
    const placeholderBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
    const binaryData = Buffer.from(placeholderBase64, "base64");

    res.statusCode = 200;
    res.setHeader("Content-Type", "Video/png");
    res.setHeader("Content-Length", binaryData.length.toString());
    res.end(binaryData);
  }
}
