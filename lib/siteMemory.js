/**
 * Site Memory & Link-Level Coherence
 * Tracks established visual design DNA (fonts, colors, navbar) and cached assets per domain,
 * and captures rich a => b click intent across page navigations.
 */

const siteProfiles = new Map();
const pendingLinkContexts = new Map();
let lastClickedContext = null;

/**
 * Normalize domain from a URL string
 * @param {string} urlStr
 * @returns {string}
 */
export function normalizeDomain(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Normalize URL for link context matching
 * @param {string} urlStr
 * @returns {string}
 */
function normalizeUrlKey(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return urlStr || "";
  }
}

/**
 * Record user click intent from page A when navigating to page B
 * @param {{ sourceUrl?: string, targetUrl: string, linkText?: string, dataContext?: string, cardTitle?: string, cardSnippet?: string, cardImageSrc?: string }} context
 */
export function recordLinkContext(context) {
  if (!context || !context.targetUrl) return;

  const key = normalizeUrlKey(context.targetUrl);
  const record = {
    sourceUrl: context.sourceUrl || "",
    targetUrl: context.targetUrl,
    linkText: (context.linkText || "").trim().slice(0, 200),
    dataContext: (context.dataContext || "").trim().slice(0, 500),
    cardTitle: (context.cardTitle || "").trim().slice(0, 200),
    cardSnippet: (context.cardSnippet || "").trim().slice(0, 400),
    cardImageSrc: (context.cardImageSrc || "").trim(),
    timestamp: Date.now(),
  };

  pendingLinkContexts.set(key, record);
  lastClickedContext = record;

  // Keep pending map bounded to recent 50 entries
  if (pendingLinkContexts.size > 50) {
    const oldestKey = pendingLinkContexts.keys().next().value;
    pendingLinkContexts.delete(oldestKey);
  }
}

/**
 * Consume link context for a target URL being rendered
 * @param {string} targetUrl
 * @returns {object|null}
 */
export function consumeLinkContext(targetUrl) {
  if (!targetUrl) return null;
  const key = normalizeUrlKey(targetUrl);

  // 1. Direct target URL match
  if (pendingLinkContexts.has(key)) {
    const ctx = pendingLinkContexts.get(key);
    pendingLinkContexts.delete(key);
    return ctx;
  }

  // 2. Path match without query params
  try {
    const targetParsed = new URL(targetUrl);
    for (const [pendingKey, ctx] of pendingLinkContexts.entries()) {
      const p = new URL(ctx.targetUrl);
      if (p.origin === targetParsed.origin && p.pathname === targetParsed.pathname) {
        pendingLinkContexts.delete(pendingKey);
        return ctx;
      }
    }
  } catch {}

  // 3. Fallback: Most recent click if within last 20 seconds
  if (lastClickedContext && Date.now() - lastClickedContext.timestamp < 20000) {
    const ctx = lastClickedContext;
    lastClickedContext = null;
    return ctx;
  }

  return null;
}

/**
 * Format link intent into a prompt section
 * @param {object|null} linkContext
 * @returns {string}
 */
export function formatLinkContext(linkContext) {
  if (!linkContext) {
    return "None (direct address bar navigation or initial entry).";
  }

  const parts = [];
  if (linkContext.cardTitle) {
    parts.push(`- Clicked Item Title: "${linkContext.cardTitle}"`);
  }
  if (linkContext.linkText && linkContext.linkText !== linkContext.cardTitle) {
    parts.push(`- Link Anchor Text: "${linkContext.linkText}"`);
  }
  if (linkContext.dataContext) {
    parts.push(`- Expected Destination Intent (data-context): ${linkContext.dataContext}`);
  }
  if (linkContext.cardSnippet) {
    parts.push(`- Contextual Snippet from Previous Page: ${linkContext.cardSnippet}`);
  }
  if (linkContext.cardImageSrc) {
    parts.push(
      `- Associated Media from Link/Card (REUSE this exact URL for primary hero/poster image): ${linkContext.cardImageSrc}`
    );
  }
  if (linkContext.sourceUrl) {
    parts.push(`- Navigation Source: ${linkContext.sourceUrl}`);
  }

  return parts.length > 0 ? parts.join("\n") : "None specified.";
}

/**
 * Parse generated HTML and extract reusable design tokens and assets
 * @param {string} pageUrl
 * @param {string} htmlContent
 */
