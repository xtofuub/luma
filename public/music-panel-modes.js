(() => {
  'use strict';

  const MODE_KEY = 'luma-music-panel-mode-v2';
  const MODES = new Set(['expanded', 'mini', 'hidden']);
  const MODE_CLASSES = ['luma-music-mode-expanded', 'luma-music-mode-mini', 'luma-music-mode-hidden'];

  let mode = MODES.has(localStorage.getItem(MODE_KEY))
    ? localStorage.getItem(MODE_KEY)
    : 'expanded';
  let drawer = null;
  let shell = null;
  let header = null;
  let drawerObserver = null;
  let connectObserver = null;

  const ICONS = {
    expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/><path d="m3 8 6-6M21 8l-6-6M3 16l6 6M21 16l-6 6"/>',
    mini: '<path d="M4 7h16M6 17h12"/><path d="M8 11h8v3H8z"/>',
    hide: '<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10.4 10.4 0 0 1 12 4c5.2 0 9 5 9 8a9.8 9.8 0 0 1-2.1 3.7M6.6 6.6C4.3 8 3 10.2 3 12c0 3 3.8 8 9 8 1.2 0 2.4-.3 3.4-.8"/>',
  };

  function icon(name, size = 14) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function removeBackdrop() {
    document.querySelectorAll('.luma-music-backdrop').forEach((node) => node.remove());
  }

  function updateModeButtons() {
    document.querySelectorAll('[data-music-panel-mode]').forEach((button) => {
      const active = button.dataset.musicPanelMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function applyMode() {
    document.body.classList.remove(...MODE_CLASSES, 'luma-music-open');
    document.body.classList.add(`luma-music-mode-${mode}`);
    document.body.dataset.musicPanelMode = mode;
    removeBackdrop();

    const trigger = shell?.querySelector('.luma-youtube-trigger');
    if (trigger) {
      trigger.setAttribute('aria-expanded', String(mode !== 'hidden'));
      trigger.title = mode === 'hidden' ? 'Show music panel' : 'Music panel';
    }

    const subtitle = header?.querySelector(':scope > div > div > small');
    if (subtitle) {
      subtitle.textContent = mode === 'expanded'
        ? 'YouTube player · Expanded'
        : mode === 'mini'
          ? 'Mini player'
          : 'YouTube player';
    }

    updateModeButtons();
  }

  function setMode(nextMode, persist = true) {
    if (!MODES.has(nextMode)) return;
    mode = nextMode;
    if (persist) localStorage.setItem(MODE_KEY, mode);
    applyMode();
    window.dispatchEvent(new CustomEvent('luma:music-panel-mode', { detail: { mode } }));
  }

  function bindModeButton(button) {
    if (button.dataset.musicModeBound === 'true') return;
    button.dataset.musicModeBound = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMode(button.dataset.musicPanelMode);
    });
  }

  function createHeaderControls() {
    if (!header) return;

    const originalClose = header.querySelector('[data-action="close-drawer"]');
    if (originalClose) originalClose.hidden = true;

    let controls = header.querySelector('.luma-panel-mode-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'luma-panel-mode-controls';
      controls.setAttribute('aria-label', 'Music panel display');
      controls.innerHTML = `
        <button type="button" data-music-panel-mode="expanded" aria-label="Expand music panel" title="Expanded panel">${icon('expand')}</button>
        <button type="button" data-music-panel-mode="mini" aria-label="Minimize music panel" title="Mini player">${icon('mini')}</button>
        <button type="button" data-music-panel-mode="hidden" aria-label="Hide music panel" title="Hide panel">${icon('hide')}</button>`;
      header.appendChild(controls);
    }

    controls.querySelectorAll('[data-music-panel-mode]').forEach(bindModeButton);
  }

  function injectSettingsControls() {
    const settings = drawer?.querySelector('.luma-youtube-settings');
    if (!settings) return;

    let section = settings.querySelector('.luma-panel-display-settings');
    if (!section) {
      section = document.createElement('section');
      section.className = 'luma-panel-display-settings';
      section.innerHTML = `
        <div class="luma-settings-title">
          ${icon('expand', 17)}
          <div><strong>Music panel display</strong><small>Choose how the player appears while you write.</small></div>
        </div>
        <div class="luma-panel-mode-picker" role="group" aria-label="Music panel display mode">
          <button type="button" data-music-panel-mode="expanded"><span>${icon('expand', 15)}</span><strong>Expanded</strong><small>Full right panel</small></button>
          <button type="button" data-music-panel-mode="mini"><span>${icon('mini', 15)}</span><strong>Mini</strong><small>Now playing controls</small></button>
          <button type="button" data-music-panel-mode="hidden"><span>${icon('hide', 15)}</span><strong>Hidden</strong><small>Show only the music button</small></button>
        </div>`;
      settings.prepend(section);
    }

    section.querySelectorAll('[data-music-panel-mode]').forEach(bindModeButton);
    updateModeButtons();
  }

  function bindTrigger() {
    const trigger = shell?.querySelector('.luma-youtube-trigger');
    if (!trigger || trigger.dataset.musicModeBound === 'true') return;
    trigger.dataset.musicModeBound = 'true';
    trigger.addEventListener('click', (event) => {
      if (mode !== 'hidden') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setMode('expanded');
    }, true);
  }

  function connect() {
    drawer = document.querySelector('.luma-music-drawer');
    shell = document.querySelector('.luma-youtube-shell');
    header = drawer?.querySelector('.luma-music-header') || null;
    if (!drawer || !shell || !header) return false;

    removeBackdrop();
    createHeaderControls();
    bindTrigger();
    injectSettingsControls();
    applyMode();

    if (!drawerObserver) {
      drawerObserver = new MutationObserver(() => {
        removeBackdrop();
        injectSettingsControls();
        updateModeButtons();
      });
      drawerObserver.observe(drawer, { childList: true, subtree: true });
    }

    return true;
  }

  window.addEventListener('storage', (event) => {
    if (event.key === MODE_KEY && MODES.has(event.newValue)) setMode(event.newValue, false);
  });

  connectObserver = new MutationObserver(() => {
    removeBackdrop();
    if (!drawer?.isConnected || !shell?.isConnected) connect();
  });
  connectObserver.observe(document.documentElement, { childList: true, subtree: true });

  removeBackdrop();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect, { once: true });
  } else {
    connect();
  }

  window.LumaMusicPanel = Object.freeze({
    getMode: () => mode,
    setMode,
  });
})();
