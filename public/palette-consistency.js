(() => {
  'use strict';

  const SETTINGS_KEY = 'luma-ambience-settings-v2';
  const PALETTES = {
    paper: { light: '#efeee9', dark: '#161716' },
    sage: { light: '#e7ece6', dark: '#121713' },
    ocean: { light: '#e6edf1', dark: '#10161a' },
    rose: { light: '#f0e8e7', dark: '#181315' },
    lavender: { light: '#ebe8f1', dark: '#15131a' },
    amber: { light: '#f1eadf', dark: '#18150f' },
    midnight: { light: '#dfe4ef', dark: '#0a0d14' },
    obsidian: { light: '#e5e6e4', dark: '#050606' },
  };

  let scheduled = false;

  function readSelectedPalette() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (typeof saved.palette === 'string' && PALETTES[saved.palette]) return saved.palette;
    } catch {}

    const current = document.documentElement.dataset.palette;
    return current && PALETTES[current] ? current : 'paper';
  }

  function syncPalette() {
    scheduled = false;
    const root = document.documentElement;
    const palette = readSelectedPalette();
    const theme = root.dataset.theme === 'dark' ? 'dark' : 'light';

    if (root.dataset.palette !== palette) root.dataset.palette = palette;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && meta.content !== PALETTES[palette][theme]) {
      meta.content = PALETTES[palette][theme];
    }
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncPalette);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('.luma-palette-grid button[data-palette]')) queueMicrotask(scheduleSync);
  });

  window.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_KEY) scheduleSync();
  });

  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-palette'],
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncPalette, { once: true });
  } else {
    syncPalette();
  }
})();
