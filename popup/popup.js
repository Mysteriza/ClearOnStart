// Popup — compact view. Shows what will be wiped, lets you
// trigger a manual clear, and offers a quick pause/resume
// toggle for the automatic wipe.

const DEFAULTS = {
  mode: "onStart",
  targets: { history: true, cache: true, downloads: true, formData: true },
  timeRange: 0,
  notify: false,
  theme: "auto"
};

const TARGETS = [
  { key: "history",   code: "history",  label: "Browsing history" },
  { key: "cache",     code: "cache",    label: "Cached images & files" },
  { key: "downloads", code: "download", label: "Download history" },
  { key: "formData",  code: "forms",    label: "Autofill form data" }
];

const RANGE_LABELS = {
  0:    "Forever",
  hour: "Past hour",
  day:  "Past 24 hours",
  week: "Past week"
};

const SW_TIMEOUT_MS = 1500;

const $ = (id) => document.getElementById(id);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("sw-timeout")), ms))
  ]);
}

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function setMode(mode) {
  const stamp = $("mode-stamp");
  stamp.dataset.mode = mode;
  $("mode-label").textContent = mode === "onStart" ? "Armed" : "Paused";
}

function setLead(mode, count) {
  const noun = count === 1 ? "category" : "categories";
  $("targets-count").textContent = String(count);
  $("targets-noun").textContent = noun;
  $("lead-text").dataset.empty = count === 0 ? "true" : "false";
  if (count === 0) {
    $("lead-prefix").textContent = "Nothing armed.";
    $("lead-suffix").textContent = "Enable a target in settings to arm a wipe.";
  } else if (mode === "onStart") {
    $("lead-prefix").textContent = "Will clear";
    $("lead-suffix").textContent = "next time Chrome opens.";
  } else {
    $("lead-prefix").textContent = "Paused — Clear now wipes";
    $("lead-suffix").textContent = "on demand.";
  }
}

function applyTheme(theme) {
  try {
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("cos-theme", theme);
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.setItem("cos-theme", "auto");
    }
  } catch (e) {}
}

function renderTargets(targets) {
  const list = $("target-list");
  list.innerHTML = "";
  let count = 0;
  for (const t of TARGETS) {
    const on = !!targets[t.key];
    if (on) count++;
    const li = document.createElement("li");
    if (!on) li.classList.add("is-off");
    li.innerHTML = `
      <span><span class="popup__target-code">${t.code}</span>${t.label}</span>
      <span class="popup__target-mark ${on ? "on" : "off"}">${on ? "● armed" : "○ idle"}</span>
    `;
    list.appendChild(li);
  }
  return count;
}

async function refresh() {
  let settings = DEFAULTS;
  let log = [];
  try {
    const [settingsRes, logRes] = await Promise.all([
      withTimeout(chrome.runtime.sendMessage({ type: "cos:get-settings" }), SW_TIMEOUT_MS),
      withTimeout(chrome.runtime.sendMessage({ type: "cos:get-log" }), SW_TIMEOUT_MS)
    ]);
    if (settingsRes?.ok) settings = settingsRes.settings;
    if (logRes?.ok) log = logRes.log || [];
  } catch (e) {
    // service worker may be cold or slow to wake — keep DEFAULTS so the UI
    // is still readable instead of showing a blank target list.
  }

  setMode(settings.mode);
  const count = renderTargets(settings.targets);
  setLead(settings.mode, count);
  $("range-label").textContent  = RANGE_LABELS[settings.timeRange] || "Forever";
  $("notify-state").textContent = settings.notify ? "on" : "off";
  applyTheme(settings.theme || "auto");

  const last = log[0];
  $("last-cleared").textContent = last ? fmtTime(last.startedAt || last.at) : "—";
}

function flash(msg, tone = "ok") {
  const el = $("popup-note");
  el.textContent = msg;
  el.dataset.tone = tone;
  el.hidden = false;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { el.hidden = true; }, 2400);
}

async function doClear() {
  const btn = $("clear-now");
  btn.disabled = true;
  btn.dataset.running = "true";
  const orig = btn.textContent;
  btn.textContent = "Clearing";
  try {
    const res = await chrome.runtime.sendMessage({ type: "cos:clear-now" });
    if (res?.ok && res.result?.ok) {
      flash("Cleared.", "ok");
    } else if (res?.ok && res.result?.reason === "no-targets") {
      flash("Nothing armed — enable targets in settings.", "err");
    } else {
      flash("Clear failed.", "err");
    }
  } catch {
    flash("Clear failed.", "err");
  } finally {
    btn.disabled = false;
    btn.dataset.running = "false";
    btn.textContent = orig;
    refresh();
  }
}

async function toggleMode() {
  try {
    const res = await withTimeout(
      chrome.runtime.sendMessage({ type: "cos:get-settings" }),
      SW_TIMEOUT_MS
    );
    if (!res?.ok) return;
    const next = { ...res.settings, mode: res.settings.mode === "onStart" ? "off" : "onStart" };
    await chrome.runtime.sendMessage({ type: "cos:save-settings", settings: next });
    refresh();
  } catch (e) {
    flash("Toggle failed.", "err");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("clear-now").addEventListener("click", doClear);
  $("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("mode-stamp").addEventListener("click", toggleMode);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "cos:cleared") {
      const last = msg.entry;
      $("last-cleared").textContent = fmtTime(last.startedAt);
      const n = last.items?.length || 0;
      flash(`Cleared ${n} ${n === 1 ? "category" : "categories"}.`, "ok");
      refresh();
    }
  });

  refresh();
});
