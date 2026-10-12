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
  const btnClearCache = document.getElementById("btn-clear-cache");
  const btnResetCosts = document.getElementById("btn-reset-costs");
  const btnSaveConfig = document.getElementById("btn-save-config");

  function showBanner(msg, isError = false) {
    statusBannerEl.textContent = msg;
    statusBannerEl.classList.remove("hidden");
    statusBannerEl.style.background = isError ? "#3d1e24" : "#1e3328";
    statusBannerEl.style.color = isError ? "#ff8b94" : "#7ee787";
    statusBannerEl.style.borderColor = isError ? "#f85149" : "#238636";
    setTimeout(() => {
      statusBannerEl.classList.add("hidden");
    }, 2800);
  }

  // Read server host & port from storage
  const storage = await chrome.storage.local.get(["hostname", "port"]);
  const hostname = storage.hostname || "127.0.0.1";
  const port = storage.port || 3001;
  const baseUrl = `http://${hostname}:${port}`;

  lensSelect.addEventListener("change", () => {
    if (lensSelect.value === "custom") {
      customLensInput.classList.remove("hidden");
    } else {
      customLensInput.classList.add("hidden");
    }
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
        showBanner("Configuration saved & active!");
      } else {
        showBanner("Failed to save config", true);
      }
    } catch (e) {
      showBanner(`Error: ${e.message}`, true);
    }
  });

  // Button: Regenerate Active Tab
  btnReload.addEventListener("click", async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs?.[0]?.id) {
        await chrome.tabs.reload(tabs[0].id, { bypassCache: true });
        showBanner("Regenerating active tab...");
      }
    } catch (e) {
      showBanner(`Reload error: ${e.message}`, true);
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
});
