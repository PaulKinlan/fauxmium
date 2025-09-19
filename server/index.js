import http from "http";
import { processHTML } from "../server/processHTML.js";
import { processImage } from "../server/processImage.js";
import { sessionCosts, loadCosts } from "../lib/costCalculator.js";

export async function startServer(hostname, port, textConfig, imageConfig) {
  try {
    if (textConfig?.model) {
      await loadCosts(textConfig.model);
    } else {
      console.warn(
        "[costs] No text model configured; costs will be treated as 0."
      );
    }
    // If tracking image costs later, guard similarly:
    // if (imageConfig?.model) await loadCosts(imageConfig.model);
  } catch (e) {
    console.warn(
      `[costs] Failed to initialize costs for model '${textConfig?.model}':`,
      e
    );
  }

  const server = http.createServer(async (req, res) => {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/html") {
      await processHTML(res, url, textConfig);
    } else if (url.pathname === "/image") {
      await processImage(res, url, imageConfig);
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
