/**
 * Fauxmium Documentation & Synthetic Browser Lab Simulator
 * Pure vanilla JavaScript with native Web Audio API synthesis & 60fps procedural video canvas
 */

document.addEventListener("DOMContentLoaded", () => {
  // =========================================================================
  // 1. Theme Toggle
  // =========================================================================
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const htmlRoot = document.documentElement;

  function initTheme() {
    const saved = localStorage.getItem("fauxmium-theme");
    if (saved) {
      htmlRoot.setAttribute("data-theme", saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      htmlRoot.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
    updateThemeBtnText();
  }

  function updateThemeBtnText() {
    const isDark = htmlRoot.getAttribute("data-theme") === "dark";
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = isDark ? "☀️ Light" : "🌙 Dark";
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const current = htmlRoot.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      htmlRoot.setAttribute("data-theme", next);
      localStorage.setItem("fauxmium-theme", next);
      updateThemeBtnText();
    });
  }

  initTheme();

  // =========================================================================
  // 2. Notification Toast
  // =========================================================================
  const toastEl = document.getElementById("toast");
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => {
      toastEl.classList.remove("show");
    }, 2600);
  }

  // =========================================================================
  // 3. Web Audio Synthesizer (Zero-dependency procedural sound audition)
  // =========================================================================
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playProceduralSound(type = "bell") {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "stream") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // =========================================================================
  // 4. Browser State, History Stack & Datasets
  // =========================================================================
  const omniboxInput = document.getElementById("sim-omnibox");
  const lensSelect = document.getElementById("sim-lens-select");
  const viewportEl = document.getElementById("sim-viewport");
  const progressBar = document.getElementById("sim-progress-bar");
  const statusPill = document.getElementById("sim-status-pill");
  const pillText = document.getElementById("sim-pill-text");
  const backBtn = document.getElementById("sim-back-btn");
  const fwdBtn = document.getElementById("sim-fwd-btn");
  const reloadBtn = document.getElementById("sim-reload-btn");
  const statusText = document.getElementById("sim-status-text");
  const cachePill = document.getElementById("sim-cache-pill");

  // Coherence drawer
  const coherenceDrawer = document.getElementById("coherence-drawer");
  const drawerCloseBtn = document.getElementById("drawer-close-btn");
  const drawerContextPre = document.getElementById("drawer-data-context");
  const drawerTokensPre = document.getElementById("drawer-css-tokens");
  const drawerTurnPre = document.getElementById("drawer-chat-turn");
  const inspectToggleBtn = document.getElementById("sim-inspect-toggle");

  // Extension popup replica
  const extensionPopupSim = document.getElementById("extension-popup-sim");
  const extToggleBtn = document.getElementById("sim-ext-toggle");
  const extTotalBadge = document.getElementById("sim-ext-total");
  const extLensSelect = document.getElementById("sim-ext-lens-select");
  const extToggleImages = document.getElementById("sim-toggle-images");
  const extToggleVideos = document.getElementById("sim-toggle-videos");
  const extToggleAudio = document.getElementById("sim-toggle-audio");
  const extSpendText = document.getElementById("sim-spend-text");
  const extSpendImage = document.getElementById("sim-spend-image");
  const extSpendVideo = document.getElementById("sim-spend-video");
  const extSpendAudio = document.getElementById("sim-spend-audio");
  const extRequestsList = document.getElementById("sim-requests-list");
  const extReqCount = document.getElementById("sim-req-count");
  const extBtnReload = document.getElementById("sim-ext-btn-reload");
  const extBtnClear = document.getElementById("sim-ext-btn-clear");
  const extBtnReset = document.getElementById("sim-ext-btn-reset");

  // BYOK Live AI
  const byokBtn = document.getElementById("sim-byok-btn");
  const byokModal = document.getElementById("byok-modal");
  const byokCloseBtn = document.getElementById("byok-close-btn");
  const byokKeyInput = document.getElementById("byok-key-input");
  const byokSaveBtn = document.getElementById("byok-save-btn");
  const byokClearBtn = document.getElementById("byok-clear-btn");
  const byokStatus = document.getElementById("byok-status");

  // Route presets & audition
  const auditionAudioBtn = document.getElementById("sim-audition-btn");
  const routeBtns = document.querySelectorAll(".route-btn");

  let activeRoute = "https://news.ycombinator.com";
  let activeLens = "modern";
  const historyStack = [];
  let historyIndex = -1;

  let byokKey = sessionStorage.getItem("fauxmium_gemini_api_key") || "";
  let isLiveAIMode = !!byokKey;

  const mediaSettings = {
    images: true,
    videos: true,
    audio: true,
  };

  const spendMetrics = {
    text: 0.0032,
    images: 0.0052,
    videos: 0.0,
    audio: 0.0,
  };

  const recentRequests = [
    { type: "HTML", url: "https://news.ycombinator.com", cost: "$0.0006", time: "10:14:02", cached: true },
    { type: "IMG", url: "/img/icon.svg", cost: "$0.0000", time: "10:14:02", cached: false },
    { type: "AUD", url: "/audio/synth.wav", cost: "$0.0000", time: "10:14:03", cached: false },
  ];

  // Upvote state for Hacker News stories
  const hnUpvotes = {};
  // Added comments per story ID
  const hnUserComments = {};

  // YouTube state
  let ytAnimId = null;
  let ytIsPlaying = true;
  let ytCurrentTime = 18;
  const ytDuration = 225;
  let ytIsSubscribed = false;
  let ytLikeCount = 1240;
  let ytHasLiked = false;
  const ytUserComments = {};

  // Store Cart state
  const cartState = {
    items: [
      { id: "cart-1", title: "Fauxmium Neural Deck (Developer Edition)", price: 120.0, qty: 1 },
      { id: "cart-2", title: "Synthetic Browser Lab T-Shirt", price: 28.0, qty: 2 },
    ],
    domainState: 'authenticated="true", user="alex", cart_items="3"',
  };

  // Required dataset export for tests and synthetic generation
  const SIMULATED_DATA = {
    "https://news.ycombinator.com": {
      title: "Hacker News (Synthetic Edition)",
      domain: "news.ycombinator.com",
      brand: "Hacker News",
      cssVars: "--brand-primary: #ff6600, --brand-bg: #f6f6ef, --font-family: Verdana",
      items: [
        {
          id: "hn-1",
          title: "Show HN: Fauxmium — An Infinite AI-Synthesized Web Browser",
          points: 428,
          author: "pkinlan",
          time: "4 hours ago",
          commentsCount: 182,
          domain: "github.com/paulkinlan",
          desc: "We built an engine that synthesizes HTML, images, and audio on the fly as you browse.",
          context: "Discussion of browser request interception, prompt prefix caching, and Veo video generation.",
          target: "https://news.ycombinator.com/item?id=391024",
        },
        {
          id: "hn-2",
          title: "Prompt Prefix Caching: How to achieve 75% LLM cost reduction",
          points: 312,
          author: "cache_dev",
          time: "6 hours ago",
          commentsCount: 94,
          domain: "arxiv.org",
          desc: "Structuring invariant system instructions (>1,024 tokens) with 64px viewport tiering.",
          context: "Technical deep dive into Anthropic, OpenAI, and Gemini prompt caching internals.",
          target: "https://news.ycombinator.com/item?id=391045",
        },
        {
          id: "hn-3",
          title: "Procedural 16-Bit PCM WAV Audio Synthesis in Zero-Dependency Node.js",
          points: 189,
          author: "wav_synth",
          time: "8 hours ago",
          commentsCount: 45,
          domain: "web.dev",
          desc: "Generating crisp chiptunes, bell chimes, and ambient drones without external libraries.",
          context: "Audio programming tutorial: RIFF headers, square waves, and formant speech modeling.",
          target: "https://news.ycombinator.com/item?id=391089",
        },
        {
          id: "hn-4",
          title: "Veo 3.1 Fast: Sub-Second Video Clip Synthesis & Byte-Range Seeking",
          points: 274,
          author: "deepmind_fan",
          time: "9 hours ago",
          commentsCount: 68,
          domain: "deepmind.google",
          desc: "Testing HTTP 206 partial chunk streaming with companion poster frame visual seeding.",
          context: "Evaluation of video token throughput and camera motion prompt directives.",
          target: "https://news.ycombinator.com/item?id=391102",
        },
        {
          id: "hn-5",
          title: "Overcoming LLM Amnesia with Design DNA and Click Intent",
          points: 215,
          author: "agentic_coder",
          time: "11 hours ago",
          commentsCount: 52,
          domain: "paul.kinlan.me",
          desc: "How capturing card snippets and CSS variables makes AI-generated sites feel coherent.",
          context: "Architecture breakdown of siteMemory.js, __fauxmiumCaptureClick, and domainState.",
          target: "https://news.ycombinator.com/item?id=391134",
        },
        {
          id: "hn-6",
          title: "Browsing Lenses: Aesthetic Time Travel on the Hypertext Web",
          points: 156,
          author: "retro_future",
          time: "13 hours ago",
          commentsCount: 39,
          domain: "fauxmium.dev",
          desc: "Morphing modern web pages into 90s Geocities, Cyberpunk Net, and 1940s Broadsheets.",
          context: "Exploration of temporal styling filters and era-authentic prompt decoration.",
          target: "https://news.ycombinator.com/item?id=391156",
        },
      ],
    },
    "https://youtube.com/watch?v=ai-web": {
      title: "YouTube — Synthetic Video Player",
      domain: "youtube.com",
      brand: "YouTube",
      cssVars: "--brand-primary: #ff0000, --brand-bg: #0f0f0f, --font-family: Roboto",
      video: {
        id: "ai-web",
        title: "Building an Infinite AI Browser Engine with Multi-Modal Synthesis",
        author: "Paul Kinlan — 184K views • 2 days ago",
        desc: "Watch our autonomous system synthesize continuous video streams with HTTP 206 range seeking, prompt caching, and zero-cost procedural audio.",
        camera: "Orbit 360°",
        poster: "https://example.com/img/poster.jpg?description=retro+futuristic+browser+cockpit&width=1280&height=720&role=hero",
        context: "Video playback: Demonstrates Veo 3.1 video streaming and companion poster seeding.",
        target: "https://youtube.com/watch?v=ai-web#comments",
      },
      items: [
        {
          id: "yt-rec-1",
          title: "Deep Dive into Byte-Range Streaming (HTTP 206) in Node.js",
          points: "Tech Talks • 42K views",
          desc: "How browsers request partial media chunks for smooth video seeking.",
          context: "Video tutorial on HTTP Range header parsing and stream slicing.",
          target: "https://youtube.com/watch?v=http-range-206",
        },
        {
          id: "yt-rec-2",
          title: "Browsing Lenses: Experiencing the Web in Cyberpunk and 90s Aesthetics",
          points: "Creative Coding • 95K views",
          desc: "Aesthetic time-travel transformations across HTML and audio.",
          context: "Design breakdown of Fauxmium era filters and prompt directives.",
          target: "https://youtube.com/watch?v=lenses-demo",
        },
        {
          id: "yt-rec-3",
          title: "Veo 3.1 Fast Architecture & Cinematography Prompts",
          points: "AI Cinema Lab • 61K views",
          desc: "Guiding camera motion: dolly zooms, crane tilts, and seeded poster continuity.",
          context: "Cinematography prompt engineering with Veo models.",
          target: "https://youtube.com/watch?v=veo-3-cinematography",
        },
        {
          id: "yt-rec-4",
          title: "Zero-Dependency 16-Bit WAV Audio Synthesis",
          points: "DSP Hacks • 28K views",
          desc: "Writing raw RIFF chunk headers and PCM buffers with Math.sin and ADSR envelopes.",
          context: "Audio generation in Node.js without ffmpeg or external binaries.",
          target: "https://youtube.com/watch?v=audio-synth-node",
        },
      ],
    },
    "https://paul.kinlan.me": {
      title: "Paul Kinlan — Web Log & Essays",
      domain: "paul.kinlan.me",
      brand: "Paul Kinlan",
      cssVars: "--brand-primary: #2563eb, --brand-bg: #ffffff, --font-family: Inter",
      items: [
        {
          id: "pk-1",
          title: "Why The Web Needs Generative Proofs of Concept",
          points: "Essay • 8 min read • Published Oct 2026",
          desc: "Exploring the boundary between static documents and autonomous generative navigation.",
          context: "Philosophical and engineering reflection on infinite hypermedia and agentic browsing.",
          target: "https://paul.kinlan.me/essays/generative-web-proofs",
        },
        {
          id: "pk-2",
          title: "Overcoming LLM Amnesia with Design DNA and Click Intent",
          points: "Architecture • 12 min read",
          desc: "How capturing card snippets and CSS variables makes AI-generated sites feel completely coherent.",
          context: "Architecture breakdown of siteMemory.js, __fauxmiumCaptureClick, and domainState.",
          target: "https://paul.kinlan.me/essays/site-memory-coherence",
        },
        {
          id: "pk-3",
          title: "Prompt Prefix Caching: Sub-Second 75% Cost Reduction",
          points: "Performance • 10 min read",
          desc: "Why invariant prompt prefixing above 1,024 tokens changes the economics of live AI rendering.",
          context: "Performance benchmarks comparing uncached vs cached multi-modal turn latencies.",
          target: "https://paul.kinlan.me/essays/prompt-prefix-caching",
        },
      ],
    },
    "https://shop.example.com/cart": {
      title: "Synthetic Storefront & Cart",
      domain: "shop.example.com",
      brand: "Hyperloop Merch Co.",
      cssVars: "--brand-primary: #10b981, --brand-bg: #fafafa, --font-family: Plus Jakarta Sans",
      stateInfo: 'authenticated="true", user="alex", cart_items="3", total="$176.00"',
      items: [
        {
          id: "cart-1",
          title: "Fauxmium Neural Deck (Developer Edition)",
          points: "Qty: 1 • $120.00",
          desc: "Hardware token terminal with dedicated Browsing Lens dial.",
          context: "E-Commerce checkout item: Neural Deck hardware accelerator.",
          target: "https://shop.example.com/checkout?step=shipping",
        },
        {
          id: "cart-2",
          title: "Synthetic Browser Lab T-Shirt (Organic Cotton)",
          points: "Qty: 2 • $28.00",
          desc: "Featuring the vector portal prism logo.",
          context: "E-Commerce checkout item: Fauxmium prism graphic apparel.",
          target: "https://shop.example.com/checkout?step=shipping",
        },
      ],
    },
  };

  // =========================================================================
  // 5. Coherence Inspector Drawer
  // =========================================================================
  function openCoherenceDrawer(cardTitle, targetUrl, contextStr, siteData) {
    if (!coherenceDrawer) return;
    const domain = siteData?.domain || (new URL(targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`)).hostname;
    const cssVars = siteData?.cssVars || "--brand-primary: #2563eb, --font-family: Inter";
    const brand = siteData?.brand || domain;

    drawerContextPre.textContent = `[LINK INTENT (a → b)]\nTarget URL: ${targetUrl}\nClicked Item: "${cardTitle || "Navigation Link"}"\nExpected Intent (data-context): ${contextStr || "Direct navigation via user input"}`;
    drawerTokensPre.textContent = `[SITE MEMORY & DESIGN DNA]\nDomain: "${domain}"\nBrand Name: "${brand}"\nCaptured Tokens:\n${cssVars}\nPersistent Navbar: Preserved across page turns`;
    drawerTurnPre.textContent = `[MULTI-TURN PROMPT PAYLOAD (prompts/html.txt)]\nActive Lens: [${activeLens}]\nSystem Prefix: Invariant Fauxmium Instructions (>1,024 tokens) [CACHE HIT: 75% OFF]\nUser Context:\n  Route: ${targetUrl}\n  Domain Session: authenticated="true", activeLens="${activeLens}"\n  Link Intent: "${cardTitle || "URL Navigation"}"`;

    coherenceDrawer.classList.add("open");
  }

  // Make globally available if needed
  window.openCoherenceDrawer = openCoherenceDrawer;

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener("click", () => {
      coherenceDrawer.classList.remove("open");
    });
  }

  if (inspectToggleBtn) {
    inspectToggleBtn.addEventListener("click", () => {
      if (coherenceDrawer.classList.contains("open")) {
        coherenceDrawer.classList.remove("open");
      } else {
        const data = SIMULATED_DATA[activeRoute] || { domain: new URL(activeRoute).hostname, brand: "Fauxmium Web", cssVars: "--brand-primary: #3b82f6" };
        openCoherenceDrawer("Current Page State", activeRoute, "Active URL and Design DNA Inspection", data);
      }
    });
  }

  // =========================================================================
  // 6. Navigation Engine & History Stack
  // =========================================================================
  function navigateTo(url, { isNavigatingHistory = false, linkContext = null, triggerLensChange = false } = {}) {
    // Normalize URL
    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      if (targetUrl.includes(".") && !targetUrl.includes(" ")) {
        targetUrl = "https://" + targetUrl;
      } else {
        // Query search
        targetUrl = `https://search.fauxmium.internal/search?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    if (!isNavigatingHistory) {
      // If we branched from a past index, slice future
      if (historyIndex >= 0 && historyIndex < historyStack.length - 1) {
        historyStack.splice(historyIndex + 1);
      }
      historyStack.push({ url: targetUrl, lens: activeLens, linkContext });
      historyIndex = historyStack.length - 1;
    }

    activeRoute = targetUrl;
    if (omniboxInput) omniboxInput.value = targetUrl;

    // Update Back & Forward Buttons
    if (backBtn) backBtn.disabled = historyIndex <= 0;
    if (fwdBtn) fwdBtn.disabled = historyIndex >= historyStack.length - 1;

    // Update Presets Active state
    routeBtns.forEach(btn => {
      const route = btn.getAttribute("data-route");
      btn.classList.toggle("active", route === targetUrl);
    });

    // Trigger Streaming Progress Bar & Status Pill
    showStreamingAnimation(targetUrl, isNavigatingHistory);

    // Update Coherence Drawer preview data
    const matchedData = SIMULATED_DATA[targetUrl] || { domain: new URL(targetUrl).hostname, brand: "Fauxmium Web" };
    if (linkContext) {
      openCoherenceDrawer(linkContext.title || "Selected Navigation Target", targetUrl, linkContext.context || "User selected hyperlink", matchedData);
    }

    // Render Viewport
    if (isLiveAIMode && byokKey) {
      renderLiveGeminiView(targetUrl);
    } else {
      renderSyntheticView(targetUrl, isNavigatingHistory);
    }
  }

  function showStreamingAnimation(url, isCacheHit) {
    if (progressBar) {
      progressBar.classList.remove("active");
      void progressBar.offsetWidth; // trigger reflow
      progressBar.classList.add("active");
      setTimeout(() => {
        progressBar.classList.remove("active");
      }, 400);
    }

    if (statusPill && pillText) {
      statusPill.classList.remove("hidden");
      if (isLiveAIMode && byokKey) {
        pillText.innerHTML = `⚡ Streaming live from <code>gemini-2.5-flash</code> (BYOK Active • SSE Chunking)...`;
      } else if (isCacheHit) {
        pillText.innerHTML = `⚡ Served from <code>Fauxmium Cache</code> (Prompt Cache: 100% saved • $0.00)...`;
      } else {
        pillText.innerHTML = `⚡ Streaming from <code>gemini-3.8-flash</code> (Prompt Cache Hit: 75% saved • 1,840 cached tokens)...`;
      }
      playProceduralSound("stream");

      setTimeout(() => {
        statusPill.classList.add("hidden");
      }, 450);
    }

    if (statusText) {
      const ms = Math.floor(Math.random() * 80) + 260;
      statusText.textContent = `HTTP 200 OK • 1,420 tokens • ${ms}ms`;
    }
    if (cachePill) {
      cachePill.textContent = isCacheHit ? "⚡ Memory Cache Hit: $0.00" : "⚡ Prompt Cache: 75% Saved";
    }
  }

  // Back, Forward, Reload
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (historyIndex > 0) {
        historyIndex--;
        const item = historyStack[historyIndex];
        navigateTo(item.url, { isNavigatingHistory: true, linkContext: item.linkContext });
      }
    });
  }

  if (fwdBtn) {
    fwdBtn.addEventListener("click", () => {
      if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const item = historyStack[historyIndex];
        navigateTo(item.url, { isNavigatingHistory: true, linkContext: item.linkContext });
      }
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      showToast("Regenerating page with fresh prompt context...");
      navigateTo(activeRoute, { isNavigatingHistory: false });
    });
  }

  if (omniboxInput) {
    omniboxInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = omniboxInput.value.trim();
        if (val) {
          navigateTo(val);
        }
      }
    });
  }

  routeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const route = btn.getAttribute("data-route");
      navigateTo(route);
    });
  });

  // =========================================================================
  // 7. Browsing Lens Era Injections
  // =========================================================================
  function getLensChrome(lens) {
    if (lens === "retro-90s") {
      return `
        <div class="lens-banner-retro">
          <marquee class="lens-marquee" scrollamount="6">
            *** WELCOME TO THE INFORMATION SUPERHIGHWAY — NETSCAPE COMMUNICATOR 3.0 ENHANCED — BEST VIEWED AT 800x600 IN 256 COLORS ***
          </marquee>
        </div>
      `;
    }
    if (lens === "y2k") {
      return `
        <div class="lens-banner-y2k">
          <span>FRUTIGER AERO // WEB 2.0 PORTAL // SPEED: 100MBPS</span>
          <span style="opacity:0.8;">[AQUA GLOSS INTERFACE]</span>
        </div>
      `;
    }
    if (lens === "cyberpunk-2077") {
      return `
        <div class="lens-banner-cyber">
          <span>// NET_ARCH: NC-2077 // ENCRYPTION: AES-4096 // SUBNET: ACTIVE // ICE: NORMAL</span>
          <span>HEX: 0xFA4E70E</span>
        </div>
      `;
    }
    if (lens === "brutalist") {
      return `
        <div class="lens-banner-brut">
          /// NEO-BRUTALIST WEB ARCHIVE — RAW DATA MODE — NO GLOW — 4PX SOLID BLACK ///
        </div>
      `;
    }
    if (lens === "vaporwave") {
      return `
        <div class="lens-banner-vapor">
          <span>ＡＥＳＴＨＥＴＩＣ　ＷＥＢ　９５ // ＦＡＵＸＭＩＵＭ</span>
          <span>フローラル・ショッペ // 仮想空間</span>
        </div>
      `;
    }
    if (lens === "noir-1940s") {
      return `
        <div class="lens-banner-noir">
          <h3>THE METROPOLIS CHRONICLE — LATE NIGHT EDITION</h3>
          <div style="font-size:0.75rem; letter-spacing:0.1em; opacity:0.8;">OCTOBER 12, 1947 • PRICE TWO CENTS • WEATHER: HEAVY RAIN</div>
        </div>
      `;
    }
    if (lens === "arcade-8bit") {
      return `
        <div class="lens-banner-arcade">
          <span>1UP: 042800</span>
          <span>HI-SCORE: 099950</span>
          <span>STAGE 01: HYPERTEXT CITY</span>
        </div>
      `;
    }
    return "";
  }

  function getLensFooter(lens) {
    if (lens === "retro-90s") {
      return `
        <div class="lens-footer-retro">
          <span>Visitor:</span>
          <span class="led-counter">004821</span>
          <span>•</span>
          <a href="#guestbook" onclick="alert('Guestbook entry recorded on Geocities server!'); return false;">[Sign My Guestbook]</a>
          <span>•</span>
          <span>Optimized for Netscape Navigator</span>
        </div>
      `;
    }
    if (lens === "arcade-8bit") {
      return `
        <div style="text-align:center; padding:1rem; font-family:var(--font-mono); font-size:0.8rem; color:#ff0055;">
          <span style="animation: pillPulse 0.8s infinite alternate;">INSERT COIN TO CONTINUE BROWSING</span>
        </div>
      `;
    }
    return "";
  }

  function getLensBoxClass(lens) {
    if (lens === "retro-90s") return "r-box";
    if (lens === "y2k") return "y2k-box";
    if (lens === "cyberpunk-2077") return "cp-box";
    if (lens === "brutalist") return "brut-box";
    if (lens === "vaporwave") return "vapor-box";
    if (lens === "noir-1940s") return "noir-box";
    if (lens === "arcade-8bit") return "arc-box";
    return "";
  }

  // =========================================================================
  // 8. Procedural Page Synthesizers
  // =========================================================================

  // A. Hacker News Generator
  function renderHackerNews(url) {
    const isItemView = url.includes("/item?id=");
    const boxClass = getLensBoxClass(activeLens);

    if (isItemView) {
      const params = new URLSearchParams(url.split("?")[1] || "");
      const itemId = params.get("id") || "391024";
      const hnList = SIMULATED_DATA["https://news.ycombinator.com"].items;
      const story = hnList.find(s => s.id.includes(itemId) || s.target.includes(itemId)) || hnList[0];

      const userCommentsForStory = hnUserComments[story.id] || [];

      return `
        <div class="hn-container ${boxClass}">
          <div class="hn-header">
            <span class="hn-logo-box">Y</span>
            <span class="hn-brand"><a href="https://news.ycombinator.com" class="sim-nav-link" data-title="Hacker News">Hacker News</a></span>
            <span class="hn-nav-links">
              <a href="https://news.ycombinator.com" class="sim-nav-link" data-title="Hacker News">front</a> |
              <span>comments</span> |
              <span>ask</span> |
              <span>show</span> |
              <span>jobs</span>
            </span>
          </div>

          <div style="padding: 1rem 1rem 0.5rem;">
            <div style="font-size: 1.15rem; font-weight: bold; margin-bottom: 0.35rem;">
              <a href="${story.domain ? 'https://' + story.domain : '#'}" class="hn-story-title" target="_blank">${story.title}</a>
              <span class="hn-domain">(${story.domain || 'fauxmium.dev'})</span>
            </div>
            <div class="hn-subtext">
              ${story.points + (hnUpvotes[story.id] ? 1 : 0)} points by ${story.author || 'pkinlan'} ${story.time || '4 hours ago'} | ${story.commentsCount + userCommentsForStory.length} comments
            </div>
            <p style="font-size: 0.9rem; margin-top: 0.5rem; line-height: 1.45; color: #444;">
              ${story.desc}
            </p>

            <!-- Add Comment Form -->
            <div class="hn-add-comment-box">
              <textarea id="hn-comment-textarea" placeholder="What are your thoughts on this AI synthesis implementation?"></textarea>
              <button id="hn-comment-submit-btn" data-story-id="${story.id}">Add Comment</button>
            </div>
          </div>

          <!-- Comment Tree -->
          <div class="hn-comment-tree">
            ${userCommentsForStory.map(c => `
              <div class="hn-comment-item" style="border-left: 2px solid #ff6600; padding-left: 0.75rem; margin-bottom: 0.75rem;">
                <div class="hn-comment-header"><strong>${c.author}</strong> ${c.time}</div>
                <div class="hn-comment-text">${c.text}</div>
              </div>
            `).join("")}

            <div class="hn-comment-item">
              <div class="hn-comment-header"><strong>swyx</strong> 3 hours ago [–]</div>
              <div class="hn-comment-text">
                The prompt prefix caching saving 75% on Anthropic & Gemini is the real game-changer here. Usually, synthesizing an entire interactive web document blows past 2,000 input tokens. Keeping invariant instructions pinned at the top makes page turns feel snappy.
              </div>
            </div>

            <div class="hn-comment-item" style="margin-left: 1.5rem;">
              <div class="hn-comment-header"><strong>pkinlan</strong> (author) 2 hours ago [–]</div>
              <div class="hn-comment-text">
                Exactly. And by quantizing the window dimensions to 64px tiers, resizing the Chrome window doesn't bust the cache prefix.
              </div>
            </div>

            <div class="hn-comment-item">
              <div class="hn-comment-header"><strong>chromatic_dev</strong> 2 hours ago [–]</div>
              <div class="hn-comment-text">
                How does Fauxmium handle media seeking? If Veo generates MP4 files, can Chrome scrub through the timeline without re-downloading everything?
              </div>
            </div>

            <div class="hn-comment-item" style="margin-left: 1.5rem;">
              <div class="hn-comment-header"><strong>faux_lead</strong> 1 hour ago [–]</div>
              <div class="hn-comment-text">
                Yes! We implemented full HTTP 206 Partial Content byte-range slicing in <code>server/processVideo.js</code>. The browser sends <code>bytes=start-end</code> and the proxy streams the exact slice with <code>Content-Range</code> headers.
              </div>
            </div>
          </div>
          
          <div style="padding: 1rem; border-top: 1px solid #e0e0d8; font-size: 0.85rem;">
            <a href="https://news.ycombinator.com" class="sim-nav-link" data-title="Hacker News">← Back to front page</a>
          </div>
        </div>
      `;
    }

    // Front Page
    const items = SIMULATED_DATA["https://news.ycombinator.com"].items;
    return `
      <div class="hn-container ${boxClass}">
        <div class="hn-header">
          <span class="hn-logo-box">Y</span>
          <span class="hn-brand">Hacker News</span>
          <span class="hn-nav-links">
            <span>new</span> |
            <span>past</span> |
            <span>comments</span> |
            <span>ask</span> |
            <span>show</span> |
            <span>jobs</span> |
            <span>submit</span>
          </span>
        </div>

        <table class="hn-table">
          <tbody>
            ${items.map((item, idx) => {
              const voted = hnUpvotes[item.id];
              const score = item.points + (voted ? 1 : 0);
              const userCommentsCount = (hnUserComments[item.id] || []).length;
              const totalComments = item.commentsCount + userCommentsCount;

              return `
                <tr class="hn-row">
                  <td class="hn-rank">${idx + 1}.</td>
                  <td class="hn-vote">
                    <span class="hn-arrow ${voted ? 'voted' : ''}" data-story-id="${item.id}" title="Upvote">▲</span>
                  </td>
                  <td class="hn-title-cell">
                    <a href="${item.target}" class="hn-story-title sim-nav-link" data-title="${item.title}" data-context="${item.context}">${item.title}</a>
                    <span class="hn-domain">(${item.domain})</span>
                  </td>
                </tr>
                <tr>
                  <td></td>
                  <td></td>
                  <td class="hn-subtext">
                    ${score} points by ${item.author} ${item.time} |
                    <a href="${item.target}" class="sim-nav-link" data-title="${item.title}" data-context="${item.context}">
                      ${totalComments} comments
                    </a>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div style="padding: 1rem 0.5rem; font-size: 0.85rem;">
          <a href="https://news.ycombinator.com/page2" class="sim-nav-link" data-title="Hacker News Page 2">More...</a>
        </div>
      </div>
    `;
  }

  // B. YouTube Video Watch Page Generator
  function renderYouTube(url) {
    const data = SIMULATED_DATA["https://youtube.com/watch?v=ai-web"];
    const boxClass = getLensBoxClass(activeLens);
    const video = data.video;

    // Check if URL has query parameter for another video
    const params = new URLSearchParams(url.split("?")[1] || "");
    const videoParam = params.get("v") || "ai-web";

    let currentTitle = video.title;
    let currentCamera = video.camera;
    if (videoParam === "http-range-206") {
      currentTitle = "Deep Dive into Byte-Range Streaming (HTTP 206) in Node.js";
      currentCamera = "Static Telemetry";
    } else if (videoParam === "lenses-demo") {
      currentTitle = "Browsing Lenses: Experiencing the Web in Cyberpunk and 90s Aesthetics";
      currentCamera = "Morphing Lens";
    } else if (videoParam === "veo-3-cinematography") {
      currentTitle = "Veo 3.1 Fast Architecture & Cinematography Prompts";
      currentCamera = "Dolly Zoom In";
    }

    return `
      <div class="yt-watch-grid ${boxClass}">
        <!-- Left: Player & Video Info -->
        <div class="yt-left-col">
          <div class="yt-player-container">
            ${mediaSettings.videos ? `
              <canvas id="yt-canvas" width="640" height="360" class="yt-canvas"></canvas>
            ` : `
              <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:var(--font-mono);">
                <div style="font-size:2rem; margin-bottom:0.5rem;">[VIDEO GENERATION DISABLED]</div>
                <div style="font-size:0.8rem; opacity:0.8;">Enable video toggle in Companion Extension</div>
              </div>
            `}
            <div class="yt-controls-bar">
              <button id="yt-play-toggle" class="yt-btn-play" title="Play / Pause">${ytIsPlaying ? '❚❚' : '▶'}</button>
              <div class="yt-scrub-bar" id="yt-scrub-bar">
                <div class="yt-scrub-fill" style="width: ${(ytCurrentTime / ytDuration) * 100}%;"></div>
              </div>
              <span class="yt-timecode" id="yt-timecode">0:${ytCurrentTime < 10 ? '0' + ytCurrentTime : ytCurrentTime} / 3:45</span>
              <span class="yt-camera-badge">[Camera: ${currentCamera}]</span>
            </div>
          </div>

          <div class="yt-video-details">
            <h1 class="yt-video-title">${currentTitle}</h1>
            <div class="yt-author-row">
              <div class="yt-channel-info">
                <div class="yt-channel-avatar">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#3b82f6"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="#3b82f6"/></svg>
                </div>
                <div class="yt-channel-meta">
                  <div style="font-weight:700; font-size:0.95rem;">Paul Kinlan</div>
                  <div style="font-size:0.75rem; color:var(--text-dim);">142K subscribers</div>
                </div>
                <button id="yt-sub-btn" class="yt-btn-sub ${ytIsSubscribed ? 'subscribed' : ''}">
                  ${ytIsSubscribed ? 'Subscribed ✓' : 'Subscribe'}
                </button>
              </div>

              <div style="display:flex; gap:0.5rem;">
                <button id="yt-like-btn" class="yt-btn-like">
                  <span>👍</span> <span id="yt-like-counter">${ytLikeCount}</span>
                </button>
                <button class="yt-btn-like" onclick="alert('Share URL copied to clipboard: ${url}');">
                  <span>↗</span> Share
                </button>
              </div>
            </div>

            <div class="yt-desc-box">
              <div style="font-weight:700; margin-bottom:0.25rem;">184,291 views • Oct 12, 2026 • Veo 3.1 Fast Stream</div>
              <p>${video.desc}</p>
              <div style="margin-top:0.5rem; font-family:var(--font-mono); font-size:0.75rem; color:var(--text-dim);">
                HTTP 206 Partial Chunk Stream • Seed Poster: /img/poster.jpg?role=hero • Audio: Synth WAV 44.1kHz
              </div>
            </div>

            <!-- Comments -->
            <div style="margin-top:1.5rem;">
              <h3 style="font-size:1.05rem; margin-bottom:0.75rem;">Comments (42)</h3>
              <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                <input type="text" id="yt-comment-input" placeholder="Add a public comment..." style="flex:1; padding:0.4rem 0.75rem; border:1px solid var(--border); border-radius:6px; font-size:0.85rem;">
                <button id="yt-comment-btn" class="btn btn-secondary" style="font-size:0.8rem; padding:0.4rem 0.8rem;">Comment</button>
              </div>

              <div id="yt-comments-list">
                ${(ytUserComments[videoParam] || []).map(c => `
                  <div style="display:flex; gap:0.6rem; margin-bottom:0.75rem;">
                    <div style="width:28px; height:28px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700;">Y</div>
                    <div>
                      <div style="font-size:0.78rem; font-weight:600;">You <span style="font-weight:normal; color:var(--text-dim);">just now</span></div>
                      <div style="font-size:0.82rem; margin-top:0.2rem;">${c}</div>
                    </div>
                  </div>
                `).join("")}

                <div style="display:flex; gap:0.6rem; margin-bottom:0.75rem;">
                  <div style="width:28px; height:28px; border-radius:50%; background:#10b981; color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700;">A</div>
                  <div>
                    <div style="font-size:0.78rem; font-weight:600;">Alex Rivera <span style="font-weight:normal; color:var(--text-dim);">1 day ago</span></div>
                    <div style="font-size:0.82rem; margin-top:0.2rem;">The canvas procedural rendering running at 60fps matches what real Veo streaming clips look like! Super clean implementation.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Recommended Up-Next -->
        <div class="yt-right-col">
          <h4 style="font-size:0.95rem; margin-bottom:0.75rem;">Up Next</h4>
          ${data.items.map(item => `
            <div class="yt-upnext-item sim-nav-link" data-target="${item.target}" data-title="${item.title}" data-context="${item.context}">
              <div class="yt-upnext-thumb">
                <svg viewBox="0 0 120 68" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="g_${item.id}" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#1e293b"/>
                      <stop offset="100%" stop-color="#3b82f6"/>
                    </linearGradient>
                  </defs>
                  <rect width="120" height="68" fill="url(#g_${item.id})"/>
                  <polygon points="52,24 74,34 52,44" fill="#ffffff" opacity="0.9"/>
                </svg>
                <span class="yt-upnext-dur">3:42</span>
              </div>
              <div style="flex:1;">
                <div class="yt-upnext-title">${item.title}</div>
                <div class="yt-upnext-channel">${item.points}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // C. Paul Kinlan Developer Blog Generator
  function renderPaulKinlan(url) {
    const isEssay = url.includes("/essays/");
    const boxClass = getLensBoxClass(activeLens);

    if (isEssay) {
      let title = "Why The Web Needs Generative Proofs of Concept";
      let date = "Published October 12, 2026 • 8 min read";
      if (url.includes("site-memory-coherence")) {
        title = "Overcoming LLM Amnesia with Design DNA and Click Intent";
        date = "Published October 8, 2026 • 12 min read";
      } else if (url.includes("prompt-prefix-caching")) {
        title = "Prompt Prefix Caching: Sub-Second 75% Cost Reduction";
        date = "Published September 29, 2026 • 10 min read";
      }

      return `
        <div class="pk-article-full ${boxClass}">
          <div style="margin-bottom:1rem;">
            <a href="https://paul.kinlan.me" class="sim-nav-link" data-title="Paul Kinlan Blog">← Back to all essays</a>
          </div>
          <h1>${title}</h1>
          <div class="meta">${date} • Topics: Hypertext, Synthetic Browsers, System Design</div>
          <p>
            When we interact with the web today, we take for granted that every link represents a pre-compiled document. But what happens when an autonomous proxy server intercepts HTTP requests and synthesizes the destination in real time?
          </p>
          <div class="pk-callout" style="border-left: 3px solid var(--primary); background: var(--bg-subtle); padding: 0.85rem 1rem; border-radius: 4px; margin: 1rem 0;">
            <em>"The web is not just a filing cabinet of static pages; it is an interactive medium whose canvas can be hallucinated on demand while strictly honoring hyperlink intent."</em>
          </div>
          <p>
            In Fauxmium, we solved the classic amnesia problem where an LLM forgets what site you were just browsing. When you click an anchor link, the originating card snippet and brand palette are packaged into a structured context bundle.
          </p>
          <pre><code>// Link Intent Context Injection
const prompt = [
  invariantSystemInstructions,
  "Target Route: " + targetUrl,
  "Originating Clicked Snippet: " + clickedSnippet,
  "Site Memory CSS Variables: " + inheritedTokens
].join("\\n\\n");</code></pre>
          <p>
            This ensures that if you clicked an article about "Procedural WAV Synthesis", the generated destination doesn't pivot into generic recipes—it honors the continuous narrative.
          </p>
          <div style="margin-top:2rem; padding-top:1rem; border-top:1px solid var(--border);">
            <a href="https://paul.kinlan.me" class="sim-nav-link" data-title="Paul Kinlan Blog">← Back to all essays</a>
          </div>
        </div>
      `;
    }

    const items = SIMULATED_DATA["https://paul.kinlan.me"].items;
    return `
      <div class="pk-blog-wrap ${boxClass}">
        <!-- Blog Header with Stylized Portrait SVG -->
        <div class="pk-blog-header">
          <div class="pk-author-lockup">
            <svg class="pk-avatar-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="23" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/>
              <circle cx="24" cy="18" r="8" fill="#f8fafc"/>
              <path d="M12 38c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="#38bdf8"/>
              <circle cx="21" cy="17" r="1.5" fill="#0f172a"/>
              <circle cx="27" cy="17" r="1.5" fill="#0f172a"/>
              <path d="M22 22q2 1.5 4 0" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <div>
              <h2 style="font-size:1.35rem; font-weight:800; letter-spacing:-0.03em;">Paul Kinlan</h2>
              <div style="font-size:0.85rem; color:var(--text-muted);">Developer, Writer & Synthetic Web Explorer</div>
            </div>
          </div>
          <nav class="pk-nav">
            <a href="https://paul.kinlan.me" class="sim-nav-link" data-title="Essays" style="font-weight:700; color:var(--text);">Essays</a>
            <a href="https://paul.kinlan.me/notes" class="sim-nav-link" data-title="Notes">Notes</a>
            <a href="https://paul.kinlan.me/podcast" class="sim-nav-link" data-title="Podcast">Podcast</a>
            <a href="https://paul.kinlan.me/about" class="sim-nav-link" data-title="About">About</a>
          </nav>
        </div>

        <!-- Interactive Podcast / Ambient Synth Player -->
        <div class="pk-podcast-card">
          <button id="pk-podcast-play" class="pk-podcast-play-btn" title="Play Episode Preview">▶</button>
          <div class="pk-podcast-details">
            <div style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--primary); letter-spacing:0.05em;">Fauxmium Audio Feed • Episode 42</div>
            <div style="font-weight:700; font-size:0.95rem;">Synthesizing the Infinite Web with Zero-Cost PCM WAV</div>
          </div>
          <div class="pk-audio-bars" id="pk-audio-bars">
            <div class="pk-bar"></div>
            <div class="pk-bar"></div>
            <div class="pk-bar"></div>
            <div class="pk-bar"></div>
            <div class="pk-bar"></div>
          </div>
        </div>

        <!-- Essays Listing -->
        <div style="margin-top:1.5rem;">
          <h3 style="font-size:1.15rem; margin-bottom:1rem;">Selected Essays</h3>
          <div class="sim-grid">
            ${items.map(item => `
              <div class="sim-card sim-nav-link ${boxClass}" data-target="${item.target}" data-title="${item.title}" data-context="${item.context}">
                <h4>${item.title}</h4>
                <p>${item.desc}</p>
                <div class="sim-meta">
                  <span>${item.points}</span>
                  <span style="color:var(--primary); font-weight:700;">Read Essay ↗</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  // D. E-Commerce Store & Cart Generator
  function renderStore(url) {
    const isCartView = url.includes("/cart") || url.includes("/checkout");
    const boxClass = getLensBoxClass(activeLens);

    if (isCartView) {
      const subtotal = cartState.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
      return `
        <div class="shop-wrap ${boxClass}">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; border-bottom:1px solid var(--border); padding-bottom:1rem;">
            <h2>Hyperloop Merch Co. — Shopping Cart</h2>
            <a href="https://shop.example.com" class="sim-nav-link" data-title="Storefront">← Continue Shopping</a>
          </div>

          <table class="shop-cart-table">
            <thead>
              <tr>
                <th style="text-align:left;">Item</th>
                <th>Price</th>
                <th>Quantity</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${cartState.items.map(item => `
                <tr>
                  <td><strong>${item.title}</strong></td>
                  <td style="text-align:center;">$${item.price.toFixed(2)}</td>
                  <td style="text-align:center;">
                    <div class="shop-qty-ctrl" style="justify-content:center;">
                      <button class="shop-qty-btn cart-qty-minus" data-id="${item.id}">-</button>
                      <span style="font-weight:700; width:20px; text-align:center;">${item.qty}</span>
                      <button class="shop-qty-btn cart-qty-plus" data-id="${item.id}">+</button>
                    </div>
                  </td>
                  <td style="text-align:right; font-weight:700;">$${(item.price * item.qty).toFixed(2)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1.5rem;">
            <div style="font-family:var(--font-mono); font-size:0.8rem; background:var(--primary-subtle); color:var(--primary-text); padding:0.6rem 0.85rem; border-radius:6px;">
              [domainState]: ${cartState.domainState}
            </div>

            <div class="shop-checkout-box">
              <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800; margin-bottom:1rem;">
                <span>Total:</span>
                <span>$${subtotal.toFixed(2)}</span>
              </div>
              <div style="margin-bottom:0.75rem;">
                <label style="display:block; font-size:0.78rem; font-weight:600; margin-bottom:0.3rem;">Synthetic User Name</label>
                <input type="text" id="shop-username-input" value="alex" style="width:100%; padding:0.4rem; border:1px solid var(--border); border-radius:4px;">
              </div>
              <button id="shop-place-order-btn" class="btn btn-primary" style="width:100%;">
                Place Synthetic Order ($${subtotal.toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Storefront Home
    const products = [
      { id: "cart-1", title: "Fauxmium Neural Deck (Developer Edition)", price: 120.0, desc: "Dedicated Browsing Lens dial and real-time token monitor.", rating: "★★★★★ (48)" },
      { id: "cart-2", title: "Synthetic Browser Lab T-Shirt", price: 28.0, desc: "100% organic cotton featuring vector portal emblem.", rating: "★★★★☆ (120)" },
      { id: "cart-3", title: "Veo 3.1 Cinematography Focus Dial", price: 45.0, desc: "Tactile USB dial for orbit, dolly zoom, and pan angles.", rating: "★★★★★ (19)" },
      { id: "cart-4", title: "Browsing Lens Physical Filter Prism", price: 18.0, desc: "Optical glass prism demonstrating 8-world chromatic refraction.", rating: "★★★★☆ (85)" },
    ];

    const totalQty = cartState.items.reduce((sum, item) => sum + item.qty, 0);

    return `
      <div class="shop-wrap ${boxClass}">
        <div class="shop-hero">
          <div>
            <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--primary); letter-spacing:0.08em;">Official Hardware & Merch</span>
            <h2 style="font-size:1.75rem; margin-top:0.25rem;">Hyperloop Merch Co.</h2>
            <p style="font-size:0.9rem; margin-top:0.25rem;">Explore physical hardware accessories for the autonomous generative browser.</p>
          </div>
          <a href="https://shop.example.com/cart" class="btn btn-secondary sim-nav-link" data-title="Shopping Cart">
            🛒 Cart (${totalQty})
          </a>
        </div>

        <div class="shop-product-grid">
          ${products.map(p => `
            <div class="shop-card">
              <div class="shop-thumb">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <rect width="64" height="64" rx="8" fill="var(--primary-subtle)"/>
                  <polygon points="32,14 48,46 16,46" fill="var(--primary)" opacity="0.8"/>
                  <circle cx="32" cy="32" r="6" fill="#ffffff"/>
                </svg>
              </div>
              <h4 style="font-size:0.95rem; margin-bottom:0.25rem;">${p.title}</h4>
              <div style="font-size:0.75rem; color:#f59e0b; margin-bottom:0.4rem;">${p.rating}</div>
              <p style="font-size:0.8rem; margin-bottom:0.75rem; flex:1;">${p.desc}</p>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:auto;">
                <span style="font-weight:700; font-size:1.05rem;">$${p.price.toFixed(2)}</span>
                <button class="shop-btn-add add-to-cart-btn" data-id="${p.id}" data-title="${p.title}" data-price="${p.price}">
                  Add to Cart
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // E. Procedural Wikipedia & Generic URL Synthesizer
  function renderGenericProcedural(url) {
    const boxClass = getLensBoxClass(activeLens);
    let hostname = "web";
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = "search.fauxmium.internal";
    }

    if (url.includes("wikipedia.org")) {
      const topic = url.split("/wiki/")[1]?.replace(/_/g, " ") || "Time Travel";
      return `
        <div class="wiki-layout ${boxClass}">
          <div style="border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:1rem;">
            <h1 style="font-family:'Linux Libertine', Georgia, serif; font-size:2rem; font-weight:normal;">${topic}</h1>
            <div style="font-size:0.8rem; color:var(--text-dim);">From Wikipedia, the free encyclopedia (Synthesized by Fauxmium)</div>
          </div>

          <div class="wiki-infobox">
            <div class="wiki-infobox-header">${topic}</div>
            <div style="text-align:center; padding:0.5rem;">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" stroke="var(--primary)" stroke-width="3" fill="none"/>
                <line x1="40" y1="40" x2="40" y2="20" stroke="var(--text)" stroke-width="3"/>
                <line x1="40" y1="40" x2="56" y2="40" stroke="var(--text)" stroke-width="2"/>
              </svg>
            </div>
            <div style="border-top:1px solid var(--border); padding-top:0.4rem; font-size:0.75rem;">
              <div><strong>Discipline:</strong> Theoretical Physics</div>
              <div><strong>Key Concepts:</strong> Spacetime, Closed Timelike Curves</div>
              <div><strong>Hypothesis Status:</strong> Open Problem</div>
            </div>
          </div>

          <p>
            <strong>${topic}</strong> is the concept of movement between certain points in time, analogous to movement between different points in space by an object or a person, typically using a hypothetical device known as a time machine.
          </p>

          <div class="wiki-toc">
            <strong>Contents</strong>
            <ol>
              <li><a href="#physics">Physics & General Relativity</a></li>
              <li><a href="#paradoxes">Temporal Paradoxes</a></li>
              <li><a href="#fiction">Popular Culture & Literature</a></li>
            </ol>
          </div>

          <h3 id="physics" style="margin-top:1.5rem; border-bottom:1px solid var(--border); padding-bottom:0.3rem;">1. Physics & General Relativity</h3>
          <p>
            General relativity describes the universe under a system of field equations that describe spacetime curvature. Solutions to these equations allow for <a href="https://en.wikipedia.org/wiki/Closed_timelike_curve" class="wiki-link sim-nav-link" data-title="Closed Timelike Curve">closed timelike curves</a> (CTCs), which are world lines that form closed loops in spacetime.
          </p>

          <h3 id="paradoxes" style="margin-top:1.5rem; border-bottom:1px solid var(--border); padding-bottom:0.3rem;">2. Temporal Paradoxes</h3>
          <p>
            The most widely recognized paradox is the <a href="https://en.wikipedia.org/wiki/Grandfather_paradox" class="wiki-link sim-nav-link" data-title="Grandfather Paradox">Grandfather paradox</a>: if a time traveler were to prevent their own grandparents from meeting, their birth would never occur, eliminating the predicate for the journey.
          </p>
        </div>
      `;
    }

    if (url.includes("reddit.com")) {
      const subreddit = url.split("reddit.com/r/")[1] || "cyberpunk";
      return `
        <div style="max-width:840px; margin:0 auto;" class="${boxClass}">
          <div style="background:var(--primary); color:#fff; padding:1rem; border-radius:8px; margin-bottom:1rem; display:flex; align-items:center; justify-content:space-between;">
            <div>
              <h2 style="font-size:1.4rem;">r/${subreddit}</h2>
              <div style="font-size:0.8rem; opacity:0.85;">High tech, low life. Synthetic sub-community • 482k members</div>
            </div>
            <button class="btn btn-secondary" style="font-size:0.8rem; background:#fff; color:#000;">Join</button>
          </div>

          <div class="reddit-post-card">
            <div class="reddit-vote-col">
              <button class="reddit-vote-btn">▲</button>
              <span>1.8k</span>
              <button class="reddit-vote-btn">▼</button>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-dim); margin-bottom:0.25rem;">Posted by u/net_runner 5 hours ago</div>
              <h3 style="font-size:1.1rem; margin-bottom:0.4rem;">Fauxmium running Cyberpunk 2077 Browsing Lens on modern news</h3>
              <p style="font-size:0.85rem; color:var(--text-muted);">The HUD overlay injects NetWatch telemetry and neon borders into standard DOM structures on the fly.</p>
              <div style="margin-top:0.5rem; font-size:0.75rem; color:var(--text-dim);">💬 142 comments • ↗ Share • ⚑ Report</div>
            </div>
          </div>

          <div class="reddit-post-card">
            <div class="reddit-vote-col">
              <button class="reddit-vote-btn">▲</button>
              <span>924</span>
              <button class="reddit-vote-btn">▼</button>
            </div>
            <div>
              <div style="font-size:0.75rem; color:var(--text-dim); margin-bottom:0.25rem;">Posted by u/synth_wave 8 hours ago</div>
              <h3 style="font-size:1.1rem; margin-bottom:0.4rem;">Custom audio synthesis without external binaries in Node</h3>
              <p style="font-size:0.85rem; color:var(--text-muted);">Generating uncompressed 16-bit PCM WAV chunks right inside the proxy loop.</p>
              <div style="margin-top:0.5rem; font-size:0.75rem; color:var(--text-dim);">💬 89 comments • ↗ Share • ⚑ Report</div>
            </div>
          </div>
        </div>
      `;
    }

    // Default search or generic domain
    return `
      <div style="max-width:800px; margin:0 auto;" class="${boxClass}">
        <div style="border-bottom:1px solid var(--border); padding-bottom:1rem; margin-bottom:1.5rem;">
          <h1 style="font-size:1.5rem;">Fauxmium Synthetic Engine: ${hostname}</h1>
          <div style="font-size:0.85rem; color:var(--text-dim); font-family:var(--font-mono);">
            Requested URL: ${url} • Lens: ${activeLens}
          </div>
        </div>

        <p style="font-size:0.95rem; line-height:1.6; margin-bottom:1rem;">
          Fauxmium dynamically decomposed this route into path segments and query parameters. When running under the local proxy, this request is passed to <code>gemini-3.8-flash</code> with inherited design DNA and link intent context.
        </p>

        <div class="sim-grid">
          <div class="sim-card ${boxClass}">
            <h4>Structured Route Deconstruction</h4>
            <p>Domain: <code>${hostname}</code><br>Protocol: HTTPS<br>Status: HTTP 200 OK</p>
          </div>
          <div class="sim-card ${boxClass}">
            <h4>Multi-Modal Subresource Routing</h4>
            <p>Inline vector graphics, procedural PCM audio, and byte-range video streaming ready.</p>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 9. Viewport Rendering Logic
  // =========================================================================
  function renderSyntheticView(url, isNavigatingHistory) {
    if (!viewportEl) return;

    // Clean up prior video animation frame
    if (ytAnimId) {
      cancelAnimationFrame(ytAnimId);
      ytAnimId = null;
    }

    let pageHtml = "";
    if (url.includes("news.ycombinator.com")) {
      pageHtml = renderHackerNews(url);
    } else if (url.includes("youtube.com")) {
      pageHtml = renderYouTube(url);
    } else if (url.includes("paul.kinlan.me")) {
      pageHtml = renderPaulKinlan(url);
    } else if (url.includes("shop.example.com")) {
      pageHtml = renderStore(url);
    } else {
      pageHtml = renderGenericProcedural(url);
    }

    const lensChrome = getLensChrome(activeLens);
    const lensFooter = getLensFooter(activeLens);

    viewportEl.innerHTML = `
      <div class="lens-view lens-${activeLens}">
        ${lensChrome}
        ${pageHtml}
        ${lensFooter}
      </div>
    `;

    // Attach Interactivity
    attachViewportListeners(url);

    // If on YouTube watch page, start 60fps canvas loop
    if (url.includes("youtube.com") && mediaSettings.videos) {
      initYouTubeCanvas(url);
    }

    // Log request into extension popup
    recordExtensionRequest("HTML", url, isNavigatingHistory);
  }

  // Real Streaming Live AI via Gemini API (BYOK)
  async function renderLiveGeminiView(url) {
    if (!viewportEl) return;

    viewportEl.innerHTML = `
      <div style="padding:1.5rem; text-align:center;">
        <div style="font-family:var(--font-mono); font-size:0.85rem; margin-bottom:0.75rem;">
          ⚡ Connecting to Google Gemini 2.5 Flash via SSE streaming...
        </div>
        <div style="max-width:600px; margin:0 auto; font-size:0.8rem; color:var(--text-dim);">
          Generating complete HTML document for <code>${url}</code> under the [${activeLens}] lens with linkContext.
        </div>
      </div>
    `;

    try {
      const prompt = `You are Fauxmium, an autonomous web browser proxy that synthesizes the web on the fly.
Synthesize a complete, full-fidelity HTML webpage for:
URL: ${url}
Browsing Lens Aesthetic: ${activeLens}
Instructions:
- Return ONLY valid raw HTML starting with <!DOCTYPE html>.
- Include clean inline CSS styled to match the "${activeLens}" lens.
- Make all links <a href="..."> real, relevant URLs so the user can continue browsing.
- Do NOT output markdown fences like \`\`\`html. Return pure HTML.`;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(byokKey)}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API HTTP ${response.status}: ${response.statusText}`);
      }

      // Create sandboxed iframe
      const iframe = document.createElement("iframe");
      iframe.className = "sim-iframe-viewport";
      iframe.sandbox = "allow-scripts allow-same-origin";
      viewportEl.innerHTML = "";
      viewportEl.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep last incomplete chunk

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataStr);
              const textChunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textChunk) {
                iframeDoc.write(textChunk);
              }
            } catch {
              // ignore parse chunk
            }
          }
        }
      }

      iframeDoc.close();

      // Intercept link clicks inside the live iframe
      iframeDoc.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (link && link.href) {
          e.preventDefault();
          const target = link.getAttribute("href");
          const title = link.textContent.trim();
          navigateTo(target, { linkContext: { title, context: `Clicked from live Gemini document for ${url}` } });
        }
      });

      recordExtensionRequest("HTML", url, false);
      showToast("Live Gemini synthesis complete!");
    } catch (err) {
      console.warn("Live Gemini stream error:", err);
      viewportEl.innerHTML = `
        <div style="padding:2rem; text-align:center;">
          <h3 style="color:var(--danger); margin-bottom:0.5rem;">Live AI Mode Stream Error</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); max-width:500px; margin:0 auto 1rem;">
            ${err.message || "Failed to stream from Gemini API"}. Verify your API key or revert to the instant procedural engine.
          </p>
          <button id="revert-synthetic-btn" class="btn btn-primary">Switch to Instant Engine</button>
        </div>
      `;
      document.getElementById("revert-synthetic-btn")?.addEventListener("click", () => {
        isLiveAIMode = false;
        byokBtn?.classList.remove("active");
        renderSyntheticView(url, false);
      });
    }
  }

  // =========================================================================
  // 10. Viewport Event Listeners (Links, Upvotes, Comments, Cart, Podcast)
  // =========================================================================
  function attachViewportListeners(currentUrl) {
    if (!viewportEl) return;

    // 1. All synthetic navigation links
    viewportEl.querySelectorAll(".sim-nav-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = link.getAttribute("data-target") || link.getAttribute("href");
        const title = link.getAttribute("data-title") || link.textContent.trim();
        const context = link.getAttribute("data-context") || `Navigated from ${currentUrl}`;
        playProceduralSound("click");
        navigateTo(target, { linkContext: { title, context } });
      });
    });

    // 2. Hacker News Upvotes
    viewportEl.querySelectorAll(".hn-arrow").forEach(arrow => {
      arrow.addEventListener("click", (e) => {
        e.stopPropagation();
        const storyId = arrow.getAttribute("data-story-id");
        hnUpvotes[storyId] = !hnUpvotes[storyId];
        playProceduralSound("click");
        showToast(hnUpvotes[storyId] ? "▲ Upvoted story!" : "Unvoted story");
        renderSyntheticView(currentUrl, true);
      });
    });

    // 3. Hacker News Comment Submission
    const hnSubmitBtn = viewportEl.querySelector("#hn-comment-submit-btn");
    if (hnSubmitBtn) {
      hnSubmitBtn.addEventListener("click", () => {
        const textarea = viewportEl.querySelector("#hn-comment-textarea");
        const text = textarea?.value.trim();
        const storyId = hnSubmitBtn.getAttribute("data-story-id");
        if (text && storyId) {
          if (!hnUserComments[storyId]) hnUserComments[storyId] = [];
          hnUserComments[storyId].unshift({
            author: "you",
            time: "0 minutes ago",
            text: text,
          });
          playProceduralSound("click");
          showToast("Comment posted to synthetic thread!");
          renderSyntheticView(currentUrl, true);
        }
      });
    }

    // 4. YouTube Like and Subscribe buttons
    const ytLikeBtn = viewportEl.querySelector("#yt-like-btn");
    if (ytLikeBtn) {
      ytLikeBtn.addEventListener("click", () => {
        ytHasLiked = !ytHasLiked;
        ytLikeCount += ytHasLiked ? 1 : -1;
        playProceduralSound("click");
        const counter = viewportEl.querySelector("#yt-like-counter");
        if (counter) counter.textContent = ytLikeCount;
        ytLikeBtn.style.color = ytHasLiked ? "var(--primary)" : "inherit";
      });
    }

    const ytSubBtn = viewportEl.querySelector("#yt-sub-btn");
    if (ytSubBtn) {
      ytSubBtn.addEventListener("click", () => {
        ytIsSubscribed = !ytIsSubscribed;
        playProceduralSound("click");
        ytSubBtn.classList.toggle("subscribed", ytIsSubscribed);
        ytSubBtn.textContent = ytIsSubscribed ? "Subscribed ✓" : "Subscribe";
        showToast(ytIsSubscribed ? "Subscribed to Paul Kinlan!" : "Unsubscribed");
      });
    }

    // YouTube Comment
    const ytCommentBtn = viewportEl.querySelector("#yt-comment-btn");
    if (ytCommentBtn) {
      ytCommentBtn.addEventListener("click", () => {
        const input = viewportEl.querySelector("#yt-comment-input");
        const val = input?.value.trim();
        if (val) {
          const params = new URLSearchParams(currentUrl.split("?")[1] || "");
          const vKey = params.get("v") || "ai-web";
          if (!ytUserComments[vKey]) ytUserComments[vKey] = [];
          ytUserComments[vKey].unshift(val);
          input.value = "";
          playProceduralSound("click");
          showToast("Comment posted!");
          renderSyntheticView(currentUrl, true);
        }
      });
    }

    // 5. Paul Kinlan Blog Podcast Preview
    const pkPodcastPlay = viewportEl.querySelector("#pk-podcast-play");
    if (pkPodcastPlay) {
      let isPlaying = false;
      pkPodcastPlay.addEventListener("click", () => {
        isPlaying = !isPlaying;
        pkPodcastPlay.textContent = isPlaying ? "❚❚" : "▶";
        const bars = viewportEl.querySelectorAll(".pk-bar");
        bars.forEach(b => b.classList.toggle("animating", isPlaying));

        if (isPlaying) {
          playPodcastSynthMelody();
          showToast("Playing procedural audio episode preview...");
        }
      });
    }

    // 6. E-Commerce Cart Actions
    viewportEl.querySelectorAll(".add-to-cart-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const title = btn.getAttribute("data-title");
        const price = parseFloat(btn.getAttribute("data-price"));

        const existing = cartState.items.find(i => i.id === id);
        if (existing) {
          existing.qty++;
        } else {
          cartState.items.push({ id, title, price, qty: 1 });
        }

        const totalItems = cartState.items.reduce((s, i) => s + i.qty, 0);
        cartState.domainState = `authenticated="true", user="alex", cart_items="${totalItems}"`;
        playProceduralSound("click");
        showToast(`Added "${title}" to cart!`);
        renderSyntheticView(currentUrl, true);
      });
    });

    viewportEl.querySelectorAll(".cart-qty-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = cartState.items.find(i => i.id === id);
        if (item) {
          item.qty++;
          playProceduralSound("click");
          renderSyntheticView(currentUrl, true);
        }
      });
    });

    viewportEl.querySelectorAll(".cart-qty-minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const idx = cartState.items.findIndex(i => i.id === id);
        if (idx >= 0) {
          if (cartState.items[idx].qty > 1) {
            cartState.items[idx].qty--;
          } else {
            cartState.items.splice(idx, 1);
          }
          playProceduralSound("click");
          renderSyntheticView(currentUrl, true);
        }
      });
    });

    const placeOrderBtn = viewportEl.querySelector("#shop-place-order-btn");
    if (placeOrderBtn) {
      placeOrderBtn.addEventListener("click", () => {
        const username = viewportEl.querySelector("#shop-username-input")?.value.trim() || "alex";
        cartState.domainState = `authenticated="true", user="${username}", order_status="completed", order_id="FX-${Date.now()}"`;
        cartState.items = [];
        playProceduralSound("click");
        showToast("Order placed successfully! Domain session state updated.");
        renderSyntheticView(currentUrl, true);
      });
    }
  }

  // =========================================================================
  // 11. 60fps HTML5 Canvas Procedural Video Engine
  // =========================================================================
  function initYouTubeCanvas(url) {
    const canvas = document.getElementById("yt-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const params = new URLSearchParams(url.split("?")[1] || "");
    const videoKey = params.get("v") || "ai-web";

    let frame = 0;

    function renderFrame() {
      if (!ytIsPlaying) {
        ytAnimId = requestAnimationFrame(renderFrame);
        return;
      }

      frame++;
      const w = canvas.width;
      const h = canvas.height;

      if (videoKey.includes("http-range-206")) {
        // Scene: Matrix packet data rain
        ctx.fillStyle = "rgba(5, 10, 5, 0.25)";
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "#10b981";
        ctx.font = "12px monospace";
        for (let i = 0; i < 30; i++) {
          const x = i * 22;
          const y = ((frame * 3 + i * 40) % (h + 30)) - 10;
          const char = String.fromCharCode(0x30A0 + ((frame + i) % 96));
          ctx.fillText(char, x, y);
        }

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace";
        ctx.fillText(`HTTP/1.1 206 Partial Content [bytes=${(frame * 1024) % 65536}-${((frame + 4) * 1024) % 65536}]`, 20, h - 30);
      } else if (videoKey.includes("lenses-demo")) {
        // Scene: Morphing neon kaleidoscope
        ctx.fillStyle = "rgba(10, 5, 20, 0.2)";
        ctx.fillRect(0, 0, w, h);

        const cx = w / 2;
        const cy = h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(frame * 0.02);

        for (let i = 0; i < 8; i++) {
          ctx.rotate((Math.PI * 2) / 8);
          ctx.strokeStyle = i % 2 === 0 ? "#ff0055" : "#00f3ff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          const r = 40 + Math.sin(frame * 0.05 + i) * 30;
          ctx.arc(r, 0, 20 + i * 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Default Scene: 3D synthwave perspective grid & UFO saucer
        ctx.fillStyle = "#090a14";
        ctx.fillRect(0, 0, w, h);

        // Sun on horizon
        const sunY = h * 0.45;
        const grad = ctx.createLinearGradient(0, sunY - 60, 0, sunY + 40);
        grad.addColorStop(0, "#ff007f");
        grad.addColorStop(1, "#ffaa00");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w / 2, sunY, 50, Math.PI, 0, false);
        ctx.fill();

        // Sun horizontal scanline slices
        ctx.fillStyle = "#090a14";
        for (let s = 0; s < 6; s++) {
          ctx.fillRect(w / 2 - 50, sunY - 35 + s * 7, 100, 2 + s * 0.5);
        }

        // Perspective Synthwave Grid Floor
        const horizon = sunY;
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;

        // Radiating perspective lines
        const vanishingX = w / 2;
        for (let x = -w * 0.5; x <= w * 1.5; x += 60) {
          ctx.beginPath();
          ctx.moveTo(vanishingX, horizon);
          ctx.lineTo(x, h);
          ctx.stroke();
        }

        // Moving horizontal cross lines
        const offset = (frame * 1.5) % 30;
        for (let y = horizon; y < h; y += 8 + (y - horizon) * 0.18) {
          const drawY = y + offset * ((y - horizon) / (h - horizon));
          if (drawY <= h) {
            ctx.beginPath();
            ctx.moveTo(0, drawY);
            ctx.lineTo(w, drawY);
            ctx.stroke();
          }
        }

        // Floating hovering UFO / vehicle
        const ufoX = w / 2 + Math.sin(frame * 0.03) * 60;
        const ufoY = horizon - 45 + Math.cos(frame * 0.05) * 8;

        ctx.fillStyle = "rgba(0, 243, 255, 0.25)";
        ctx.beginPath();
        ctx.moveTo(ufoX, ufoY + 6);
        ctx.lineTo(ufoX - 35, horizon + 20);
        ctx.lineTo(ufoX + 35, horizon + 20);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.ellipse(ufoX, ufoY, 26, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#00f3ff";
        ctx.beginPath();
        ctx.arc(ufoX, ufoY - 2, 8, Math.PI, 0, false);
        ctx.fill();
      }

      ytAnimId = requestAnimationFrame(renderFrame);
    }

    ytAnimId = requestAnimationFrame(renderFrame);

    // Play/Pause button in video overlay
    const playToggleBtn = document.getElementById("yt-play-toggle");
    if (playToggleBtn) {
      playToggleBtn.addEventListener("click", () => {
        ytIsPlaying = !ytIsPlaying;
        playToggleBtn.textContent = ytIsPlaying ? "❚❚" : "▶";
        playProceduralSound(ytIsPlaying ? "stream" : "click");
      });
    }

    // Scrubber click
    const scrubBar = document.getElementById("yt-scrub-bar");
    if (scrubBar) {
      scrubBar.addEventListener("click", (e) => {
        const rect = scrubBar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        ytCurrentTime = Math.floor(pct * ytDuration);
        const fill = scrubBar.querySelector(".yt-scrub-fill");
        if (fill) fill.style.width = (pct * 100) + "%";
        const timecode = document.getElementById("yt-timecode");
        if (timecode) {
          timecode.textContent = `0:${ytCurrentTime < 10 ? '0' + ytCurrentTime : ytCurrentTime} / 3:45`;
        }
        playProceduralSound("click");
      });
    }
  }

  function playPodcastSynthMelody() {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const notes = [329.63, 392.00, 440.00, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.16);
        gain.gain.setValueAtTime(0.06, now + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.16);
        osc.stop(now + idx * 0.16 + 0.26);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // =========================================================================
  // 12. Simulated Companion Extension Accounting
  // =========================================================================
  function recordExtensionRequest(type, url, isCached = false) {
    const costNum = isCached ? 0.0 : (type === "HTML" ? 0.0006 : (type === "IMG" ? 0.039 : 0.0));
    spendMetrics.text += costNum;
    spendMetrics.total = spendMetrics.text + spendMetrics.images + spendMetrics.videos + spendMetrics.audio;

    const time = new Date().toTimeString().split(" ")[0];
    recentRequests.unshift({
      type,
      url: url.replace("https://", ""),
      cost: `$${costNum.toFixed(4)}${isCached ? ' ⚡' : ''}`,
      time,
      cached: isCached,
    });

    if (recentRequests.length > 8) recentRequests.pop();
    updateExtensionDisplay();
  }

  function updateExtensionDisplay() {
    if (extTotalBadge) extTotalBadge.textContent = `$${(spendMetrics.text + spendMetrics.images + spendMetrics.videos + spendMetrics.audio).toFixed(4)}`;
    if (extSpendText) extSpendText.textContent = `$${spendMetrics.text.toFixed(4)}`;
    if (extSpendImage) extSpendImage.textContent = `$${spendMetrics.images.toFixed(4)}`;
    if (extSpendVideo) extSpendVideo.textContent = `$${spendMetrics.videos.toFixed(4)}`;
    if (extSpendAudio) extSpendAudio.textContent = `$${spendMetrics.audio.toFixed(4)}`;
    if (extReqCount) extReqCount.textContent = recentRequests.length;

    if (extRequestsList) {
      extRequestsList.innerHTML = recentRequests.map(r => `
        <div class="ext-req-item">
          <span class="ext-req-badge ext-badge-${r.type.toLowerCase()}">${r.type}</span>
          <span class="ext-req-url" title="${r.url}">${r.url}</span>
          <span class="ext-req-cost">${r.cost}</span>
        </div>
      `).join("");
    }
  }

  if (extToggleBtn && extensionPopupSim) {
    extToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      extensionPopupSim.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!extensionPopupSim.contains(e.target) && e.target !== extToggleBtn) {
        extensionPopupSim.classList.remove("active");
      }
    });
  }

  // Extension action buttons
  if (extBtnReload) {
    extBtnReload.addEventListener("click", () => {
      showToast("Bypassing cache: Regenerating active tab with fresh model turn...");
      navigateTo(activeRoute, { isNavigatingHistory: false });
    });
  }

  if (extBtnClear) {
    extBtnClear.addEventListener("click", () => {
      showToast("Cleared simulated cache for HTML, Images, Video and Audio.");
      recentRequests.length = 0;
      updateExtensionDisplay();
    });
  }

  if (extBtnReset) {
    extBtnReset.addEventListener("click", () => {
      spendMetrics.text = 0.0;
      spendMetrics.images = 0.0;
      spendMetrics.videos = 0.0;
      spendMetrics.audio = 0.0;
      updateExtensionDisplay();
      showToast("Session spend metrics reset to $0.0000.");
    });
  }

  // Two-way Lens sync
  if (lensSelect) {
    lensSelect.addEventListener("change", () => {
      activeLens = lensSelect.value;
      if (extLensSelect) extLensSelect.value = activeLens;
      navigateTo(activeRoute, { triggerLensChange: true });
      showToast(`Browsing Lens switched to: ${activeLens}`);
    });
  }

  if (extLensSelect) {
    extLensSelect.addEventListener("change", () => {
      activeLens = extLensSelect.value;
      if (lensSelect) lensSelect.value = activeLens;
      navigateTo(activeRoute, { triggerLensChange: true });
      showToast(`Browsing Lens switched to: ${activeLens}`);
    });
  }

  // Media toggles
  if (extToggleImages) {
    extToggleImages.addEventListener("change", () => {
      mediaSettings.images = extToggleImages.checked;
      showToast(`Image generation: ${mediaSettings.images ? 'Enabled' : 'Disabled (SVG Blueprint Placeholders)'}`);
      renderSyntheticView(activeRoute, true);
    });
  }

  if (extToggleVideos) {
    extToggleVideos.addEventListener("change", () => {
      mediaSettings.videos = extToggleVideos.checked;
      showToast(`Video generation: ${mediaSettings.videos ? 'Enabled (Veo 3.1)' : 'Disabled'}`);
      renderSyntheticView(activeRoute, true);
    });
  }

  if (extToggleAudio) {
    extToggleAudio.addEventListener("change", () => {
      mediaSettings.audio = extToggleAudio.checked;
      showToast(`Audio generation: ${mediaSettings.audio ? 'Enabled (Node WAV)' : 'Disabled'}`);
    });
  }

  // =========================================================================
  // 13. Live AI Mode (BYOK Modal)
  // =========================================================================
  if (byokBtn && byokModal) {
    if (byokKey) {
      byokBtn.classList.add("active");
      byokBtn.innerHTML = `🔑 Live AI (Active)`;
    }

    byokBtn.addEventListener("click", () => {
      byokModal.removeAttribute("aria-hidden");
      if (byokKeyInput) byokKeyInput.value = byokKey;
      if (byokStatus) byokStatus.textContent = "";
    });

    if (byokCloseBtn) {
      byokCloseBtn.addEventListener("click", () => {
        byokModal.setAttribute("aria-hidden", "true");
      });
    }

    if (byokSaveBtn && byokKeyInput) {
      byokSaveBtn.addEventListener("click", () => {
        const val = byokKeyInput.value.trim();
        if (val) {
          byokKey = val;
          sessionStorage.setItem("fauxmium_gemini_api_key", val);
          isLiveAIMode = true;
          byokBtn.classList.add("active");
          byokBtn.innerHTML = `🔑 Live AI (Active)`;
          byokModal.setAttribute("aria-hidden", "true");
          showToast("Live AI Mode activated! Any URL will now stream from Gemini API.");
          navigateTo(activeRoute);
        } else {
          if (byokStatus) {
            byokStatus.className = "byok-status error";
            byokStatus.textContent = "Please enter a valid Gemini API key.";
          }
        }
      });
    }

    if (byokClearBtn) {
      byokClearBtn.addEventListener("click", () => {
        byokKey = "";
        sessionStorage.removeItem("fauxmium_gemini_api_key");
        isLiveAIMode = false;
        byokBtn.classList.remove("active");
        byokBtn.innerHTML = `🔑 Live AI Mode`;
        if (byokKeyInput) byokKeyInput.value = "";
        byokModal.setAttribute("aria-hidden", "true");
        showToast("Cleared API key. Switched to Instant Procedural Engine.");
        navigateTo(activeRoute);
      });
    }
  }

  // =========================================================================
  // 14. Audition Procedural Audio Button
  // =========================================================================
  if (auditionAudioBtn) {
    auditionAudioBtn.addEventListener("click", () => {
      try {
        const ctx = getAudioContext();
        auditionAudioBtn.classList.add("playing");
        auditionAudioBtn.textContent = "🔊 Auditioning...";

        const now = ctx.currentTime;
        const dur = 2.4;

        if (activeLens === "arcade-8bit" || activeLens === "retro-90s") {
          // 8-bit square wave chiptune arpeggio
          const notes = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "square";
            osc.frequency.setValueAtTime(freq, now + idx * 0.14);
            gain.gain.setValueAtTime(0.08, now + idx * 0.14);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.13);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.14);
            osc.stop(now + idx * 0.14 + 0.14);
          });
        } else if (activeLens === "cyberpunk-2077") {
          // Detuned sawtooth synthwave chord (Em9)
          const freqs = [164.81, 196.00, 246.94, 293.66, 329.63];
          freqs.forEach(freq => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            osc1.type = "sawtooth";
            osc2.type = "sawtooth";
            osc1.frequency.setValueAtTime(freq, now);
            osc2.frequency.setValueAtTime(freq * 1.008, now);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + dur);
            osc2.stop(now + dur);
          });
        } else if (activeLens === "noir-1940s") {
          // Warm jazz chord (Dm7 with mellow low-pass filter)
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(800, now);
          const freqs = [146.83, 174.61, 220.00, 261.63];
          freqs.forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(gain);
            gain.connect(filter);
            filter.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + dur);
          });
        } else {
          // Modern / Warm bell ambient chord (Cmaj7)
          const freqs = [261.63, 329.63, 392.00, 493.88];
          freqs.forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + dur);
          });
        }

        setTimeout(() => {
          auditionAudioBtn.classList.remove("playing");
          auditionAudioBtn.textContent = "🔊 Audition Audio";
        }, dur * 1000);
      } catch (err) {
        console.warn("AudioContext error:", err);
        auditionAudioBtn.classList.remove("playing");
        auditionAudioBtn.textContent = "🔊 Audition Audio";
      }
    });
  }

  // =========================================================================
  // 15. Interactive CLI Command & .env Generator
  // =========================================================================
  const cliProvider = document.getElementById("cli-provider");
  const cliModel = document.getElementById("cli-model");
  const cliLens = document.getElementById("cli-lens");
  const cliImgToggle = document.getElementById("cli-img-toggle");
  const cliVidToggle = document.getElementById("cli-vid-toggle");
  const cliAudioProvider = document.getElementById("cli-audio-provider");
  const cliDevtools = document.getElementById("cli-devtools");
  const cliCommandPre = document.getElementById("cli-command-output");
  const cliEnvPre = document.getElementById("cli-env-output");
  const copyCmdBtn = document.getElementById("copy-cmd-btn");
  const copyEnvBtn = document.getElementById("copy-env-btn");

  const MODEL_OPTIONS = {
    gemini: [
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash (Default)" },
      { id: "gemini-3.8-pro", name: "Gemini 3.8 Pro" },
      { id: "gemini-3.8-flash-lite", name: "Gemini 3.8 Flash-Lite" },
    ],
    openai: [
      { id: "gpt-5.6-luna", name: "GPT-5.6 Luna (Default)" },
      { id: "gpt-6-sol", name: "GPT-6 Sol" },
    ],
    anthropic: [
      { id: "claude-sonnet-5", name: "Claude Sonnet 5 (Default)" },
      { id: "claude-haiku-5-5", name: "Claude 5.5 Haiku" },
    ],
    groq: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Default)" },
      { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
    ],
    deepseek: [
      { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash (Default)" },
      { id: "deepseek-v4", name: "DeepSeek V4" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
      { id: "deepseek-chat", name: "DeepSeek Chat (V3)" },
    ],
    zai: [
      { id: "glm-5-flash", name: "GLM-5 Flash (Default)" },
      { id: "glm-5-plus", name: "GLM-5 Plus" },
      { id: "glm-5-air", name: "GLM-5 Air" },
    ],
    kimi: [
      { id: "kimi-k2.5-flash", name: "Kimi K2.5 Flash (Default)" },
      { id: "kimi-k2.5", name: "Kimi K2.5" },
      { id: "kimi-k2-thinking", name: "Kimi K2 Thinking" },
    ],
    openrouter: [
      { id: "deepseek/deepseek-v4-flash", name: "OpenRouter DeepSeek V4 Flash (Default)" },
      { id: "z-ai/glm-5", name: "OpenRouter GLM-5" },
      { id: "moonshotai/kimi-k2.5", name: "OpenRouter Kimi K2.5" },
    ],
    ollama: [
      { id: "qwen3.8:14b", name: "Ollama Qwen 3.8 14B (Default - Offline)" },
      { id: "deepseek-r1:14b", name: "Ollama DeepSeek-R1 14B" },
      { id: "llama3.3:70b", name: "Ollama Llama 3.3 70B" },
    ],
  };

  function updateModelOptions() {
    if (!cliProvider || !cliModel) return;
    const provider = cliProvider.value;
    const models = MODEL_OPTIONS[provider] || MODEL_OPTIONS.gemini;
    cliModel.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join("");
    updateCliOutput();
  }

  function updateCliOutput() {
    if (!cliCommandPre) return;
    const provider = cliProvider.value;
    const model = cliModel.value;
    const lens = cliLens.value;
    const imgEnabled = cliImgToggle.checked;
    const vidEnabled = cliVidToggle.checked;
    const audioProvider = cliAudioProvider.value;
    const devtools = cliDevtools.checked;

    const parts = ["npx fauxmium"];
    if (provider !== "gemini") {
      parts.push(provider);
    }
    if (model && !model.includes("(Default)")) {
      parts.push(`-m ${model}`);
    }
    if (lens && lens !== "modern") {
      parts.push(`--lens ${lens}`);
    }
    if (!imgEnabled) parts.push("--no-image");
    if (!vidEnabled) parts.push("--no-video");
    if (audioProvider !== "synth") parts.push(`--audio-provider ${audioProvider}`);
    if (devtools) parts.push("--devtools");

    cliCommandPre.textContent = parts.join(" ");

    const envLines = [];
    if (provider === "gemini") envLines.push("GEMINI_API_KEY=your_gemini_api_key");
    if (provider === "openai") envLines.push("OPENAI_API_KEY=your_openai_api_key");
    if (provider === "anthropic") envLines.push("ANTHROPIC_API_KEY=your_anthropic_api_key");
    if (provider === "groq") envLines.push("GROQ_API_KEY=your_groq_api_key");
    if (provider === "deepseek") envLines.push("DEEPSEEK_API_KEY=your_deepseek_api_key");
    if (provider === "zai") envLines.push("ZHIPU_API_KEY=your_zhipu_api_key");
    if (provider === "kimi") envLines.push("MOONSHOT_API_KEY=your_moonshot_api_key");
    if (provider === "openrouter") envLines.push("OPENROUTER_API_KEY=your_openrouter_api_key");
    if (provider === "ollama") envLines.push("# Ollama runs locally at http://127.0.0.1:11434 (No API key required)");
    if (audioProvider === "openai" && provider !== "openai") envLines.push("OPENAI_API_KEY=your_openai_api_key");
    if (audioProvider === "gemini" && provider !== "gemini") envLines.push("GEMINI_API_KEY=your_gemini_api_key");

    if (cliEnvPre) {
      cliEnvPre.textContent = envLines.join("\n") || "# No external API keys required for local synth!";
    }
  }

  if (cliProvider) cliProvider.addEventListener("change", updateModelOptions);
  if (cliModel) cliModel.addEventListener("change", updateCliOutput);
  if (cliLens) cliLens.addEventListener("change", updateCliOutput);
  if (cliImgToggle) cliImgToggle.addEventListener("change", updateCliOutput);
  if (cliVidToggle) cliVidToggle.addEventListener("change", updateCliOutput);
  if (cliAudioProvider) cliAudioProvider.addEventListener("change", updateCliOutput);
  if (cliDevtools) cliDevtools.addEventListener("change", updateCliOutput);

  if (copyCmdBtn) {
    copyCmdBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(cliCommandPre.textContent);
      showToast("Copied command to clipboard!");
    });
  }

  if (copyEnvBtn) {
    copyEnvBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(cliEnvPre.textContent);
      showToast("Copied .env config to clipboard!");
    });
  }

  // =========================================================================
  // 16. Initialize Application
  // =========================================================================
  navigateTo("https://news.ycombinator.com");
  updateModelOptions();
  updateExtensionDisplay();
});
