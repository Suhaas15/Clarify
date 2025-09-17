const SERVER = 'http://localhost:8787';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type !== 'INGEST') return;

    const docId = crypto.randomUUID();
    let chunks: { text: string; page?: number }[] = [];
    let title = '', url = '';

    if (msg.payload.kind === 'html') {
      const { text, ...meta } = msg.payload.dom;
      title = meta.title; url = meta.url;
      chunks = chunk(text);
    } else {
      const { textByPage, ...meta } = msg.payload.pdf;
      title = meta.title; url = meta.url;
      textByPage.forEach((t: string, i: number) =>
        chunk(t).forEach(c => chunks.push({ ...c, page: i + 1 }))
      );
    }

    try {
      await fetch(`${SERVER}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, title, url, chunks })
      });
      sendResponse({ ok: true, docId, title, url, count: chunks.length });
    } catch (e: any) {
      sendResponse({ ok: false, error: e?.message || 'embed failed' });
    }
  })();
  return true; // keep channel open for async
});

function chunk(text: string) {
  const words = text.split(/\s+/);
  const size = 900, overlap = 120;
  const out: { text: string }[] = [];
  for (let i = 0; i < words.length; i += (size - overlap)) {
    out.push({ text: words.slice(i, i + size).join(' ') });
  }
  return out;
}
