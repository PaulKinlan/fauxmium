/**
 * Configuration for allowed third-party domains that can be accessed by generated pages.
 * This allows pages to use external libraries, fonts, and utilities.
 */

export const ALLOWED_DOMAINS = [
  // Google Fonts and related services
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  
  // JavaScript module CDNs
  "esm.sh",
  "unpkg.com",
];

/**
 * Check if a URL is allowed to be accessed by the browser.
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is allowed, false otherwise
 */
export function isAllowedDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    return ALLOWED_DOMAINS.some(allowedDomain => {
      // Exact match or subdomain match
      return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
    });
  } catch (e) {
    // Invalid URL
    return false;
  }
}
