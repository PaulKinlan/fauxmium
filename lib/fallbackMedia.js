/**
 * Fallback media assets and generators
 * Provides valid, standard-compliant fallback MP4 video and styled SVG image placeholders.
 */

// A valid 0.5s H.264 baseline/faststart MP4 buffer (160x90) playable across all Chromium builds
const MINIMAL_MP4_BASE64 =
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAPXbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAggAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAwF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAggAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAABaAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAIIAAAEAAABAAAAAAJ5bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAGgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACJG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAeRzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAWgBIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAL/+EAGWdkAAus2UKN+TARAAADAAEAAAMAMg8UKZYBAAZo6+PEyEz9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAOEAAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAA0AAAIAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAB4Y3R0cwAAAAAAAAANAAAAAQAABAAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAA0AAAABAAAASHN0c3oAAAAAAAAAAAAAAA0AAALoAAAAEQAAAA4AAAAOAAAADgAAABcAAAAQAAAADgAAAA4AAAAWAAAAEAAAAA4AAAAOAAAAFHN0Y28AAAAAAAAAAQAABAcAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMgAAAAhmcmVlAAADsG1kYXQAAAKwBgX//6zcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6LTM6LTMgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTIuMDA6MC43MCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTQgdGhyZWFkcz0zIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMjAAgAAAADBliIQAEc5//veIHzLLb5xq13IR560urR9Q7kZ4NHgSq9V1kN66d5XVBUQAGsCMCIEAAAANQZokbEEM5/6qVQA8YAAAAApBnkJ4h2c/AGhBAAAACgGeYXRDc58AlIAAAAAKAZ5jakNznwCUgQAAABNBmmhJqEFomUwIfnP//qmWAOaBAAAADEGehkURLDs5/wBoQQAAAAoBnqV0Q3OfAJSBAAAACgGep2pDc58AlIAAAAASQZqsSahBbJlMCG5z//6nhAHHAAAADEGeykUVLDs5/wBoQQAAAAoBnul0Q3OfAJSAAAAACgGe62pDc58AlIA=";

export const FALLBACK_MP4_BUFFER = Buffer.from(MINIMAL_MP4_BASE64, "base64");

/**
 * Generate a styled SVG placeholder for images
 */
export function generatePlaceholderSvg({
  width = 600,
  height = 400,
  description = "Fauxmium Generated Image",
  title = "Fauxmium Media",
} = {}) {
  const safeDesc = (description || "Fauxmium Generated Image")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .substring(0, 100);

  const safeTitle = (title || "Fauxmium Media")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const w = parseInt(width, 10) || 600;
  const h = parseInt(height, 10) || 400;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#181824"/>
      <stop offset="100%" stop-color="#2a2b3d"/>
    </linearGradient>
    <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.03"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.03"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#shimmer)"/>
  <g fill="#9094ab" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" text-anchor="middle">
    <circle cx="${w / 2}" cy="${Math.max(30, h / 2 - 35)}" r="22" fill="#32344a"/>
    <path d="M${w / 2 - 10} ${Math.max(30, h / 2 - 35) + 6} L${w / 2 - 4} ${Math.max(30, h / 2 - 35) - 2} L${w / 2 + 2} ${Math.max(30, h / 2 - 35) + 4} L${w / 2 + 10} ${Math.max(30, h / 2 - 35) - 6}" stroke="#737799" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${w / 2}" y="${Math.max(70, h / 2 + 10)}" font-size="14" font-weight="600" fill="#e2e4ef">${safeTitle}</text>
    <text x="${w / 2}" y="${Math.max(90, h / 2 + 32)}" font-size="11" fill="#888c9f">${safeDesc}</text>
    <text x="${w / 2}" y="${Math.max(110, h / 2 + 50)}" font-size="9" fill="#585c6d">${w} × ${h}</text>
  </g>
</svg>`;

  return {
    mimeType: "image/svg+xml",
    buffer: Buffer.from(svg, "utf8"),
  };
}
