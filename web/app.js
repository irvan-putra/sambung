// sambung web UI. The checking logic lives in ../sdk/sambung.js; this file
// only wires it to the page. No network calls anywhere.
import { buildBrief, parseReply, TEMPLATES } from "../sdk/sambung.js";

const $ = (id) => document.getElementById(id);
const els = {
  task: $("task"), context: $("context"), template: $("template"),
  customSchemaRow: $("customSchemaRow"), customSchema: $("customSchema"),
  appName: $("appName"), brief: $("brief"), copyBrief: $("copyBrief"),
  shareBrief: $("shareBrief"), reply: $("reply"), checkReply: $("checkReply"),
  status: $("status"), resultBlock: $("resultBlock"), result: $("result"),
  copyResult: $("copyResult"), shareResult: $("shareResult"),
  history: $("history"), clearHistory: $("clearHistory"),
};

const hasBridge = typeof window.SambungBridge !== "undefined";

// --- template picker ---
for (const [key, t] of Object.entries(TEMPLATES)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = t.label;
  els.template.appendChild(opt);
}
const customOpt = document.createElement("option");
customOpt.value = "custom";
customOpt.textContent = "custom JSON shape";
els.template.appendChild(customOpt);
// Default reply shape: the checked JSON list, not the free-text note.
els.template.value = "items";

function currentSchema() {
  if (els.template.value === "custom") {
    const raw = els.customSchema.value.trim();
    if (!raw) return { error: "custom shape is empty" };
    try {
      return { schema: JSON.parse(raw) };
    } catch (e) {
      return { error: "custom shape is not valid JSON: " + e.message };
    }
  }
  return { schema: TEMPLATES[els.template.value].schema };
}

els.template.addEventListener("change", () => {
  els.customSchemaRow.classList.toggle("hidden", els.template.value !== "custom");
  rebuildBrief();
});

// --- brief preview (rebuilt as you type) ---
function rebuildBrief() {
  const task = els.task.value.trim();
  if (!task) {
    els.brief.value = "";
    els.copyBrief.disabled = true;
    els.shareBrief.disabled = true;
    return;
  }
  const { schema, error } = currentSchema();
  if (error) {
    els.brief.value = "(" + error + ")";
    els.copyBrief.disabled = true;
    els.shareBrief.disabled = true;
    return;
  }
  els.brief.value = buildBrief({
    task,
    context: els.context.value,
    replySchema: schema,
    appName: els.appName.value,
  });
  els.copyBrief.disabled = false;
  els.shareBrief.disabled = false;
}
for (const el of [els.task, els.context, els.appName, els.customSchema]) {
  el.addEventListener("input", rebuildBrief);
}

// --- copy / share ---
async function copyText(text, button) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (hasBridge) {
      window.SambungBridge.copyText(text);
    } else {
      throw new Error("no clipboard");
    }
    flash(button, "copied");
  } catch (e) {
    // last resort: select the text so the person can copy by hand
    button.textContent = "select the text above and copy it";
    setTimeout(() => (button.textContent = button.dataset.label), 2500);
  }
}

function shareText(text) {
  if (hasBridge) {
    window.SambungBridge.shareText(text, "sambung brief");
  } else if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    flash(els.shareBrief, "sharing needs the android app");
  }
}

function flash(button, msg) {
  const label = button.dataset.label;
  button.textContent = msg;
  setTimeout(() => (button.textContent = label), 1500);
}
for (const b of [els.copyBrief, els.shareBrief, els.copyResult, els.shareResult]) {
  b.dataset.label = b.textContent;
}

els.copyBrief.addEventListener("click", () => copyText(els.brief.value, els.copyBrief));
els.shareBrief.addEventListener("click", () => shareText(els.brief.value));
els.copyResult.addEventListener("click", () => copyText(els.result.value, els.copyResult));
els.shareResult.addEventListener("click", () => shareText(els.result.value));

// --- reply checking ---
let lastChecked = null;

els.checkReply.addEventListener("click", () => {
  const { schema, error } = currentSchema();
  if (error) {
    showStatus("err", error);
    return;
  }
  const r = parseReply(els.reply.value, schema);
  if (!r.ok) {
    lastChecked = null;
    els.resultBlock.classList.add("hidden");
    showStatus("err", "reply did not pass the check:\n- " + r.errors.join("\n- ") +
      "\n\nnothing was stored or used.");
    return;
  }
  const pretty = schema ? JSON.stringify(r.data, null, 2) : r.data;
  lastChecked = { task: els.task.value.trim(), brief: els.brief.value,
                  reply: els.reply.value, result: pretty, at: new Date().toISOString() };
  els.result.value = pretty;
  els.resultBlock.classList.remove("hidden");
  if (schema) {
    showStatus("ok", "reply passed the check" +
      (r.source !== "whole" ? " (JSON found inside the reply text)" : "") +
      ". review it below before you use it.");
  } else {
    // Plain note mode has no schema, so nothing was validated. Say so
    // plainly instead of implying the text passed a check.
    showStatus("ok", "plain note mode: no reply shape is set, so this reply " +
      "was not checked. the text below is exactly what the assistant sent; " +
      "review it yourself before you use it.");
  }
  saveHistory(lastChecked);
});

function showStatus(kind, msg) {
  els.status.className = kind;
  els.status.id = "status";
  els.status.textContent = msg;
}

// --- history (localStorage only, never leaves the device) ---
const HISTORY_KEY = "sambung.history.v1";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function saveHistory(entry) {
  const all = loadHistory();
  all.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(0, 50)));
  renderHistory();
}

function renderHistory() {
  const all = loadHistory();
  els.history.innerHTML = "";
  els.clearHistory.classList.toggle("hidden", all.length === 0);
  all.forEach((entry, i) => {
    const li = document.createElement("li");
    const when = entry.at.slice(0, 16).replace("T", " ");
    const btn = document.createElement("button");
    btn.textContent = "load";
    btn.addEventListener("click", () => {
      els.task.value = entry.task;
      els.brief.value = entry.brief;
      els.reply.value = entry.reply;
      els.result.value = entry.result;
      els.resultBlock.classList.remove("hidden");
      els.copyBrief.disabled = false;
      els.shareBrief.disabled = false;
      window.scrollTo(0, 0);
    });
    li.appendChild(btn);
    li.appendChild(document.createTextNode(" " + when + " - " +
      (entry.task.length > 60 ? entry.task.slice(0, 60) + "..." : entry.task)));
    els.history.appendChild(li);
  });
}

els.clearHistory.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

// --- inbound share from the android app ---
window.sambungReceive = function (text) {
  els.reply.value = text || "";
  els.reply.focus();
  els.reply.scrollIntoView({ behavior: "smooth", block: "center" });
};

rebuildBrief();
renderHistory();
