/* global chrome */
const MENU_ID = "send-to-pdf-reader";
const API_BASES = [
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  "http://[::1]:8787",
];

function isPdfOrRestricted(url = "") {
  if (url.startsWith("chrome-extension://")) return true;
  if (/\.pdf($|\?)/i.test(url)) return true;
  if (url.startsWith("blob:")) return true;
  return false;
}

async function getSelectionFromTab(tabId, url) {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "GET_SELECTION" });
    if (resp?.ok && resp.text) return resp.text;
    if (resp?.ok) return "";
  } catch (_) {
    // content script not available yet
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      func: () => {
        function grab() {
          try {
            const sel = window.getSelection && window.getSelection().toString().trim();
            if (sel) return sel;
            const el = document.activeElement;
            if (
              el &&
              (el.tagName === "TEXTAREA" ||
                (el.tagName === "INPUT" &&
                  /^(text|search|url|tel|password|email|number)$/i.test(el.type)))
            ) {
              const start = el.selectionStart ?? 0;
              const end = el.selectionEnd ?? 0;
              if (end > start) return el.value.substring(start, end).trim();
            }
          } catch (_) {}
          return "";
        }
        return grab();
      },
    });
    if (result?.result) return String(result.result);
  } catch (_) {
    // scripting injection failed (restricted page)
  }

  if (isPdfOrRestricted(url)) return null;
  return "";
}

function getAssistantText(obj) {
  if (!obj || typeof obj !== "object") return "";
  if (typeof obj.content === "string" && obj.content.trim()) return obj.content.trim();
  if (obj.message?.content) return String(obj.message.content).trim();
  if (Array.isArray(obj.choices) && obj.choices[0]?.message?.content)
    return String(obj.choices[0].message.content).trim();
  if (typeof obj.output_text === "string" && obj.output_text.trim()) return obj.output_text.trim();
  if (typeof obj.reply === "string" && obj.reply.trim()) return obj.reply.trim();
  if (Array.isArray(obj.data) && obj.data[0]) {
    const d0 = obj.data[0];
    if (typeof d0.content === "string" && d0.content.trim()) return d0.content.trim();
    if (typeof d0.text === "string" && d0.text.trim()) return d0.text.trim();
  }
  if (Array.isArray(obj.content) && obj.content[0]?.text) {
    const joined = obj.content.map(c => c?.text || "").join("\n").trim();
    if (joined) return joined;
  }
  if (typeof obj.result === "string" && obj.result.trim()) return obj.result.trim();
  if (typeof obj.answer === "string" && obj.answer.trim()) return obj.answer.trim();
  return "";
}

async function fetchJsonWithBases(path, options = {}) {
  let lastErr = null;
  for (const base of API_BASES) {
    try {
      const url = `${base}${path}`;
      console.log("[bg] FETCH", options.method || "GET", url);
      const r = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      });
      const ct = r.headers.get("content-type") || "";
      const rawText = await r.text();
      if (!r.ok) {
        console.warn("[bg] Non-OK", r.status, r.statusText, rawText.slice(0, 300));
        lastErr = new Error(`${r.status} ${r.statusText} | ${rawText.slice(0, 700)}`);
        continue;
      }
      let json = null;
      try { if (/json/i.test(ct)) json = JSON.parse(rawText); } catch (e) {}
      if (!json) {
        lastErr = new Error(`Unexpected content-type: ${ct} | body: ${rawText.slice(0, 300)}`);
        continue;
      }
      return { base, json, rawText };
    } catch (e) {
      console.warn("[bg] fetch failed for base", base, e?.message || e);
      lastErr = e;
      continue;
    }
  }
  throw lastErr || new Error("All bases failed");
}

async function healthCheck(signal) {
  return fetchJsonWithBases("/health", { method: "GET", signal });
}

async function embedText(text, title, signal) {
  const body = JSON.stringify({
    docId: "ext-" + Date.now(),
    title: title || "From Chrome",
    chunks: [{ text }]
  });
  const { base, json } = await fetchJsonWithBases("/embed", { method: "POST", body, signal });
  console.log("[bg] /embed OK via", base, json);
  return json;
}

async function chatText(text, maxTokens, signal) {
  const payload = { messages: [{ role: "user", content: text }] };
  if (maxTokens) payload.max_tokens = Number(maxTokens);
  const body = JSON.stringify(payload);
  const { base, json, rawText } = await fetchJsonWithBases("/chat", { method: "POST", body, signal });
  console.log("[bg] /chat OK via", base);
  const reply = getAssistantText(json);
  return { reply, json, rawText, base };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Send to PDF Reader",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = info.selectionText || "";
  if (!text.trim()) {
    chrome.notifications?.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "PDF Reader",
      message: "No selection detected. Copy text, then use the popup's Paste button.",
    });
    return;
  }
  try {
    await embedText(text, tab?.title || "From page");
    const { reply } = await chatText(`Summarize briefly:\n\n${text}`, 256);
    chrome.notifications?.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "PDF Reader",
      message: reply || "Sent to PDF Reader.",
    });
  } catch (e) {
    chrome.notifications?.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "PDF Reader",
      message: "Send failed: " + (e?.message || e),
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "POPUP_GET_SELECTION") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ ok: false, error: "No active tab." });
          return;
        }
        const text = await getSelectionFromTab(tab.id, tab.url || "");
        if (text === null) {
          sendResponse({
            ok: false,
            pdfHint: true,
            error: "Selection not accessible on this page. For PDFs, click “Paste from Clipboard”.",
          });
          return;
        }
        sendResponse({ ok: true, text: text || "" });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "SEND_SELECTION") {
    (async () => {
      try {
        const { text, title, maxTokens } = msg;
        if (!text?.trim()) {
          sendResponse({ ok: false, error: "No text to send." });
          return;
        }
        try {
          await healthCheck();
        } catch (e) {
          sendResponse({
            ok: false,
            error:
              "Server not reachable at localhost/127.0.0.1/[::1]:8787. Is it running? (" +
              (e?.message || e) +
              ")",
          });
          return;
        }
        try {
          await embedText(text, title);
        } catch (e) {
          console.warn("[bg] embed failed:", e?.message || e);
        }
        const { reply, json, rawText, base } = await chatText(text, maxTokens);
        sendResponse({
          ok: true,
          reply: reply || "",
          raw: json || null,
          rawText: rawText || "",
          base,
        });
      } catch (e) {
        console.error("[bg] SEND_SELECTION error:", e);
        sendResponse({ ok: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  return false;
});
