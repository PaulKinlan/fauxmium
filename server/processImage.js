import { generatePrompt } from "../lib/prompts";

export async function processImage(res, url, ai, imageGenerationModel) {
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

    const response = await ai.models.generateContent({
      model: imageGenerationModel,
      contents: prompt,
      config: {
        personGeneration: "allow_adult",
        responseModalities: ["IMAGE"],
      },
    });

    if (response.candidates.length === 0 || !response.candidates[0].content) {
      console.log("Prompt feedback:", response);

      throw new Error("No candidates in AI response");
    }

    const aiImageResponse = response.candidates[0].content.parts.find(
      (part) => "inlineData" in part
    );

    // Check if we have inline data (base64 image)
    if (!aiImageResponse.inlineData || !aiImageResponse.inlineData.data) {
      console.log(response.candidates[0].content);
      throw new Error("No image data in AI response");
    }

    // Convert base64 to binary data
    const base64Data = aiImageResponse.inlineData.data;
    const mimeType = aiImageResponse.inlineData.mimeType || "image/png";

    // Decode base64 to binary
    const binaryData = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
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
    // Return a placeholder image or error message
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end(`Error generating image: ${e.message}`);
  }
}
