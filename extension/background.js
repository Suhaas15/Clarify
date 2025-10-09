const CHAT_URL = 'http://localhost:8787/chat';
let lastSelection = '';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_SELECTION') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ ok: false, error: 'No active tab' });
          return;
        }
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => (window.getSelection?.()?.toString?.() || '')
        });
        lastSelection = result || '';
        sendResponse({ ok: true, text: result || '' });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'clarify:get-last-selection') {
    sendResponse?.({ text: lastSelection });
    return false;
  }

  if (msg?.type === 'clarify:popup-unload') {
    lastSelection = '';
    sendResponse?.({ ok: true });
    return false;
  }

  if (msg?.type === 'clarify:chat') {
    (async () => {
      try {
        const payload = {
          question: msg.question ?? '',
          context: msg.context ?? '',
          fromContext: !!msg.fromContext,
          max: msg.max ?? 512,
        };

        const r = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!r.ok) {
          const errBody = await r.text().catch(() => '');
          sendResponse({ error: `Backend error ${r.status}: ${errBody.slice(0, 500)}` });
          return;
        }

        const data = await r.json();
        sendResponse({ content: data?.content ?? '' });
      } catch (e) {
        sendResponse({ error: e?.message || 'Failed to fetch' });
      }
    })();

    return true;
  }

  return false;
});
