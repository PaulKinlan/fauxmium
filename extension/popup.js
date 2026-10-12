document.addEventListener("DOMContentLoaded", async () => {
  const totalCostEl = document.getElementById("total-cost");
  const reqCountEl = document.getElementById("req-count");
  const requestsListEl = document.getElementById("requests-list");
  const statusBannerEl = document.getElementById("status-banner");

  const spendTextEl = document.getElementById("spend-text");
  const spendImageEl = document.getElementById("spend-image");
  const spendVideoEl = document.getElementById("spend-video");
  const spendAudioEl = document.getElementById("spend-audio");

  const lensSelect = document.getElementById("lens-select");
  const customLensInput = document.getElementById("custom-lens-input");

  const textModelInput = document.getElementById("text-model-input");
  const imageEnabled = document.getElementById("image-enabled");
  const imageModelInput = document.getElementById("image-model-input");
  const videoEnabled = document.getElementById("video-enabled");
  const videoModelInput = document.getElementById("video-model-input");
  const audioEnabled = document.getElementById("audio-enabled");
  const audioProviderSelect = document.getElementById("audio-provider-select");

  const btnReload = document.getElementById("btn-reload");
  const btnExport = document.getElementById("btn-export");
  const btnClearCache = document.getElementById("btn-clear-cache");
  const btnResetCosts = document.getElementById("btn-reset-costs");
  const btnSaveConfig = document.getElementById("btn-save-config");

  function showBanner(msg, isError = false) {
    statusBannerEl.textContent = msg;
    statusBannerEl.classList.remove("hidden", "status-error", "status-success");
    statusBannerEl.classList.add(isError ? "status-error" : "status-success");
    statusBannerEl.style.background = "";
    statusBannerEl.style.color = "";
    statusBannerEl.style.borderColor = "";
    setTimeout(() => {
      statusBannerEl.classList.add("hidden");
    }, 2800);
  }

  // Read server host & port from storage
  const storage = await chrome.storage.local.get(["hostname", "port"]);
  const hostname = storage.hostname || "127.0.0.1";
  const port = storage.port || 3001;
  const baseUrl = `http://${hostname}:${port}`;

  async function saveConfig({ silent = false } = {}) {
    try {
      const payload = {
        activeLens: lensSelect.value,
        customLensPrompt: customLensInput.value,
        text: {
          model: textModelInput.value.trim(),
        },
        image: {
          enabled: imageEnabled.checked,
          model: imageModelInput.value.trim(),
        },
        video: {
          enabled: videoEnabled.checked,
          model: videoModelInput.value.trim(),
        },
        audio: {
          enabled: audioEnabled.checked,
          provider: audioProviderSelect.value,
        },
      };

      const res = await fetch(`${baseUrl}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (!silent) showBanner("Configuration saved & active!");
        return true;
      } else {
        if (!silent) showBanner("Failed to save config", true);
        return false;
      }
    } catch (e) {
      if (!silent) showBanner(`Error: ${e.message}`, true);
      return false;
    }
  }

  lensSelect.addEventListener("change", async () => {
    if (lensSelect.value === "custom") {
      customLensInput.classList.remove("hidden");
    } else {
      customLensInput.classList.add("hidden");
    }
    await saveConfig();
  });

  customLensInput.addEventListener("blur", async () => {
    await saveConfig({ silent: true });
  });
  customLensInput.addEventListener("change", async () => {
    await saveConfig({ silent: true });
  });

  imageEnabled.addEventListener("change", async () => {
    await saveConfig();
  });
  videoEnabled.addEventListener("change", async () => {
    await saveConfig();
  });
  audioEnabled.addEventListener("change", async () => {
    await saveConfig();
  });
  audioProviderSelect.addEventListener("change", async () => {
    await saveConfig();
  });

  async function loadConfig() {
    try {
      const res = await fetch(`${baseUrl}/config`);
      if (!res.ok) return;
      const config = await res.json();

      if (config.activeLens) {
        lensSelect.value = config.activeLens;
        if (config.activeLens === "custom") {
          customLensInput.classList.remove("hidden");
          customLensInput.value = config.customLensPrompt || "";
        }
      }

      if (config.text?.model) textModelInput.value = config.text.model;
      if (config.image?.model) imageModelInput.value = config.image.model;
      imageEnabled.checked = config.image?.enabled !== false;

      if (config.video?.model) videoModelInput.value = config.video.model;
      videoEnabled.checked = config.video?.enabled !== false;

      if (config.audio?.provider) audioProviderSelect.value = config.audio.provider;
      audioEnabled.checked = config.audio?.enabled !== false;
    } catch (e) {
      console.warn("Failed to load runtime config:", e);
    }
  }

  async function loadCosts() {
    try {
      const res = await fetch(`${baseUrl}/cost`);
      if (!res.ok) return;
      const data = await res.json();

      totalCostEl.textContent = `$${(data.total || 0).toFixed(6)}`;
      reqCountEl.textContent = data.requests?.length || 0;

      if (data.byModality) {
        spendTextEl.textContent = `$${(data.byModality.text || 0).toFixed(4)}`;
        spendImageEl.textContent = `$${(data.byModality.image || 0).toFixed(4)}`;
        spendVideoEl.textContent = `$${(data.byModality.video || 0).toFixed(4)}`;
        spendAudioEl.textContent = `$${(data.byModality.audio || 0).toFixed(4)}`;
      }

      requestsListEl.innerHTML = "";
      if (!data.requests || data.requests.length === 0) {
        requestsListEl.innerHTML = '<div class="empty-state">No requests recorded yet.</div>';
        return;
      }

      // Show most recent requests first (max 20)
      const recent = [...data.requests].reverse().slice(0, 20);
      for (const req of recent) {
        const row = document.createElement("div");
        row.className = "req-item";

        const badge = document.createElement("span");
        const mod = req.modality || "text";
        badge.className = `req-badge badge-${mod}`;
        badge.textContent = req.cached ? `${mod} ⚡` : mod;

        const urlSpan = document.createElement("span");
        urlSpan.className = "req-url";
        urlSpan.textContent = req.url.replace(/^https?:\/\//, "");
        urlSpan.title = `${req.url} (${req.model})`;

        const costSpan = document.createElement("span");
        costSpan.className = "req-cost";
        costSpan.textContent = req.cached ? "$0.00 (cache)" : `$${req.cost.toFixed(5)}`;

        row.appendChild(badge);
        row.appendChild(urlSpan);
        row.appendChild(costSpan);
        requestsListEl.appendChild(row);
      }
    } catch (e) {
      totalCostEl.textContent = "Offline";
      console.warn("Failed to fetch costs:", e);
    }
  }

  // Button: Save & Apply Configuration
  btnSaveConfig.addEventListener("click", async () => {
    await saveConfig();
  });

  // Button: Regenerate Active Tab
  btnReload.addEventListener("click", async () => {
    try {
      await saveConfig({ silent: true });
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs?.[0]?.id) {
        await chrome.tabs.reload(tabs[0].id, { bypassCache: true });
        showBanner("Regenerating active tab...");
      }
    } catch (e) {
      showBanner(`Reload error: ${e.message}`, true);
    }
  });

  // Button: Export Current Page
  btnExport?.addEventListener("click", async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = tabs?.[0]?.url;
      if (!currentUrl) {
        showBanner("No active tab URL found", true);
        return;
      }
      showBanner("Bundling page export...");
      const exportUrl = `${baseUrl}/export?url=${encodeURIComponent(currentUrl)}&download=1`;
      if (chrome.downloads?.download) {
        await chrome.downloads.download({
          url: exportUrl,
          filename: "fauxmium-export.html",
          saveAs: true,
        });
      } else {
        window.open(exportUrl, "_blank");
      }
      showBanner("Export started!");
    } catch (e) {
      showBanner(`Export error: ${e.message}`, true);
    }
  });

  // Button: Clear Cache
  btnClearCache.addEventListener("click", async () => {
    try {
      const res = await fetch(`${baseUrl}/cache/clear`, { method: "POST" });
      if (res.ok) {
        showBanner("Cache cleared!");
      }
    } catch (e) {
      showBanner(`Clear cache error: ${e.message}`, true);
    }
  });

  // Button: Reset Costs
  btnResetCosts.addEventListener("click", async () => {
    try {
      const res = await fetch(`${baseUrl}/cost/reset`, { method: "POST" });
      if (res.ok) {
        await loadCosts();
        showBanner("Costs reset!");
      }
    } catch (e) {
      showBanner(`Reset error: ${e.message}`, true);
    }
  });

  // Initial load
  await loadConfig();
  await loadCosts();

  // Dynamic Toolbar Icon Theme Adaptation
  function renderCanvasIcon(ctx, size, isDark) {
    ctx.clearRect(0, 0, size, size);
    const center = size / 2;
    const r = size * 0.42;

    // High contrast outer ring
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? "#60a5fa" : "#2563eb";
    ctx.lineWidth = Math.max(1.5, size * 0.1);
    ctx.stroke();

    // Accent arcs
    ctx.beginPath();
    ctx.arc(center, center, r, -Math.PI / 2, 0);
    ctx.strokeStyle = "#10b981";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, r, Math.PI, -Math.PI / 2);
    ctx.strokeStyle = "#f43f5e";
    ctx.stroke();

    // Central diamond spark
    ctx.beginPath();
    ctx.moveTo(center, center - r * 0.65);
    ctx.lineTo(center + r * 0.45, center);
    ctx.lineTo(center, center + r * 0.65);
    ctx.lineTo(center - r * 0.45, center);
    ctx.closePath();
    ctx.fillStyle = isDark ? "#ffffff" : "#1e293b";
    ctx.fill();

    // Center core dot
    ctx.beginPath();
    ctx.arc(center, center, Math.max(1, size * 0.08), 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#2563eb" : "#ffffff";
    ctx.fill();
  }

  function updateToolbarIcon(isDark) {
    if (!chrome?.action?.setIcon) return;
    try {
      const canvas16 = document.createElement("canvas");
      canvas16.width = 16;
      canvas16.height = 16;
      const ctx16 = canvas16.getContext("2d");
      renderCanvasIcon(ctx16, 16, isDark);

      const canvas32 = document.createElement("canvas");
      canvas32.width = 32;
      canvas32.height = 32;
      const ctx32 = canvas32.getContext("2d");
      renderCanvasIcon(ctx32, 32, isDark);

      chrome.action.setIcon({
        imageData: {
          16: ctx16.getImageData(0, 0, 16, 16),
          32: ctx32.getImageData(0, 0, 32, 32),
        },
      });
    } catch (e) {}
  }

  const darkModeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  updateToolbarIcon(darkModeMedia.matches);
  darkModeMedia.addEventListener("change", (e) => updateToolbarIcon(e.matches));
});
