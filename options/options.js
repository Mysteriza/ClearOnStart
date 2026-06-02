// Options page — render the three sections and wire up
// the on-start / paused toggle, range ledger, target
// checkboxes, and activity log.

const $ = (id) => document.getElementById(id);

const RANGE_LABELS = {
  0:    "Forever",
  hour: "Past hour",
  day:  "Past day",
  week: "Past week"
};

const TRIGGER_LABELS = {
  manual:  "manual",
  onStart: "on start",
  install: "install"
};

let state = null;
let dirty = false;

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function fmtDelta(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function setStatus(mode) {
  const stamp = $("status-stamp");
  stamp.dataset.mode = mode;
  $("status-label").textContent = mode === "onStart" ? "Armed" : "Paused";
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

function renderMode(mode) {
  document.querySelectorAll(".ledger__btn[data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.mode === mode ? "true" : "false");
  });
  setStatus(mode);
}

function renderRange(range) {
  document.querySelectorAll(".ledger__btn[data-range]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.range === String(range) ? "true" : "false");
  });
}

function renderTargets(targets) {
  if (targets) {
    document.querySelectorAll(".check__input[data-target]").forEach((input) => {
      const key = input.dataset.target;
      if (key === "__notify") return;
      input.checked = !!targets[key];
    });
  }
  let count = 0;
  document.querySelectorAll(".check__input[data-target]").forEach((input) => {
    if (input.dataset.target !== "__notify" && input.checked) count++;
  });
  $("targets-counter").textContent = `${count} / 4 armed`;
  return count;
}

function renderNotify(notify) {
  $("opt-notify").checked = !!notify;
}

function renderTheme(theme) {
  document.querySelectorAll(".ledger__btn[data-theme]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.dataset.theme === theme ? "true" : "false");
  });
  applyTheme(theme);
}

function renderLog(log) {
  const table = $("log-table");
  while (table.children.length > 1) table.removeChild(table.lastChild);

  if (!log || log.length === 0) {
    const empty = document.createElement("div");
    empty.className = "log__row--empty";
    empty.textContent = "No activity yet — the manifest is armed but unused.";
    table.appendChild(empty);
    return;
  }

  for (const entry of log) {
    const row = document.createElement("div");
    row.className = "log__row";
    row.setAttribute("role", "row");

    const when = document.createElement("span");
    when.className = "log__cell-when";
    when.innerHTML = `${escapeHtml(fmtTime(entry.startedAt || entry.at))}<small>${escapeHtml(fmtDelta(entry.startedAt || entry.at))}</small>`;

    const trig = document.createElement("span");
    trig.className = "log__cell-trig";
    trig.textContent = TRIGGER_LABELS[entry.trigger] || entry.trigger || "—";

    const status = document.createElement("span");
    if (entry.ok === false) {
      const s = document.createElement("span");
      s.className = "stamp stamp--red";
      s.textContent = entry.reason || "failed";
      status.appendChild(s);
    } else {
      const s = document.createElement("span");
      s.className = "stamp stamp--safe";
      s.textContent = "ok";
      status.appendChild(s);
    }

    row.append(when, trig, status);
    table.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));
}

function renderAll() {
  if (!state) return;
  renderMode(state.mode);
  renderRange(state.timeRange);
  renderTargets(state.targets);
  renderNotify(state.notify);
  renderTheme(state.theme || "auto");
}

function collectFromDom() {
  const targets = { ...state.targets };
  document.querySelectorAll(".check__input[data-target]").forEach((input) => {
    const key = input.dataset.target;
    if (key === "__notify") return;
    targets[key] = input.checked;
  });
  const modeBtn  = document.querySelector(".ledger__btn[data-mode][aria-pressed='true']");
  const rangeBtn = document.querySelector(".ledger__btn[data-range][aria-pressed='true']");
  const themeBtn = document.querySelector(".ledger__btn[data-theme][aria-pressed='true']");
  return {
    mode: modeBtn ? modeBtn.dataset.mode : state.mode,
    timeRange: rangeBtn ? Number(rangeBtn.dataset.range) : state.timeRange,
    targets,
    notify: $("opt-notify").checked,
    theme: themeBtn ? themeBtn.dataset.theme : (state.theme || "auto")
  };
}

function markDirty() {
  if (!dirty) {
    // first time becoming dirty — make sure the user knows saving is manual
    flash("Unsaved — press Save to apply", "warn");
  }
  dirty = true;
  $("save-flash").hidden = true;
  $("dirty-flag").hidden = false;
  $("save-btn").disabled = false;
  $("save-btn").dataset.dirty = "true";
  $("save-btn").textContent = "Save ●";
}

function flash(text, tone = "ok") {
  const el = $("save-flash");
  el.textContent = text;
  el.dataset.tone = tone;
  el.hidden = false;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { el.hidden = true; }, 2400);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".ledger__btn[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => { renderMode(btn.dataset.mode); markDirty(); });
  });
  document.querySelectorAll(".ledger__btn[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => { renderRange(btn.dataset.range); markDirty(); });
  });
  document.querySelectorAll(".ledger__btn[data-theme]").forEach((btn) => {
    btn.addEventListener("click", () => { renderTheme(btn.dataset.theme); markDirty(); });
  });
  document.querySelectorAll(".check__input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.dataset.target !== "__notify") {
        renderTargets();
        if (state) state.targets[input.dataset.target] = input.checked;
      }
      markDirty();
    });
  });

  $("save-btn").addEventListener("click", async () => {
    const next = collectFromDom();
    const btn = $("save-btn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      const res = await chrome.runtime.sendMessage({ type: "cos:save-settings", settings: next });
      if (!res?.ok) throw new Error(res?.error || "save-failed");
      state = next;
      dirty = false;
      $("dirty-flag").hidden = true;
      btn.dataset.dirty = "false";
      btn.textContent = "Save";
      flash("Saved.", "ok");
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Save ●";
      flash("Save failed — " + (e?.message || "unknown"), "err");
    }
  });

  $("clear-now").addEventListener("click", async () => {
    const btn = $("clear-now");
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Clearing…";
    try {
      const res = await chrome.runtime.sendMessage({ type: "cos:clear-now" });
      if (res?.ok && res.result?.ok) {
        flash("Cleared on demand.", "ok");
        const logRes = await chrome.runtime.sendMessage({ type: "cos:get-log" });
        renderLog(logRes?.log || []);
      } else if (res?.result?.reason === "no-targets") {
        flash("No targets armed.", "err");
      } else {
        flash("Clear failed.", "err");
      }
    } catch {
      flash("Clear failed.", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  $("clear-log").addEventListener("click", async () => {
    if (!confirm("Clear all activity log? This cannot be undone.")) return;
    await chrome.runtime.sendMessage({ type: "cos:clear-log" });
    renderLog([]);
    flash("Log cleared.", "ok");
  });

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg?.type === "cos:cleared") {
      const logRes = await chrome.runtime.sendMessage({ type: "cos:get-log" });
      renderLog(logRes?.log || []);
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Leave anyway?";
      return "You have unsaved changes. Leave anyway?";
    }
  });

  (async () => {
    const [settingsRes, logRes] = await Promise.all([
      chrome.runtime.sendMessage({ type: "cos:get-settings" }),
      chrome.runtime.sendMessage({ type: "cos:get-log" })
    ]);
    if (!settingsRes?.ok) return;
    state = settingsRes.settings;
    renderAll();
    renderLog(logRes?.log || []);
  })();
});
