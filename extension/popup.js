(function(){
  const $ = sel => document.querySelector(sel);
  const ctxEl = $('#ctx');
  const qEl = $('#q');
  const replyEl = $('#reply');
  const btnUse = $('#btnUse');
  const btnPaste = $('#btnPaste');
  const sendBtn = $('#send');
  const strictEl = $('#strict');
  const maxTokEl = $('#maxTok');
  const sCtx = $('#sCtx'), sQ = $('#sQ'), sTot = $('#sTot');

  const approxTokens = (txt='') => {
    if(!txt) return 0;
    const byChars = Math.ceil(txt.trim().length / 4);
    const words = txt.trim().match(/\S+/g) || [];
    const byWords = Math.ceil(words.length * 0.75);
    return Math.max(1, Math.min(8192, Math.max(byChars, byWords)));
  };

  const updateStats = () => {
    const c = approxTokens(ctxEl.value);
    const q = approxTokens(qEl.value);
    sCtx.textContent = c;
    sQ.textContent = q;
    sTot.textContent = c + q;
  };

  const autoGrow = ta => {
    const MAX = 260;
    ta.style.height = 'auto';
    ta.style.overflowY = 'hidden';
    ta.style.height = Math.min(ta.scrollHeight, MAX) + 'px';
    if (ta.scrollHeight > MAX) {
      ta.style.overflowY = 'auto';
    }
  };

  [ctxEl, qEl, replyEl].forEach(el => {
    autoGrow(el);
    el.addEventListener('input', () => { autoGrow(el); updateStats(); });
  });

  chrome.storage.local.get(['clarify_ctx','clarify_q','clarify_max','clarify_strict'], data => {
    if (typeof data.clarify_ctx === 'string') ctxEl.value = data.clarify_ctx;
    if (typeof data.clarify_q === 'string') qEl.value = data.clarify_q;
    if (typeof data.clarify_max === 'number') maxTokEl.value = data.clarify_max;
    if (typeof data.clarify_strict === 'boolean') strictEl.checked = data.clarify_strict;
    [ctxEl, qEl, replyEl].forEach(autoGrow);
    updateStats();
  });

  [ctxEl, qEl, maxTokEl, strictEl].forEach(el => {
    el.addEventListener('change', () => {
      chrome.storage.local.set({
        clarify_ctx: ctxEl.value,
        clarify_q: qEl.value,
        clarify_max: Number(maxTokEl.value) || 512,
        clarify_strict: !!strictEl.checked
      });
    });
  });

  btnUse.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'GET_SELECTION' }, resp => {
      if (chrome.runtime.lastError) {
        replyEl.value = 'Selection failed: ' + chrome.runtime.lastError.message;
        autoGrow(replyEl);
        return;
      }
      const txt = (resp?.text || '').trim();
      if (!txt) {
        replyEl.value = 'No selection detected. Select text then click “Use Selection”';
        autoGrow(replyEl);
        return;
      }
      ctxEl.value = txt;
      autoGrow(ctxEl); updateStats();
    });
  });

  btnPaste.addEventListener('click', async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!txt) {
        replyEl.value = 'Clipboard is empty. Copy text first.';
        autoGrow(replyEl);
        return;
      }
      ctxEl.value = txt;
      autoGrow(ctxEl); updateStats();
    } catch (e) {
      replyEl.value = 'Clipboard access denied. Enable clipboard permission for this extension.';
      autoGrow(replyEl);
    }
  });

  const doSend = () => {
    const context = ctxEl.value.trim();
    const question = qEl.value.trim();
    if (!context || !question) {
      replyEl.value = 'Please provide both context and a question.';
      autoGrow(replyEl);
      return;
    }

    const payload = {
      context,
      question,
      max_tokens: Number(maxTokEl.value) || 512,
      strict: !!strictEl.checked
    };

    sendBtn.disabled = true;
    sendBtn.textContent = '…';

    chrome.runtime.sendMessage({ type: 'CHAT', payload }, resp => {
      sendBtn.disabled = false;
      sendBtn.textContent = '✨ Send';

      if (chrome.runtime.lastError) {
        replyEl.value = 'Failed: ' + chrome.runtime.lastError.message;
        autoGrow(replyEl);
        return;
      }

      if (!resp || resp.error) {
        replyEl.value = 'Error: ' + (resp?.error || 'Unknown error');
        autoGrow(replyEl);
        return;
      }

      replyEl.value = resp.content || '(no reply)';
      autoGrow(replyEl);
    });
  };

  sendBtn.addEventListener('click', doSend);
  qEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSend();
  });

  updateStats();
})();
