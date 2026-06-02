// ClearOnStart — service worker
// Wipes browsing data when Chrome starts (chrome.runtime.onStartup).
// Settings live in chrome.storage.sync; the activity log lives in
// chrome.storage.local. The popup and options page talk to this
// worker through the message channel below.

const STORAGE_KEY = "cos_settings_v1";
const LOG_KEY     = "cos_log_v1";

const DEFAULTS = Object.freeze({
  mode: "onStart",
  targets: {
    history: true,
    cache: true,
    downloads: true,
    formData: true
  },
  timeRange: 0,
  notify: false,
  theme: "auto"
});

const TIME_RANGES = Object.freeze({
  0:    "the beginning of time",
  hour: "the past hour",
  day:  "the past 24 hours",
  week: "the past week"
});

function msForRange(key) {
  switch (key) {
    case "hour": return 60 * 60 * 1000;
    case "day":  return 24 * 60 * 60 * 1000;
    case "week": return 7 * 24 * 60 * 1000;
    case 0:      return 0;
    default:     return 0;
  }
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return deepMerge(structuredClone(DEFAULTS), stored[STORAGE_KEY] || {});
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

function deepMerge(base, override) {
  if (Array.isArray(override)) return override.slice();
  if (override && typeof override === "object") {
    const out = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = deepMerge(base[key], override[key]);
    }
    return out;
  }
  return override === undefined ? base : override;
}

async function appendLog(entry) {
  const { [LOG_KEY]: log = [] } = await chrome.storage.local.get(LOG_KEY);
  log.unshift({ ...entry, at: Date.now() });
  await chrome.storage.local.set({ [LOG_KEY]: log.slice(0, 25) });
}

function buildRemovalOptions(targets) {
  return {
    appcache:    !!targets.cache,
    cache:       !!targets.cache,
    downloads:   !!targets.downloads,
    formData:    !!targets.formData,
    history:     !!targets.history
  };
}

async function performClear(trigger) {
  const settings = await loadSettings();
  const active = Object.entries(settings.targets).filter(([, v]) => v).map(([k]) => k);
  if (active.length === 0) {
    await appendLog({ trigger, ok: false, reason: "no-targets", items: [] });
    return { ok: false, reason: "no-targets" };
  }

  const since = msForRange(settings.timeRange);
  const options = buildRemovalOptions(settings.targets);
  if (options.history) options.cache = true;

  const startedAt = Date.now();
  let ok = true;
  let error = null;
  try {
    await chrome.browsingData.remove({ since }, options);
  } catch (e) {
    ok = false;
    error = e?.message || String(e);
  }
  const finishedAt = Date.now();

  const entry = {
    trigger,
    ok,
    error,
    startedAt,
    finishedAt,
    range: settings.timeRange,
    items: active
  };
  await appendLog(entry);

  if (ok && settings.notify) {
    const total = active.length;
    chrome.notifications.create(`cleared-${finishedAt}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: trigger === "manual" ? "Cleared on demand" : "ClearOnStart — wiped",
      message: `${total} ${total === 1 ? "category" : "categories"} cleared (${trigger}).`,
      priority: 0
    });
  }

  chrome.runtime.sendMessage({ type: "cos:cleared", entry }).catch(() => {});

  return { ok, error };
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const existing = await chrome.storage.sync.get(STORAGE_KEY);
  if (!existing[STORAGE_KEY]) {
    await saveSettings(structuredClone(DEFAULTS));
  }
  await appendLog({ trigger: `install:${reason}`, ok: true, items: [] });
});

chrome.runtime.onStartup.addListener(() => {
  performClear("onStart");
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case "cos:clear-now": {
          const r = await performClear("manual");
          sendResponse({ ok: true, result: r });
          break;
        }
        case "cos:get-settings": {
          sendResponse({ ok: true, settings: await loadSettings() });
          break;
        }
        case "cos:save-settings": {
          await saveSettings(msg.settings);
          sendResponse({ ok: true });
          break;
        }
        case "cos:get-log": {
          const { [LOG_KEY]: log = [] } = await chrome.storage.local.get(LOG_KEY);
          sendResponse({ ok: true, log });
          break;
        }
        case "cos:clear-log": {
          await chrome.storage.local.set({ [LOG_KEY]: [] });
          sendResponse({ ok: true });
          break;
        }
        case "cos:trigger-startup": {
          // Manual invocation of the startup wipe (useful for "Run now"
          // buttons in tests / first-run flows).
          const r = await performClear("onStart");
          sendResponse({ ok: true, result: r });
          break;
        }
        default:
          sendResponse({ ok: false, error: "unknown-message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();
  return true;
});
