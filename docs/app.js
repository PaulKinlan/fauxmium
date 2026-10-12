/**
 * Fauxmium Documentation & Synthetic Browser Lab Simulator
 * Pure vanilla JavaScript with native Web Audio API synthesis
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Theme Toggle
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

  // 2. Notification Toast
  const toastEl = document.getElementById("toast");
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => {
      toastEl.classList.remove("show");
    }, 2400);
  }

  // 3. Browser Simulator State & Data
  const omniboxInput = document.getElementById("sim-omnibox");
  const lensSelect = document.getElementById("sim-lens-select");
  const viewportEl = document.getElementById("sim-viewport");
  const coherenceDrawer = document.getElementById("coherence-drawer");
  const drawerCloseBtn = document.getElementById("drawer-close-btn");
  const drawerContextPre = document.getElementById("drawer-data-context");
  const drawerTokensPre = document.getElementById("drawer-css-tokens");
  const drawerTurnPre = document.getElementById("drawer-chat-turn");
  const extensionPopupSim = document.getElementById("extension-popup-sim");
  const extToggleBtn = document.getElementById("sim-ext-toggle");
  const auditionAudioBtn = document.getElementById("sim-audition-btn");
  const routeBtns = document.querySelectorAll(".route-btn");

  let activeRoute = "https://news.ycombinator.com";
  let activeLens = "modern";

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
          points: "428 points by pkinlan 4 hours ago | 182 comments",
          desc: "We built an engine that synthesizes HTML, images, and audio on the fly as you browse.",
          context: "Discussion of browser request interception, prompt prefix caching, and Veo video generation.",
          target: "https://news.ycombinator.com/item?id=391024",
        },
        {
          id: "hn-2",
          title: "Prompt Prefix Caching: How to achieve 75% LLM cost reduction",
          points: "312 points by cache_dev 6 hours ago | 94 comments",
          desc: "Structuring invariant system instructions (>1,024 tokens) with 64px viewport tiering.",
          context: "Technical deep dive into Anthropic, OpenAI, and Gemini prompt caching internals.",
          target: "https://news.ycombinator.com/item?id=391045",
        },
        {
          id: "hn-3",
          title: "Procedural 16-Bit PCM WAV Audio Synthesis in Zero-Dependency Node.js",
          points: "189 points by wav_synth 8 hours ago | 45 comments",
          desc: "Generating crisp chiptunes, bell chimes, and ambient drones without external libraries.",
          context: "Audio programming tutorial: RIFF headers, square waves, and formant speech modeling.",
          target: "https://news.ycombinator.com/item?id=391089",
        },
      ],
    },
    "https://youtube.com/watch?v=ai-web": {
      title: "YouTube — Synthetic Video Player",
      domain: "youtube.com",
      brand: "YouTube",
      cssVars: "--brand-primary: #ff0000, --brand-bg: #0f0f0f, --font-family: Roboto",
      video: {
        title: "Building an Infinite AI Browser Engine with Multi-Modal Synthesis",
        author: "Paul Kinlan — 184K views • 2 days ago",
        desc: "Watch our autonomous system synthesize continuous video streams with HTTP 206 range seeking.",
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
          target: "https://paul.kinlan.me/generative-web-proofs/",
        },
        {
          id: "pk-2",
          title: "Overcoming LLM Amnesia with Design DNA and Click Intent",
          points: "Architecture • 12 min read",
          desc: "How capturing card snippets and CSS variables makes AI-generated sites feel completely coherent.",
          context: "Architecture breakdown of siteMemory.js, __fauxmiumCaptureClick, and domainState.",
          target: "https://paul.kinlan.me/site-memory-coherence/",
        },
      ],
    },
    "https://shop.example.com/cart": {
      title: "Synthetic Storefront & Cart",
      domain: "shop.example.com",
      brand: "Hyperloop Merch Co.",
      cssVars: "--brand-primary: #10b981, --brand-bg: #fafafa, --font-family: Plus Jakarta Sans",
      stateInfo: 'authenticated="true", user="alex", cart_items="3", total="$148.00"',
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

  function renderSimulator() {
    if (!viewportEl) return;
    const data = SIMULATED_DATA[activeRoute] || SIMULATED_DATA["https://news.ycombinator.com"];
    
    let boxClass = "";
    if (activeLens === "retro-90s") boxClass = "r-box";
    else if (activeLens === "cyberpunk-2077") boxClass = "cp-box";
    else if (activeLens === "brutalist") boxClass = "brut-box";
    else if (activeLens === "noir-1940s") boxClass = "noir-box";
    else if (activeLens === "arcade-8bit") boxClass = "arc-box";

    let contentHtml = "";

    // Specific route templates
    if (activeRoute.includes("youtube.com")) {
      const v = data.video;
      contentHtml = `
        <div class="${boxClass}" style="margin-bottom: 1.5rem;">
          <div style="background:#000; color:#fff; height:240px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:6px; position:relative; overflow:hidden;">
            <div style="font-size:3rem; opacity:0.85;">▶</div>
            <div style="font-family:var(--font-mono); font-size:0.8rem; margin-top:0.5rem; opacity:0.9;">
              HTTP 206 Partial Content Stream (Veo 3.1)
            </div>
            <div style="position:absolute; bottom:10px; left:15px; font-size:0.75rem; background:rgba(0,0,0,0.7); padding:2px 8px; border-radius:4px;">
              0:14 / 3:45 • [Camera: Pan] • [Poster Seeding: Active]
            </div>
          </div>
          <h3 style="margin-top:1rem; font-size:1.3rem;">${v.title}</h3>
          <div style="font-size:0.85rem; opacity:0.8; margin-top:0.25rem;">${v.author}</div>
          <p style="margin-top:0.75rem; font-size:0.9rem;">${v.desc}</p>
        </div>
        <h4>Recommended Continuations (Click for Coherence Inspect):</h4>
        <div class="sim-grid">
          ${data.items.map(item => `
            <div class="sim-card ${boxClass}" data-item-id="${item.id}" data-target="${item.target}" data-context="${item.context}">
              <h4>${item.title}</h4>
              <p>${item.desc}</p>
              <div class="sim-meta">
                <span>${item.points}</span>
                <span style="color:var(--primary); font-weight:700;">Inspect Intent ↗</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } else {
      contentHtml = `
        <div class="${boxClass}" style="margin-bottom: 1.5rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
          <div>
            <h2 style="font-size:1.5rem;">${data.title}</h2>
            <div style="font-size:0.85rem; opacity:0.8; font-family:var(--font-mono); margin-top:0.25rem;">
              Domain: ${data.domain} • [Lens: ${activeLens}]
            </div>
          </div>
          ${data.stateInfo ? `<div style="font-family:var(--font-mono); font-size:0.75rem; background:var(--primary-subtle); color:var(--primary-text); padding:0.4rem 0.8rem; border-radius:4px;">Session: ${data.stateInfo}</div>` : ""}
        </div>
        <div class="sim-grid">
          ${data.items.map(item => `
            <div class="sim-card ${boxClass}" data-item-id="${item.id}" data-target="${item.target}" data-context="${item.context}">
              <h4>${item.title}</h4>
              <p>${item.desc}</p>
              <div class="sim-meta">
                <span>${item.points}</span>
                <span style="color:var(--primary); font-weight:700;">Inspect Intent ↗</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    viewportEl.innerHTML = `
      <div class="lens-view lens-${activeLens}">
        ${contentHtml}
      </div>
    `;

    // Re-attach card click listeners
    viewportEl.querySelectorAll(".sim-card").forEach(card => {
      card.addEventListener("click", () => {
        const title = card.querySelector("h4").textContent;
        const target = card.getAttribute("data-target");
        const context = card.getAttribute("data-context");
        openCoherenceDrawer(title, target, context, data);
      });
    });
  }

  function openCoherenceDrawer(cardTitle, targetUrl, contextStr, siteData) {
    if (!coherenceDrawer) return;
    drawerContextPre.textContent = `Target URL: ${targetUrl}\nClicked Item: "${cardTitle}"\nExpected Intent (data-context): ${contextStr}`;
    drawerTokensPre.textContent = `Inherited Site DNA for domain "${siteData.domain}":\n${siteData.cssVars}\nEstablished Brand: "${siteData.brand}"\nSite Memory: Persisting established navbar & palette`;
    drawerTurnPre.textContent = `[NAVIGATION & LINK INTENT]\n- Target URL: ${targetUrl}\n- Clicked Item Title: "${cardTitle}"\n- Active Lens: [${activeLens}]\n- Handed to LLM: Preserves narrative and visual continuity`;
    coherenceDrawer.classList.add("open");
  }

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener("click", () => {
      coherenceDrawer.classList.remove("open");
    });
  }

  // 4. Lens and Route Switchers
  if (lensSelect) {
    lensSelect.addEventListener("change", () => {
      activeLens = lensSelect.value;
      renderSimulator();
      showToast(`Browsing Lens switched to: ${activeLens}`);
    });
  }

  routeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      routeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeRoute = btn.getAttribute("data-route");
      if (omniboxInput) omniboxInput.value = activeRoute;
      renderSimulator();
    });
  });

  if (omniboxInput) {
    omniboxInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        activeRoute = omniboxInput.value.trim() || "https://news.ycombinator.com";
        renderSimulator();
        showToast(`Navigated to: ${activeRoute}`);
      }
    });
  }

  // 5. Extension Drawer Toggle
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

  // 6. Live Web Audio Synthesizer (Zero-dependency procedural sound audition)
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

  if (auditionAudioBtn) {
    auditionAudioBtn.addEventListener("click", () => {
      try {
        const ctx = getAudioContext();
        auditionAudioBtn.classList.add("playing");
        auditionAudioBtn.textContent = "🔊 Auditioning...";

        const now = ctx.currentTime;
        const dur = 2.4;

        if (activeLens === "arcade-8bit" || activeLens === "retro-90s") {
          // 8-bit square wave chiptune arpeggio (C-E-G-B-C5)
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
            osc2.frequency.setValueAtTime(freq * 1.008, now); // Detuned

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

  // 7. Interactive CLI Command & .env Generator
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
      { id: "gpt-6-sol", name: "GPT-6 Sol (Default)" },
      { id: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
      { id: "gpt-6-luna", name: "GPT-6 Luna" },
    ],
    anthropic: [
      { id: "claude-sonnet-5-5", name: "Claude 5.5 Sonnet (Default)" },
      { id: "claude-opus-5-5", name: "Claude 5.5 Opus" },
      { id: "claude-haiku-5-5", name: "Claude 5.5 Haiku" },
    ],
    groq: [
      { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Default)" },
      { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B" },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
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

    let parts = ["npx fauxmium"];
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

    // Generate .env
    const envLines = [];
    if (provider === "gemini") envLines.push("GEMINI_API_KEY=your_gemini_api_key");
    if (provider === "openai") envLines.push("OPENAI_API_KEY=your_openai_api_key");
    if (provider === "anthropic") envLines.push("ANTHROPIC_API_KEY=your_anthropic_api_key");
    if (provider === "groq") envLines.push("GROQ_API_KEY=your_groq_api_key");
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

  // Initialize
  renderSimulator();
  updateModelOptions();
});
