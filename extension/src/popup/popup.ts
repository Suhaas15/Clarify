const SERVER = 'https://clarify.clarify-ai.workers.dev';

const askBtn = document.getElementById('ask') as HTMLButtonElement | null;
const q = document.getElementById('q') as HTMLTextAreaElement | null;
const all = document.getElementById('all') as HTMLInputElement | null;
const out = document.getElementById('answer') as HTMLDivElement | null;

askBtn?.addEventListener('click', async () => {
  const query = (q?.value || '').trim();
  if (!query || !out) return;

  out.textContent = 'Thinking…';

  try {
    // get current tab URL to help backend bias retrieval later
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const body = {
      q: query,
      scope: all?.checked ? 'collection' : 'current',
      contextUrl: tab?.url || ''
    };

    const res = await fetch(`${SERVER}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Server error (${res.status}): ${t || res.statusText}`);
    }

    const data = await res.json();
    renderAnswer(data);
  } catch (err: any) {
    out.innerHTML =
      'Could not reach the server.\n\n' +
      'Make sure the Clarify Worker is reachable at https://clarify.clarify-ai.workers.dev.\n' +
      `\nDetails: ${err?.message || err}`;
  }
});

function renderAnswer(data: any) {
  if (!out) return;
  const { answer, citations } = data || {};
  const srcList =
    Array.isArray(citations) && citations.length
      ? '<ul>' +
        citations
          .map((c: any) => `<li>${escapeHtml(c?.title || c?.docId || 'Source')}${c?.page ? ` (p.${c.page})` : ''}</li>`)
          .join('') +
        '</ul>'
      : '<em>No citations returned.</em>';

  out.innerHTML = `
    <div>${escapeHtml(answer || 'No answer')}</div>
    <h3>Sources</h3>
    ${srcList}
  `;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
