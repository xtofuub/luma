(() => {
  'use strict';

  const SETTINGS_KEY = 'luma-ambience-settings-v2';
  const EXTENDED_KEY = 'luma-extended-palette-v1';
  const EXTENDED = {
    midnight: {
      label: 'Midnight',
      preview: ['#dfe4ef', '#eef1f7', '#6476a6'],
      light: '#dfe4ef',
      dark: '#0a0d14',
    },
    obsidian: {
      label: 'Obsidian',
      preview: ['#111212', '#070808', '#74c7d4'],
      light: '#e5e6e4',
      dark: '#050606',
    },
  };

  let scheduled = false;

  function iconCheck() {
    return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  }

  function selectedExtendedPalette() {
    const value = localStorage.getItem(EXTENDED_KEY);
    return value && EXTENDED[value] ? value : '';
  }

  function updateStoredPalette(id) {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      settings.palette = id;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ palette: id }));
    }
  }

  function applyExtendedPalette() {
    const id = selectedExtendedPalette();
    if (!id) return;
    const root = document.documentElement;
    if (root.dataset.palette !== id) root.dataset.palette = id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = root.dataset.theme === 'dark' ? EXTENDED[id].dark : EXTENDED[id].light;
  }

  function createButton(id, palette) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'palette';
    button.dataset.palette = id;
    button.className = 'luma-extended-palette';
    button.innerHTML = `<i>${palette.preview.map((color) => `<b style="background:${color}"></b>`).join('')}</i><span>${palette.label}</span>${iconCheck()}`;
    return button;
  }

  function updateButtons() {
    const selected = selectedExtendedPalette();
    const grid = document.querySelector('.luma-palette-grid');
    if (!grid) return;

    Object.entries(EXTENDED).forEach(([id, palette]) => {
      if (!grid.querySelector(`[data-palette="${id}"]`)) grid.appendChild(createButton(id, palette));
    });

    if (selected) {
      grid.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.palette === selected));
    }
  }

  function sync() {
    scheduled = false;
    updateButtons();
    applyExtendedPalette();
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.luma-palette-grid button[data-palette]');
    if (!button) return;
    const id = button.dataset.palette;
    if (EXTENDED[id]) {
      localStorage.setItem(EXTENDED_KEY, id);
      updateStoredPalette(id);
      queueMicrotask(sync);
    } else {
      localStorage.removeItem(EXTENDED_KEY);
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === EXTENDED_KEY || event.key === SETTINGS_KEY) scheduleSync();
  });

  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-theme', 'data-palette'],
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
