/**
 * HTTP Range Request Handler for Media Streaming (Video and Audio)
 * Enables smooth seeking and progressive playback in Chromium and media players.
 */

export function serveMediaBuffer(req, res, buffer, mimeType = "video/mp4") {
  const totalLength = buffer.length;

  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", mimeType);

  const range = req.headers?.range;

  if (!range) {
    res.statusCode = 200;
    res.setHeader("Content-Length", totalLength.toString());
    res.end(buffer);
    return;
  }

  // Parse Range header: e.g. "bytes=0-1024" or "bytes=1024-"
  const matches = range.match(/bytes=(\d*)-(\d*)/);
  if (!matches) {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${totalLength}`);
    res.end();
    return;
  }

  let start = matches[1] ? parseInt(matches[1], 10) : 0;
  let end = matches[2] ? parseInt(matches[2], 10) : totalLength - 1;

  if (isNaN(start) || start >= totalLength || start < 0) {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${totalLength}`);
    res.end();
    return;
  }

  if (isNaN(end) || end >= totalLength) {
    end = totalLength - 1;
  }

  if (start > end) {
    res.statusCode = 416;
    res.setHeader("Content-Range", `bytes */${totalLength}`);
    res.end();
    return;
  }

  const chunkSize = end - start + 1;
  res.statusCode = 206;
  res.setHeader("Content-Range", `bytes ${start}-${end}/${totalLength}`);
  res.setHeader("Content-Length", chunkSize.toString());

  res.end(buffer.subarray(start, end + 1));
}
