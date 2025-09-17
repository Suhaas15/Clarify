/* global chrome */
const inputEl = document.getElementById("input");
const maxEl = document.getElementById("max");
const sendBtn = document.getElementById("send");
const btnUseSelection = document.getElementById("btnUseSelection");
const btnPasteClipboard = document.getElementById("btnPasteClipboard");
const statusEl = document.getElementById("status");
const replyEl = document.getElementById("reply");

function setStatus(msg = "", kind = "info") {
  if (!statusEl) return;
  let color;
  if (typeof kind === "boolean") {
    color = kind ? "#c00" : "#0a0";
  } else {
    color =
      kind === "error"
        ? "#c00"
        : kind === "ok"
        ? "#0a0"
        : kind === "warn"
        ? "#f59e0b"
        : "#555";
  }
  statusEl.textContent = msg;
  statusEl.style.color = color;
}

function clearReply() {
  if (replyEl) replyEl.value = "";
}

btnUseSelection?.addEventListener("click", async () => {
  setStatus("Reading selection…");
  try {
    const resp = await chrome.runtime.sendMessage({ type: "POPUP_GET_SELECTION" });
    if (resp?.ok) {
      inputEl.value = resp.text || "";
      if (!resp.text) {
        setStatus("No text selected. Highlight on the page first.", "warn");
      } else {
        setStatus("Selection captured.", "ok");
      }
      inputEl.focus();
    } else if (resp?.pdfHint) {
      setStatus(resp.error || "Selection unavailable. Use “Paste from Clipboard”.", "warn");
    } else {
      setStatus(resp?.error || "Failed to read selection.", "error");
    }
  } catch (e) {
    console.warn(e);
    setStatus("Failed to read selection.", "error");
  }
});

btnPasteClipboard?.addEventListener("click", async () => {
  try {
    const txt = await navigator.clipboard.readText();
    if (txt?.trim()) {
      inputEl.value = txt;
      setStatus("Pasted from clipboard.", "ok");
    } else {
      setStatus("Clipboard is empty.", "warn");
    }
  } catch (e) {
    console.warn(e);
    setStatus("Clipboard access denied. Allow permission then click again.", "error");
  }
});

sendBtn?.addEventListener("click", async () => {
  const text = (inputEl.value || "").trim();
  if (!text) {
    setStatus("Nothing to send.", "warn");
    return;
  }
  setStatus("Sending…");
  clearReply();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.runtime.sendMessage({
      type: "SEND_SELECTION",
      text,
      title: tab?.title || "From Chrome",
      maxTokens: Number(maxEl.value || 0) || undefined,
    });
    if (!res?.ok) throw new Error(res?.error || "Failed");
    if (res.reply) {
      replyEl.value = res.reply;
      setStatus("Sent ✓ Reply received.", "ok");
    } else {
      setStatus("Reply received but empty. Showing raw response.", "warn");
      replyEl.value = res.raw
        ? JSON.stringify(res.raw, null, 2)
        : res.rawText || "(no payload)";
    }
  } catch (e) {
    setStatus("Failed: " + (e?.message || e), "error");
  }
});
