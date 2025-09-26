chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'GET_SELECTION') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return sendResponse({ ok: false, error: 'No active tab' });
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => (window.getSelection?.()?.toString?.() || '')
        });
        return sendResponse({ ok: true, text: result || '' });
      }

      if (msg?.type === 'CHAT') {
        const { context, question, max_tokens, strict } = msg.payload || {};
        const res = await fetch('http://localhost:8787/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: question }],
            context,
            max_tokens,
            strict
          })
        });
        if (!res.ok) {
          const body = await res.text();
          return sendResponse({ ok: false, error: `${res.status} ${res.statusText}: ${body}` });
        }
        const data = await res.json();
        return sendResponse({ ok: true, content: data.content ?? '' });
      }

      return sendResponse({ ok: false, error: 'Unknown message type' });
    } catch (e) {
      return sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true;
});