export function extractAndSaveSiteProfile(pageUrl, htmlContent) {
  if (!pageUrl || !htmlContent || typeof htmlContent !== "string") return;

  const domain = normalizeDomain(pageUrl);
  if (!domain) return;

  const existing = siteProfiles.get(domain) || {
    domain,
    brandTitle: "",
    fonts: [],
    cssVars: [],
    navLinks: [],
    assets: [],
  };

  // 1. Extract Brand / Title
  const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch && !existing.brandTitle) {
    const rawTitle = titleMatch[1].trim();
    // E.g., "Video Title - YouTube" -> "YouTube" or "Paul Kinlan — Blog"
    const brandSuffix = rawTitle.split(/[-|—–]/).pop()?.trim();
    existing.brandTitle = brandSuffix || rawTitle.slice(0, 60);
  }

  // 2. Extract Fonts
  const fontLinks = htmlContent.match(/https:\/\/(fonts\.googleapis\.com|fonts\.bunny\.net)\/[^\s"'>]+/gi) || [];
  for (const fontUrl of fontLinks) {
    if (!existing.fonts.includes(fontUrl)) {
      existing.fonts.push(fontUrl);
    }
  }

  // Extract font-family declarations from <style>
  const fontFamilyMatches = htmlContent.match(/font-family\s*:\s*([^;}]+)/gi) || [];
  for (const ff of fontFamilyMatches.slice(0, 3)) {
    const cleanFF = ff.replace(/\s+/g, " ").trim();
    if (!existing.fonts.includes(cleanFF)) {
      existing.fonts.push(cleanFF);
    }
  }

  // 3. Extract CSS Variables / Color Palette
  const rootMatches = htmlContent.match(/:root\s*\{([^}]+)\}/i);
  if (rootMatches && rootMatches[1]) {
    const varPairs = rootMatches[1].match(/--[\w-]+\s*:\s*[^;]+/g) || [];
    for (const vp of varPairs.slice(0, 8)) {
      const cleanVp = vp.trim();
      if (!existing.cssVars.includes(cleanVp)) {
        existing.cssVars.push(cleanVp);
      }
    }
  }

  // 4. Extract Main Nav Links
  const navMatch = htmlContent.match(/<(nav|header)[^>]*>([\s\S]*?)<\/\1>/i);
  if (navMatch && navMatch[2]) {
    const linkMatches = [...navMatch[2].matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    for (const match of linkMatches.slice(0, 6)) {
      const href = match[1].trim();
      const text = match[2].replace(/<[^>]+>/g, "").trim();
      if (text && href && !href.startsWith("#") && !existing.navLinks.some((l) => l.href === href)) {
        existing.navLinks.push({ text: text.slice(0, 40), href });
      }
    }
  }

  // 5. Extract Media Assets (<img> tags)
  const imgMatches = [...htmlContent.matchAll(/<img\s+[^>]*src="([^"]+)"[^>]*>/gi)];
  for (const match of imgMatches.slice(0, 10)) {
    const fullTag = match[0];
    const src = match[1].trim();
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;

    const altMatch = fullTag.match(/alt="([^"]*)"/i);
    const alt = altMatch ? altMatch[1].trim() : "";

    if (!existing.assets.some((a) => a.src === src)) {
      existing.assets.push({ src, alt });
    }
  }

  // Bound assets and nav links
  if (existing.assets.length > 12) {
    existing.assets = existing.assets.slice(0, 12);
  }
  if (existing.navLinks.length > 8) {
    existing.navLinks = existing.navLinks.slice(0, 8);
  }

  siteProfiles.set(domain, existing);
}

/**
 * Get established design profile for a domain to inject into prompts
 * @param {string} pageUrl
 * @returns {string}
 */
export function getFormattedSiteProfile(pageUrl) {
  const domain = normalizeDomain(pageUrl);
  if (!domain || !siteProfiles.has(domain)) {
    return "None established yet (first page visit on this domain; establish a cohesive design system and reusable assets).";
  }

  const profile = siteProfiles.get(domain);
  const lines = [`Domain: ${profile.domain}${profile.brandTitle ? ` (${profile.brandTitle})` : ""}`];

  if (profile.fonts.length > 0) {
    lines.push(`Established Typography:\n  ${profile.fonts.slice(0, 4).join("\n  ")}`);
  }

  if (profile.cssVars.length > 0) {
    lines.push(`Established Design Tokens & CSS Variables:\n  ${profile.cssVars.slice(0, 8).join(";\n  ")};`);
  }

  if (profile.navLinks.length > 0) {
    const navStr = profile.navLinks.map((l) => `[${l.text}](${l.href})`).join(" | ");
    lines.push(`Established Navigation Bar Links: ${navStr}`);
  }

  if (profile.assets.length > 0) {
    lines.push(
      `Cached Domain Media Assets (REUSE these exact src URLs where applicable for instant 0ms cached loading):`
    );
    for (const a of profile.assets.slice(0, 8)) {
      lines.push(`  - <img src="${a.src}" alt="${a.alt}">`);
    }
  }

  return lines.join("\n\n");
}

