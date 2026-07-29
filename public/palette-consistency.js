(() => {
  'use strict';

  const SETTINGS_KEY = 'luma-ambience-settings-v2';
  const SELECTION_KEY = 'luma-selected-palette-v2';
  const EXTENDED_KEY = 'luma-extended-palette-v1';
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
  const EXTENDED = new Set(['midnight', 'obsidian']);

  let scheduled = false;

  function validPalette(value) {
    return typeof value === 'string' && Boolean(PALETTES[value]);
  }

  function settingsPalette() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return validPalette(saved.palette) ? saved.palette : '';
    } catch {
      return '';
    }
  }

  function readSelectedPalette() {
    const dedicated = localStorage.getItem(SELECTION_KEY);
    if (validPalette(dedicated)) return dedicated;

    const extended = localStorage.getItem(EXTENDED_KEY);
    if (validPalette(extended)) return extended;

    const saved = settingsPalette();
    if (saved) return saved;

    const current = document.documentElement.dataset.palette;
    return validPalette(current) ? current : 'paper';
  }

  function updateSharedSettings(palette) {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (settings.palette === palette) return;
      settings.palette = palette;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ palette }));
    }
  }

  function persistPalette(palette) {
    if (!validPalette(palette)) return;
    localStorage.setItem(SELECTION_KEY, palette);
    updateSharedSettings(palette);

    if (EXTENDED.has(palette)) localStorage.setItem(EXTENDED_KEY, palette);
    else localStorage.removeItem(EXTENDED_KEY);
  }

  function syncButtons(palette) {
    document.querySelectorAll('.luma-palette-grid button[data-palette]').forEach((button) => {
      button.classList.toggle('active', button.dataset.palette === palette);
    });
  }

  function syncPalette() {
    scheduled = false;
    const root = document.documentElement;
    const palette = readSelectedPalette();
    const theme = root.dataset.theme === 'dark' ? 'dark' : 'light';

    // Migrate older saved palettes to the dedicated key once.
    if (localStorage.getItem(SELECTION_KEY) !== palette) persistPalette(palette);
    if (root.dataset.palette !== palette) root.dataset.palette = palette;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && meta.content !== PALETTES[palette][theme]) {
      meta.content = PALETTES[palette][theme];
    }
    syncButtons(palette);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncPalette);
  }

  // Capture the selection before the palette UI rerenders or another settings
  // script writes its own copy of the shared ambience object.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.luma-palette-grid button[data-palette]');
    if (!button || !validPalette(button.dataset.palette)) return;
    persistPalette(button.dataset.palette);
    queueMicrotask(scheduleSync);
  }, true);

  window.addEventListener('storage', (event) => {
    if ([SELECTION_KEY, SETTINGS_KEY, EXTENDED_KEY].includes(event.key)) scheduleSync();
  });

  new MutationObserver(scheduleSync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-palette'],
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncPalette, { once: true });
  } else {
    syncPalette();
  }
})();
