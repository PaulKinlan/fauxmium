import http from "http";
import { processHTML } from "../server/processHTML.js";
import { processImage } from "../server/processImage.js";
import { sessionCosts, loadCosts } from "../lib/costCalculator.js";

export async function startServer(hostname, port, textConfig, imageConfig) {
  await loadCosts(textConfig.model);
  //await loadCosts(imageConfig.model);

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
