(() => {
  const panel = document.getElementById('clarify-panel');
  const frame = document.getElementById('cp-frame');
  const btnMin = document.getElementById('cp-minimize');

  const launcher = document.getElementById('clarify-launcher');
  const btnLaunch = document.getElementById('cp-launch');
  const btnLaunchClose = document.getElementById('cp-launch-close');

  const STATE_KEY = '__clarify_panel_state__';

  function saveState(v) {
    try {
      sessionStorage.setItem(STATE_KEY, v);
    } catch {}
  }

  function loadState() {
    try {
      return sessionStorage.getItem(STATE_KEY) || 'open';
    } catch {
      return 'open';
    }
  }

  function resizeToContent() {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;

      const root = doc.documentElement;
      const body = doc.body;
      const contentHeight = Math.max(body?.scrollHeight || 0, root?.scrollHeight || 0);
      const max = Math.round(window.innerHeight * 0.9);
      const next = Math.min(Math.max(contentHeight, 360), max);
      frame.style.height = `${next}px`;
    } catch {}
  }

  function attachResizeObserver() {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const obs = new MutationObserver(() => resizeToContent());
      obs.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
      resizeToContent();
      setTimeout(resizeToContent, 200);
      setTimeout(resizeToContent, 600);
    } catch {}
  }

  frame.addEventListener('load', () => {
    attachResizeObserver();
    resizeToContent();
  });

  function showPanel() {
    panel.hidden = false;
    launcher.hidden = true;
    saveState('open');
    resizeToContent();
  }

  function hidePanelToLauncher() {
    panel.hidden = true;
    launcher.hidden = false;
    saveState('hidden');
  }

  function dismissLauncher() {
    launcher.hidden = true;
    saveState('dismissed');
  }

  btnMin.addEventListener('click', hidePanelToLauncher);
  btnLaunch.addEventListener('click', showPanel);
  btnLaunchClose.addEventListener('click', dismissLauncher);

  const init = loadState();
  if (init === 'open') {
    showPanel();
  } else if (init === 'hidden') {
    hidePanelToLauncher();
  } else {
    dismissLauncher();
  }

  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.code === 'KeyC') {
      if (panel.hidden && !launcher.hidden) {
        showPanel();
      } else if (!panel.hidden) {
        hidePanelToLauncher();
      }
    }
  });

  window.addEventListener('message', (ev) => {
    const data = ev?.data;
    if (!data || typeof data !== 'object') return;
    if (data.__clarify === 'open-panel') {
      try {
        document.getElementById('clarify-panel').hidden = false;
        document.getElementById('clarify-launcher').hidden = true;
      } catch {}
    }
    if (data.__clarify === 'hide-panel') {
      try {
        document.getElementById('clarify-panel').hidden = true;
        document.getElementById('clarify-launcher').hidden = false;
      } catch {}
    }
  });
})();
