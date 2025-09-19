/* global chrome */
const contextText = document.getElementById('contextText');
const questionText = document.getElementById('questionText');
const maxInput = document.getElementById('max');
const sendBtn = document.getElementById('sendBtn');
const btnUseSelection = document.getElementById('btnUseSelection');
const btnPasteClipboard = document.getElementById('btnPasteClipboard');
const statusEl = document.getElementById('status');
const replyBox = document.getElementById('replyBox');
const strictToggle = document.getElementById('strictContext');

function showStatus(msg, kind = 'info') {
  if (!statusEl) return;
  const colors = {
    pending: '#555',
    ok: '#0a7f2e',
    error: '#b00020',
    warn: '#f59e0b',
  };
  statusEl.textContent = msg;
  statusEl.style.color = colors[kind] || '#555';
}

// --- Token estimation utilities ---
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function updateTokenSummary() {
  const ctx = (contextText && contextText.value) || '';
  const q = (questionText && questionText.value) || '';

  const tCtx = estimateTokens(ctx);
  const tQ = estimateTokens(q);
  const tTotal = tCtx + tQ;

  const ctxOut = document.getElementById('tokensContext');
  const qOut = document.getElementById('tokensQuestion');
  const totOut = document.getElementById('tokensTotal');

  if (ctxOut) ctxOut.textContent = String(tCtx);
  if (qOut) qOut.textContent = String(tQ);
  if (totOut) totOut.textContent = String(tTotal);
}

function showError(msg) {
  if (replyBox) replyBox.textContent = `Error: ${msg}`;
}

function showReply(text) {
  if (replyBox) replyBox.textContent = text || '(no reply)';
}

function setBusy(busy) {
  if (sendBtn) {
    sendBtn.disabled = !!busy;
    sendBtn.textContent = busy ? 'Sending…' : 'Send';
  }
}

btnUseSelection?.addEventListener('click', async () => {
  showStatus('Reading selection…', 'pending');
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'POPUP_GET_SELECTION' });
    if (resp?.ok) {
      contextText.value = resp.text || '';
      updateTokenSummary();
      if (!resp.text) {
        showStatus('No text selected. Highlight on the page first.', 'warn');
      } else {
        showStatus('Selection captured.', 'ok');
      }
      contextText.focus();
    } else if (resp?.pdfHint) {
      showStatus(resp.error || 'Selection unavailable. Use “Paste from Clipboard”.', 'warn');
    } else {
      showStatus(resp?.error || 'Failed to read selection.', 'error');
    }
  } catch (e) {
    showStatus('Failed to read selection.', 'error');
  }
});

btnPasteClipboard?.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text?.trim()) {
      contextText.value = text;
      updateTokenSummary();
      showStatus('Pasted from clipboard.', 'ok');
    } else {
      showStatus('Clipboard is empty.', 'warn');
    }
  } catch (e) {
    showStatus('Clipboard access denied. Allow permission then click again.', 'error');
  }
});

if (contextText) {
  contextText.addEventListener('input', updateTokenSummary);
  contextText.addEventListener('change', updateTokenSummary);
}
if (questionText) {
  questionText.addEventListener('input', updateTokenSummary);
  questionText.addEventListener('change', updateTokenSummary);
}

sendBtn?.addEventListener('click', async () => {
  const context = (contextText?.value || '').trim();
  const question = (questionText?.value || '').trim();
  const strict = !!strictToggle?.checked;

  if (!context || !question) {
    showError('Please provide both context and a question.');
    return;
  }

  setBusy(true);
  showStatus('Sending…', 'pending');
  showReply('');

  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'CHAT_WITH_CONTEXT',
      context,
      question,
      strict,
    });

    if (resp?.error) {
      showError(resp.error);
      showStatus('Failed.', 'error');
    } else {
      showReply(resp?.text || resp?.reply || '(no reply)');
      showStatus('Reply received.', 'ok');
    }
  } catch (e) {
    showError(e?.message || 'Request failed');
    showStatus('Failed.', 'error');
  } finally {
    setBusy(false);
  }
});

updateTokenSummary();
