import { generatePrompt } from "../lib/prompts.js";
import { costCalculator } from "../lib/costCalculator.js";
import { waitForCachedImage } from "../lib/imageCache.js";

import { GoogleGenAI } from "@google/genai";

export async function processVideo(res, url, VideoConfig) {
  const requestUrl = url.searchParams.get("url");
  const newUrl = new URL(requestUrl);
  const description = newUrl.searchParams.get("description");
  const posterUrl = new URL(encodeURI(newUrl.searchParams.get("poster")));

  const ai = new GoogleGenAI({ apiKey: VideoConfig.apiKey });

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

    // Generate video with or without poster image
    const generateParams = {
      model: VideoConfig.model,
      prompt: prompt,
    };

    if (posterImageData) {
      generateParams.image = posterImageData;
      console.log(`Generating video with poster image reference`);
    } else {
      console.log(`Generating video without poster image reference`);
    }

    let operation = await ai.models.generateVideos(generateParams);

    while (!operation.done) {
      console.log("Waiting for video generation to complete...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
    }

    const videoUrl = operation.response?.generatedVideos[0]?.video.uri;
    console.log(`Video marked as completed with URL: ${videoUrl}`);

    console.log("Downloading video...");
    const videoResponse = await fetch(videoUrl, {
      headers: {
        "x-goog-api-key": VideoConfig.apiKey,
      },
    });

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
    const mimeType = videoResponse.headers.get("Content-Type") || "video/mp4";
    // Return binary data with proper content type
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Length",
      videoResponse.headers.get("Content-Length")
    );
    res.end(Buffer.from(await videoResponse.arrayBuffer()));
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
