//////////////////////////////////////
// content.js
//////////////////////////////////////
function getSelectionText() {
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_SELECTION") {
    sendResponse({ ok: true, text: getSelectionText() });
    return true;
  }
  return false;
});