const navigationThreads = new Map();
let globalRecentThread = [];
const MAX_THREAD_TURNS = 4; // 8 messages (4 user, 4 assistant)

/**
 * Compact assistant HTML for chat thread memory to preserve key structure without exceeding context limits
 * @param {string} html
 * @returns {string}
 */
export function compactAssistantHtml(html) {
  if (!html || html.length <= 12000) {
    return html.startsWith("```html") ? html : `\`\`\`html\n${html}\n\`\`\``;
  }

  // Extract critical structure: head, style, header/nav, media, links, footer
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? `<head>${headMatch[1]}</head>` : "";

  const headerMatch = html.match(/<(header|nav)[^>]*>([\s\S]*?)<\/\1>/i);
  const headerContent = headerMatch ? headerMatch[0] : "";

  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  const footerContent = footerMatch ? footerMatch[0] : "";

  // Extract key headings, links, media
  const keyHeadings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .slice(0, 6)
    .map((m) => m[0])
    .join("\n");

  const keyLinks = [...html.matchAll(/<a\s+[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
    .slice(0, 10)
    .map((m) => m[0])
    .join("\n");

  const keyMedia = [...html.matchAll(/<(img|video|audio)\s+[^>]*>/gi)]
    .slice(0, 8)
    .map((m) => m[0])
    .join("\n");

  const compacted = `<!DOCTYPE html>
<html>
${headContent}
<body>
  ${headerContent}
  <main>
    <!-- Key established page landmarks -->
    ${keyHeadings}
    ${keyMedia}
    ${keyLinks}
  </main>
  ${footerContent}
</body>
</html>`;

  return `\`\`\`html\n${compacted}\n\`\`\``;
}

/**
 * Retrieve prior navigation chat messages for a page URL
 * @param {string} pageUrl
 * @returns {Array<{ role: "user"|"assistant", content: string }>}
 */
export function getNavigationThread(pageUrl) {
  const domain = normalizeDomain(pageUrl);
  if (domain && navigationThreads.has(domain)) {
    return [...navigationThreads.get(domain)];
  }

  // Cross-domain fallback: if navigating from another site (e.g. search engine),
  // inherit the most recent 1-2 turns so destination page knows the origin context
  if (globalRecentThread.length > 0) {
    return globalRecentThread.slice(-2);
  }

  return [];
}

/**
 * Append an immutable user + assistant turn to the navigation thread
 * @param {string} pageUrl
 * @param {string} userPrompt
 * @param {string} assistantHtml
 */
export function appendNavigationTurn(pageUrl, userPrompt, assistantHtml) {
  if (!pageUrl || !userPrompt || !assistantHtml) return;

  const domain = normalizeDomain(pageUrl);
  const assistantContent = compactAssistantHtml(assistantHtml);

  const turn = [
    { role: "user", content: userPrompt },
    { role: "assistant", content: assistantContent },
  ];

  if (domain) {
    if (!navigationThreads.has(domain)) {
      navigationThreads.set(domain, []);
    }
    const thread = navigationThreads.get(domain);
    thread.push(...turn);

    // Slide window if exceeding MAX_THREAD_TURNS
    while (thread.length > MAX_THREAD_TURNS * 2) {
      thread.splice(0, 2);
    }
  }

  globalRecentThread.push(...turn);
  while (globalRecentThread.length > MAX_THREAD_TURNS * 2) {
    globalRecentThread.splice(0, 2);
  }
}

const domainStates = new Map();

const TRACKED_STATE_KEYS = new Set([
  "q",
  "query",
  "search",
  "user",
  "username",
  "email",
  "cart",
  "item",
  "product",
  "qty",
  "plan",
  "tier",
  "theme",
  "lang",
  "sort",
  "filter",
  "category",
  "step",
  "tab",
  "logged_in",
  "auth",
  "action",
]);

/**
 * Format domain state map into a readable string
 */
function formatDomainState(stateMap) {
  if (!stateMap || stateMap.size === 0) {
    return "None established";
  }
  return [...stateMap.entries()]
    .map(([k, v]) => `${k}="${v}"`)
    .join(", ");
}

/**
 * Ingest URL query params and POST data into domain session state
 * @param {string} pageUrl
 * @param {string} [postData]
 * @returns {string} Formatted active domain state
 */
export function updateAndGetDomainState(pageUrl, postData = "") {
  const domain = normalizeDomain(pageUrl);
  if (!domain) return "None established";

  if (!domainStates.has(domain)) {
    domainStates.set(domain, new Map());
  }
  const state = domainStates.get(domain);

  // 1. Ingest query parameters
  try {
    const parsed = new URL(pageUrl);
    for (const [k, v] of parsed.searchParams.entries()) {
      const lowerKey = k.toLowerCase();
      if (TRACKED_STATE_KEYS.has(lowerKey) || lowerKey.startsWith("filter_") || lowerKey.startsWith("search_")) {
        state.set(lowerKey, v.slice(0, 100));
      }
    }
  } catch {}

  // 2. Ingest POST data
  if (postData && typeof postData === "string" && postData !== "None") {
    let hasUserOrEmail = false;
    let hasPassword = false;

    // Try URLSearchParams
    try {
      const searchParams = new URLSearchParams(postData);
      for (const [k, v] of searchParams.entries()) {
        const lowerKey = k.toLowerCase();
        if (lowerKey.includes("password") || lowerKey === "pass" || lowerKey === "pwd") {
          hasPassword = true;
          state.set(lowerKey, "********");
        } else {
          if (lowerKey.includes("user") || lowerKey.includes("email") || lowerKey === "login") {
            hasUserOrEmail = true;
          }
          state.set(lowerKey, v.slice(0, 100));
        }
      }
    } catch {}

    // Try JSON
    if (postData.trim().startsWith("{")) {
      try {
        const json = JSON.parse(postData);
        for (const [k, v] of Object.entries(json)) {
          const lowerKey = k.toLowerCase();
          if (lowerKey.includes("password") || lowerKey === "pass" || lowerKey === "pwd") {
            hasPassword = true;
            state.set(lowerKey, "********");
          } else {
            if (lowerKey.includes("user") || lowerKey.includes("email") || lowerKey === "login") {
              hasUserOrEmail = true;
            }
            state.set(lowerKey, String(v).slice(0, 100));
          }
        }
      } catch {}
    }

    if (hasUserOrEmail && hasPassword) {
      state.set("authenticated", "true");
    }
  }

  // Keep state bounded to 15 entries
  while (state.size > 15) {
    const oldestKey = state.keys().next().value;
    state.delete(oldestKey);
  }

  return formatDomainState(state);
}

/**
 * Get active domain session state without mutation
 * @param {string} pageUrl
 * @returns {string}
 */
export function getDomainState(pageUrl) {
  const domain = normalizeDomain(pageUrl);
  if (!domain || !domainStates.has(domain)) {
    return "None established";
  }
  return formatDomainState(domainStates.get(domain));
}

/**
 * Get established CSS color variables for a domain or fallback origin
 * @param {string} urlStr
 * @param {string} [fallbackOriginUrl]
 * @returns {string}
 */
export function getDomainColorPalette(urlStr, fallbackOriginUrl) {
  let domain = normalizeDomain(urlStr);
  let profile = domain ? siteProfiles.get(domain) : null;

  if ((!profile || !profile.cssVars?.length) && fallbackOriginUrl) {
    const fallbackDomain = normalizeDomain(fallbackOriginUrl);
    if (fallbackDomain && siteProfiles.has(fallbackDomain)) {
      profile = siteProfiles.get(fallbackDomain);
    }
  }

  // Fallback to most recent siteProfile if available
  if (!profile || !profile.cssVars?.length) {
    for (const p of siteProfiles.values()) {
      if (p.cssVars && p.cssVars.length > 0) {
        profile = p;
        break;
      }
    }
  }

  if (profile && profile.cssVars && profile.cssVars.length > 0) {
    return profile.cssVars.slice(0, 6).join(", ");
  }

  return "None established";
}

/**
 * Clear all stored site profiles, link contexts, and navigation threads (called on cache flush)
 */
export function clearSiteMemory() {
  siteProfiles.clear();
  pendingLinkContexts.clear();
  navigationThreads.clear();
  domainStates.clear();
  globalRecentThread = [];
  lastClickedContext = null;
}
