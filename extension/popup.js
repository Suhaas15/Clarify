const API_BASE = 'https://clarify.clarify-ai.workers.dev';
const DEFAULT_MAX_TOKENS = 1024;

function resetEphemeralFields() {
  const ctx = document.getElementById('context');
  const q = document.getElementById('question');
  const fromCtx = document.getElementById('fromContext');
  const ans = document.getElementById('answer');
  const status = document.getElementById('status');
  const sCtx = document.getElementById('sCtx');
  const sQ = document.getElementById('sQ');
  const tokenDisplay = document.getElementById('tokenCount');

  if (ctx) ctx.value = '';
  if (q) q.value = '';
  if (fromCtx) fromCtx.checked = false;
  if (ans) {
    ans.value = '';
    ans.scrollTop = 0;
  }
  if (status) status.textContent = '';
  if (sCtx) sCtx.textContent = '0';
  if (sQ) sQ.textContent = '0';
  if (tokenDisplay) tokenDisplay.textContent = '0';
}

document.addEventListener('DOMContentLoaded', () => {
  resetEphemeralFields();

  const contextEl = document.getElementById('context');
  const questionEl = document.getElementById('question');
  const answerEl = document.getElementById('answer');
  const statusEl = document.getElementById('status');
  const fromCtxEl = document.getElementById('fromContext');
  const maxTokEl = document.getElementById('maxTokens');
  const sendBtn = document.getElementById('sendBtn');
  const btnUse = document.getElementById('btnUse');
  const btnPaste = document.getElementById('btnPaste');
  const sCtx = document.getElementById('sCtx');
  const sQ = document.getElementById('sQ');
  const tokenCount = document.getElementById('tokenCount');

  if (!contextEl || !questionEl || !answerEl || !fromCtxEl || !maxTokEl || !sendBtn || !btnUse || !btnPaste || !sCtx || !sQ || !tokenCount) {
    return;
  }

  const approxTokens = (txt = '') => {
    if (!txt) return 0;
    const byChars = Math.ceil(txt.trim().length / 4);
    const words = txt.trim().match(/\S+/g) || [];
    const byWords = Math.ceil(words.length * 0.75);
    return Math.max(1, Math.min(8192, Math.max(byChars, byWords)));
  };

  const updateStats = () => {
    const c = approxTokens(contextEl.value);
    const q = approxTokens(questionEl.value);
    sCtx.textContent = c;
    sQ.textContent = q;
    tokenCount.textContent = c + q;
  };

  const autoGrow = (ta) => {
    const MAX = 260;
    ta.style.height = 'auto';
    ta.style.overflowY = 'hidden';
    ta.style.height = Math.min(ta.scrollHeight, MAX) + 'px';
    if (ta.scrollHeight > MAX) {
      ta.style.overflowY = 'auto';
    }
  };

  [contextEl, questionEl].forEach((el) => {
    autoGrow(el);
    el.addEventListener('input', () => {
      autoGrow(el);
      updateStats();
    });
  });

  chrome.storage.local.get(['clarify_max', 'clarify_strict'], (data) => {
    if (typeof data?.clarify_max === 'number') {
      maxTokEl.value = Math.min(DEFAULT_MAX_TOKENS, data.clarify_max);
    }
    if (typeof data?.clarify_strict === 'boolean') {
      fromCtxEl.checked = data.clarify_strict;
    }
    updateStats();
  });

  const persistSettings = () => {
    chrome.storage.local.set({
      clarify_max: Math.min(DEFAULT_MAX_TOKENS, Number(maxTokEl.value) || DEFAULT_MAX_TOKENS),
      clarify_strict: !!fromCtxEl.checked
    });
  };

  maxTokEl.addEventListener('change', persistSettings);
  maxTokEl.addEventListener('input', persistSettings);
  fromCtxEl.addEventListener('change', persistSettings);

  btnUse.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'GET_SELECTION' }, (resp) => {
      if (chrome.runtime.lastError) {
        if (statusEl) statusEl.textContent = 'Selection failed: ' + chrome.runtime.lastError.message;
        return;
      }
      const txt = (resp?.text || '').trim();
      if (!txt) {
        if (statusEl) statusEl.textContent = 'No selection detected. Select text then click “Use Selection”';
        return;
      }
      contextEl.value = txt;
      autoGrow(contextEl);
      updateStats();
      if (statusEl) statusEl.textContent = 'Context captured from selection.';
    });
  });

  btnPaste.addEventListener('click', async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!txt) {
        if (statusEl) statusEl.textContent = 'Clipboard is empty. Copy text first.';
        return;
      }
      contextEl.value = txt;
      autoGrow(contextEl);
      updateStats();
      if (statusEl) statusEl.textContent = 'Context pasted from clipboard.';
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Clipboard access denied. Enable clipboard permission for this extension.';
    }
  });

  sendBtn.addEventListener('click', () => {
    (async function handleSendClick() {
      const question = (questionEl?.value || '').trim();
      const context = (contextEl?.value || '').trim();
      const fromContext = !!(fromCtxEl && fromCtxEl.checked);
      const max = Math.max(64, Math.min(4096, Number(maxTokEl?.value || DEFAULT_MAX_TOKENS)));

      if (!question && !context) {
        if (statusEl) statusEl.textContent = 'Please add a question or context.';
        return;
      }

      answerEl.value = '';
      answerEl.scrollTop = 0;
      if (statusEl) statusEl.textContent = 'Sending...';

      try {
        const resp = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, context, fromContext, max })
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data?.error || `HTTP ${resp.status}`);
        }

        const content = (data?.content ?? '').toString();
        answerEl.value = content || '(no reply)';
        answerEl.scrollTop = 0;
        if (statusEl) statusEl.textContent = 'Reply received';
      } catch (err) {
        if (statusEl) statusEl.textContent = `Failed: ${err?.message || err}`;
        answerEl.value = '';
      }
    })();
  });

  questionEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });

  updateStats();

  chrome.runtime?.sendMessage?.({ type: 'clarify:get-last-selection' }, (resp) => {
    if (resp && typeof resp.text === 'string' && !contextEl.value) {
      contextEl.value = resp.text;
      autoGrow(contextEl);
      updateStats();
    }
  });
});

window.addEventListener('beforeunload', () => {
  resetEphemeralFields();
  try { chrome.runtime?.sendMessage?.({ type: 'clarify:popup-unload' }); } catch {}
});
