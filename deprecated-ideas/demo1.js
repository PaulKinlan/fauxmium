import puppeteer from "puppeteer";
import { GoogleGenAI } from "@google/genai";

// Load the API key from an environment variable
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable not set.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

async function run() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });
  const page = await browser.newPage();

  await page.setRequestInterception(true);

  page.on("request", async (interceptedRequest) => {
    const url = interceptedRequest.url();
    const resourceType = interceptedRequest.resourceType();

    try {
      let prompt;
      let contentType;
      let model = "gemini-2.5-flash"; // Default model

      if (resourceType === "document") {
        prompt = `Create the HTML for a web page that would be served at the URL: ${url}. The page should be visually appealing and relevant to the URL.
        
        Relevant details about the request:
        
        - URL: ${url}
        - Resource Type: ${resourceType}
        - Headers: ${JSON.stringify(interceptedRequest.headers(), null, 2)}
        
        Response requirements:
        - Please ensure the HTML is well-structured and includes modern web design practices. 
        - Include basic CSS styles within a <style> tag in the <head> section.
        - Only return the HTML content without any additional explanations or markdown formatting.`;
        contentType = "text/html";
      } else if (resourceType === "stylesheet") {
        prompt = `Create the CSS styles for a web page at the URL: ${url}. The styles should be modern and clean.`;
        contentType = "text/css";
      } else if (resourceType === "script") {
        prompt = `Create the JavaScript code for a web page at the URL: ${url}. The script should add some interactivity to the page.`;
        contentType = "application/javascript";
      } else if (resourceType === "image") {
        // This is a more complex case. For now, we'll return a placeholder.
        // A more advanced implementation could generate an image or fetch one from a service.
        const truncatedUrl = url.length > 50 ? url.slice(0, 47) + "..." : url;
        console.log(`Skipping image request: ${truncatedUrl}`);
        interceptedRequest.continue();
        return;
      } else {
        interceptedRequest.continue();
        return;
      }

      console.log(`Generating content for: ${url} (${resourceType})`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      const text = response.text;
      console.log(`Generated content for ${url} (${resourceType}):\n`, text);

      // Clean up the response from Gemini, which often includes markdown fences
      const cleanedText = text
        .replace(/```(html|css|javascript)?/g, "")
        .replace(/```/g, "")
        .trim();

      interceptedRequest.respond({
        status: 200,
        contentType: contentType,
        body: cleanedText,
      });
    } catch (error) {
      console.error(`Failed to generate content for ${url}:`, error);
      interceptedRequest.abort();
    }
  });

  console.log(
    "WebSim is running. Navigate to any URL in the browser to generate a page."
  );
}

run();
