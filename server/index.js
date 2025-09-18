import http from "http";
import { GoogleGenAI } from "@google/genai";
import { processHTML } from "../server/processHTML.js";
import { processImage } from "../server/processImage.js";
import { sessionCosts, loadCosts } from "../lib/costCalculator.js";

export async function startServer(
  hostname,
  port,
  API_KEY,
  textGenerationModel,
  imageGenerationModel
) {
  await loadCosts(textGenerationModel);
  //await loadCosts(imageGenerationModel);

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const server = http.createServer(async (req, res) => {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/html") {
      await processHTML(res, url, ai, textGenerationModel);
    } else if (url.pathname === "/image") {
      await processImage(res, url, ai, imageGenerationModel);
    } else if (url.pathname === "/cost") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(sessionCosts, null, 2));
    } else {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Not Found");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
