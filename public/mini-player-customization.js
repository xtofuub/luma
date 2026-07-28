(() => {
  'use strict';

  const STORAGE_KEY = 'luma-mini-player-preferences-v1';
  const MUSIC_STATE_KEY = 'luma-youtube-music-state-v4';
  const DEFAULTS = {
    size: 'comfortable',
    surface: 'glass',
    position: 'right',
    artwork: true,
    progress: true,
    volume: true,
    glow: true,
  };
  const OPTIONS = {
    size: new Set(['compact', 'comfortable']),
    surface: new Set(['solid', 'glass']),
    position: new Set(['left', 'right']),
  };

  let preferences = loadPreferences();
  let drawer = null;
  let drawerObserver = null;
  let connectObserver = null;
  let syncFrame = 0;

  const ICONS = {
    sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };

  function icon(name, size = 16) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        size: OPTIONS.size.has(saved.size) ? saved.size : DEFAULTS.size,
        surface: OPTIONS.surface.has(saved.surface) ? saved.surface : DEFAULTS.surface,
        position: OPTIONS.position.has(saved.position) ? saved.position : DEFAULTS.position,
        artwork: typeof saved.artwork === 'boolean' ? saved.artwork : DEFAULTS.artwork,
        progress: typeof saved.progress === 'boolean' ? saved.progress : DEFAULTS.progress,
        volume: typeof saved.volume === 'boolean' ? saved.volume : DEFAULTS.volume,
        glow: typeof saved.glow === 'boolean' ? saved.glow : DEFAULTS.glow,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function savePreferences() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }

  function readCurrentTrack() {
    try {
      return JSON.parse(localStorage.getItem(MUSIC_STATE_KEY) || '{}')?.current || null;
    } catch {
      return null;
    }
  }

  function applyPreferences() {
    const body = document.body;
    body.dataset.miniSize = preferences.size;
    body.dataset.miniSurface = preferences.surface;
    body.dataset.miniPosition = preferences.position;
    body.dataset.miniArtwork = String(preferences.artwork);
    body.dataset.miniProgress = String(preferences.progress);
    body.dataset.miniVolume = String(preferences.volume);
    body.dataset.miniGlow = String(preferences.glow);
    updateArtwork();
    updateControls();
  }

  function ensureArtwork() {
    const card = drawer?.querySelector('.luma-youtube-player-card');
    if (!card) return null;
    let artwork = card.querySelector('.luma-mini-artwork');
    if (artwork) return artwork;

    artwork = document.createElement('div');
    artwork.className = 'luma-mini-artwork';
    artwork.setAttribute('aria-hidden', 'true');
    artwork.innerHTML = '<img alt=""><span></span>';
    card.insertBefore(artwork, card.querySelector('.luma-now-playing'));
    return artwork;
  }

  function updateArtwork() {
    const artwork = ensureArtwork();
    if (!artwork) return;
    const track = readCurrentTrack();
    const image = artwork.querySelector('img');
    const hasArtwork = Boolean(track?.thumbnail);
    artwork.classList.toggle('has-image', hasArtwork);
    if (hasArtwork && image.src !== track.thumbnail) image.src = track.thumbnail;
    if (!hasArtwork) image.removeAttribute('src');
  }

  function optionButton(setting, value, label, detail) {
    return `<button type="button" data-mini-setting="${setting}" data-mini-value="${value}"><strong>${label}</strong><small>${detail}</small><i>${icon('check', 12)}</i></button>`;
  }

  function toggleButton(setting, label, detail) {
    return `<button type="button" class="luma-mini-toggle" data-mini-toggle="${setting}" role="switch"><span><strong>${label}</strong><small>${detail}</small></span><i><b></b></i></button>`;
  }

  function injectSettings() {
    const settingsRoot = drawer?.querySelector('.luma-youtube-settings');
    if (!settingsRoot) return;
    let section = settingsRoot.querySelector('.luma-mini-customization');
    if (!section) {
      section = document.createElement('section');
      section.className = 'luma-mini-customization';
      section.innerHTML = `
        <div class="luma-settings-title">${icon('sparkles', 17)}<div><strong>Mini player</strong><small>Shape the compact player around your writing space.</small></div></div>
        <div class="luma-mini-setting-group"><p>Size</p><div class="luma-mini-choice-grid">${optionButton('size', 'compact', 'Compact', 'Smaller footprint')}${optionButton('size', 'comfortable', 'Comfortable', 'More breathing room')}</div></div>
        <div class="luma-mini-setting-group"><p>Surface</p><div class="luma-mini-choice-grid">${optionButton('surface', 'solid', 'Solid', 'Crisp and opaque')}${optionButton('surface', 'glass', 'Glass', 'Soft translucent blur')}</div></div>
        <div class="luma-mini-setting-group"><p>Position</p><div class="luma-mini-choice-grid">${optionButton('position', 'left', 'Bottom left', 'Near the library')}${optionButton('position', 'right', 'Bottom right', 'Away from writing')}</div></div>
        <div class="luma-mini-toggles">
          ${toggleButton('artwork', 'Show artwork', 'Square thumbnail beside the track')}
          ${toggleButton('progress', 'Show progress', 'Keep the seek bar visible')}
          ${toggleButton('volume', 'Show volume', 'Keep the volume slider visible')}
          ${toggleButton('glow', 'Accent glow', 'A subtle colored shadow')}
        </div>`;
      settingsRoot.insertBefore(section, settingsRoot.children[1] || null);
      section.addEventListener('click', handleSettingsClick);
    }
    updateControls();
  }

  function updateControls() {
    const section = drawer?.querySelector('.luma-mini-customization');
    if (!section) return;
    section.querySelectorAll('[data-mini-setting]').forEach((button) => {
      const active = preferences[button.dataset.miniSetting] === button.dataset.miniValue;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    section.querySelectorAll('[data-mini-toggle]').forEach((button) => {
      const enabled = Boolean(preferences[button.dataset.miniToggle]);
      button.classList.toggle('active', enabled);
      button.setAttribute('aria-checked', String(enabled));
    });
  }

  function handleSettingsClick(event) {
    const choice = event.target.closest('[data-mini-setting]');
    if (choice) {
      const setting = choice.dataset.miniSetting;
      const value = choice.dataset.miniValue;
      if (OPTIONS[setting]?.has(value)) preferences[setting] = value;
      savePreferences();
      applyPreferences();
      return;
    }

    const toggle = event.target.closest('[data-mini-toggle]');
    if (!toggle) return;
    const setting = toggle.dataset.miniToggle;
    if (!(setting in DEFAULTS)) return;
    preferences[setting] = !preferences[setting];
    savePreferences();
    applyPreferences();
  }

  function sync() {
    syncFrame = 0;
    injectSettings();
    updateArtwork();
    updateControls();
  }

  function scheduleSync() {
    if (syncFrame) return;
    syncFrame = requestAnimationFrame(sync);
  }

  function connect() {
    const nextDrawer = document.querySelector('.luma-music-drawer');
    if (!nextDrawer) return false;
    if (drawer !== nextDrawer) {
      drawerObserver?.disconnect();
      drawer = nextDrawer;
      drawerObserver = new MutationObserver(scheduleSync);
      drawerObserver.observe(drawer, { childList: true, subtree: true, characterData: true });
    }
    applyPreferences();
    scheduleSync();
    return true;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    preferences = loadPreferences();
    applyPreferences();
  });
  window.addEventListener('luma:music-panel-mode', scheduleSync);

  connectObserver = new MutationObserver(() => {
    if (!drawer?.isConnected) connect();
  });
  connectObserver.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect, { once: true });
  else connect();

  window.LumaMiniPlayer = Object.freeze({
    getPreferences: () => ({ ...preferences }),
    setPreference(setting, value) {
      if (OPTIONS[setting]?.has(value)) preferences[setting] = value;
      else if (typeof DEFAULTS[setting] === 'boolean') preferences[setting] = Boolean(value);
      else return;
      savePreferences();
      applyPreferences();
    },
  });
})();
