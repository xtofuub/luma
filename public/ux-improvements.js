(() => {
  'use strict';

  const PREFS_KEY = 'luma-panel-preferences-v1';
  const CLIENT_ID_KEY = 'luma-spotify-client-id';
  const TOKEN_KEY = 'luma-spotify-token-v1';
  const VERIFIER_KEY = 'luma-spotify-code-verifier';
  const OAUTH_STATE_KEY = 'luma-spotify-oauth-state';
  const DEFAULT_PREFS = { library: true, details: true, stats: true, spotify: false };
  const scopes = ['user-read-playback-state', 'user-modify-playback-state'];

  let prefs = loadJson(PREFS_KEY, DEFAULT_PREFS);
  let token = loadJson(TOKEN_KEY, null);
  let playback = null;
  let spotifyError = '';
  let spotifyBusy = false;
  let spotifyTimer = 0;
  let viewShell;
  let viewPopover;
  let spotifyPanel;

  function loadJson(key, fallback) {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
    catch { return fallback; }
  }

  function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function icon(name, size = 16) {
    const paths = {
      settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>',
      refresh: '<path d="M20 11a8 8 0 1 0 2 5.3"/><path d="M20 4v7h-7"/>',
      play: '<path d="m7 4 13 8-13 8V4Z"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
      previous: '<path d="M19 20 9 12l10-8v16ZM5 19V5"/>',
      next: '<path d="m5 4 10 8-10 8V4ZM19 5v14"/>',
      volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
      logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h7v18h-7"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function redirectUri() {
    return `${location.origin}${location.pathname}`;
  }

  function randomString(length = 64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => chars[value % chars.length]).join('');
  }

  async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function formatTime(ms) {
    const seconds = Math.max(0, Math.floor((ms || 0) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function escapeHtml(value) {
    return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function applyPrefs() {
    document.documentElement.classList.toggle('luma-hide-library', !prefs.library);
    document.documentElement.classList.toggle('luma-hide-details', !prefs.details);
    document.documentElement.classList.toggle('luma-hide-stats', !prefs.stats);
    savePrefs();
    renderViewMenu();
    renderSpotify();
  }

  function createViewMenu() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-view-shell')) return;
    viewShell = document.createElement('div');
    viewShell.className = 'menu luma-view-shell';
    viewShell.innerHTML = `
      <button class="icon-control luma-view-trigger" aria-label="Configure visible panels" title="Configure panels">${icon('settings', 17)}</button>
      <div class="menu-popover view-popover" hidden></div>`;
    const focusButton = actions.querySelector('.text-control');
    actions.insertBefore(viewShell, focusButton || actions.lastElementChild);
    viewPopover = viewShell.querySelector('.view-popover');
    viewShell.querySelector('.luma-view-trigger').addEventListener('click', () => {
      viewPopover.hidden = !viewPopover.hidden;
    });
    viewShell.addEventListener('click', (event) => {
      const button = event.target.closest('[data-pref]');
      if (!button) return;
      const key = button.dataset.pref;
      if (key === 'all') prefs = { library: true, details: true, stats: true, spotify: true };
      else prefs[key] = !prefs[key];
      applyPrefs();
    });
    document.addEventListener('mousedown', (event) => {
      if (viewShell && !viewShell.contains(event.target)) viewPopover.hidden = true;
    });
    renderViewMenu();
  }

  function renderViewMenu() {
    if (!viewPopover) return;
    const rows = [
      ['library', 'Left library'],
      ['details', 'Document details'],
      ['stats', 'Writing statistics'],
      ['spotify', 'Spotify controls'],
    ];
    viewPopover.innerHTML = `
      <p>Visible panels</p>
      ${rows.map(([key, label]) => `<button class="view-toggle" data-pref="${key}"><span class="toggle-mark ${prefs[key] ? 'enabled' : ''}">${prefs[key] ? icon('check', 12) : ''}</span>${label}</button>`).join('')}
      <div class="menu-divider"></div>
      <button data-pref="all">${icon('eye', 16)} Show everything</button>`;
  }

  async function refreshToken() {
    const clientId = localStorage.getItem(CLIENT_ID_KEY);
    if (!token?.refreshToken || !clientId) throw new Error('Connect Spotify again.');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refreshToken, client_id: clientId }),
    });
    if (!response.ok) throw new Error('Spotify session expired. Connect again.');
    const data = await response.json();
    token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || token.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000 - 30000,
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    return token;
  }

  async function validToken() {
    if (!token?.accessToken) throw new Error('Connect Spotify first.');
    return token.expiresAt > Date.now() ? token : refreshToken();
  }

  async function spotifyFetch(path, options = {}) {
    let current = await validToken();
    const request = (accessToken) => {
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${accessToken}`);
      return fetch(`https://api.spotify.com/v1${path}`, { ...options, headers });
    };
    let response = await request(current.accessToken);
    if (response.status === 401) {
      current = await refreshToken();
      response = await request(current.accessToken);
    }
    return response;
  }

  async function connectSpotify(clientId) {
    clientId = clientId.trim();
    if (!clientId) {
      spotifyError = 'Paste the Client ID from your Spotify developer app.';
      renderSpotify();
      return;
    }
    localStorage.setItem(CLIENT_ID_KEY, clientId);
    const verifier = randomString();
    const state = randomString(32);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri(),
      scope: scopes.join(' '),
      code_challenge_method: 'S256',
      code_challenge: await challengeFor(verifier),
      state,
    });
    location.assign(`https://accounts.spotify.com/authorize?${params}`);
  }

  async function handleOAuthCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const oauthError = params.get('error');
    if (!code && !oauthError) return;
    history.replaceState({}, '', `${location.origin}${location.pathname}${location.hash}`);
    if (oauthError) {
      spotifyError = `Spotify connection was cancelled: ${oauthError}`;
      prefs.spotify = true;
      applyPrefs();
      return;
    }
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    const clientId = localStorage.getItem(CLIENT_ID_KEY);
    if (!verifier || !clientId || expectedState !== params.get('state')) {
      spotifyError = 'Spotify sign-in could not be verified. Try again.';
      return;
    }
    spotifyBusy = true;
    renderSpotify();
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: clientId, code_verifier: verifier,
        }),
      });
      if (!response.ok) throw new Error('Spotify rejected the connection. Check the Client ID and redirect URI.');
      const data = await response.json();
      token = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 - 30000 };
      localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
      prefs.spotify = true;
      spotifyError = '';
      applyPrefs();
      await loadPlayback();
    } catch (error) {
      spotifyError = error.message || 'Spotify connection failed.';
    } finally {
      sessionStorage.removeItem(VERIFIER_KEY);
      sessionStorage.removeItem(OAUTH_STATE_KEY);
      spotifyBusy = false;
      renderSpotify();
    }
  }

  async function loadPlayback(quiet = false) {
    if (!token) return;
    if (!quiet) spotifyBusy = true;
    try {
      const response = await spotifyFetch('/me/player');
      if (response.status === 204) {
        playback = null;
        spotifyError = 'Open Spotify on a device and start a song once.';
      } else if (!response.ok) {
        throw new Error(response.status === 403 ? 'Spotify Premium and an active device are required.' : 'Could not read Spotify playback.');
      } else {
        playback = await response.json();
        spotifyError = '';
      }
    } catch (error) {
      spotifyError = error.message || 'Spotify connection failed.';
    } finally {
      if (!quiet) spotifyBusy = false;
      renderSpotify();
    }
  }

  async function control(action) {
    spotifyBusy = true;
    renderSpotify();
    try {
      const method = action === 'next' || action === 'previous' ? 'POST' : 'PUT';
      const response = await spotifyFetch(`/me/player/${action}`, { method });
      if (!response.ok) throw new Error(response.status === 403 ? 'Spotify Premium and an active device are required.' : 'Spotify could not perform that action.');
      spotifyError = '';
      setTimeout(() => loadPlayback(true), 250);
    } catch (error) {
      spotifyError = error.message || 'Spotify control failed.';
    } finally {
      spotifyBusy = false;
      renderSpotify();
    }
  }

  async function setVolume(value) {
    const response = await spotifyFetch(`/me/player/volume?volume_percent=${value}`, { method: 'PUT' });
    if (!response.ok) spotifyError = 'This device does not allow remote volume control.';
    renderSpotify();
  }

  function disconnect() {
    localStorage.removeItem(TOKEN_KEY);
    token = null;
    playback = null;
    spotifyError = '';
    clearInterval(spotifyTimer);
    renderSpotify();
  }

  function createSpotifyPanel() {
    if (spotifyPanel) return;
    spotifyPanel = document.createElement('aside');
    spotifyPanel.className = 'spotify-panel';
    spotifyPanel.setAttribute('aria-label', 'Spotify controls');
    document.body.appendChild(spotifyPanel);
    spotifyPanel.addEventListener('click', (event) => {
      const action = event.target.closest('[data-spotify-action]')?.dataset.spotifyAction;
      if (!action) return;
      if (action === 'hide') { prefs.spotify = false; applyPrefs(); }
      if (action === 'refresh') loadPlayback();
      if (action === 'connect') connectSpotify(spotifyPanel.querySelector('[data-client-id]').value);
      if (action === 'disconnect') disconnect();
      if (['play', 'pause', 'next', 'previous'].includes(action)) control(action);
    });
    spotifyPanel.addEventListener('change', (event) => {
      if (event.target.matches('[data-volume]')) setVolume(event.target.value);
    });
  }

  function renderSpotify() {
    if (!prefs.spotify) {
      spotifyPanel?.remove();
      spotifyPanel = null;
      clearInterval(spotifyTimer);
      spotifyTimer = 0;
      return;
    }
    createSpotifyPanel();
    const clientId = localStorage.getItem(CLIENT_ID_KEY) || '';
    const item = playback?.item;
    const artwork = item?.album?.images?.[0]?.url || item?.images?.[0]?.url || item?.show?.images?.[0]?.url || '';
    const subtitle = item?.artists?.map((artist) => artist.name).join(', ') || item?.show?.name || 'Spotify';
    const progress = item?.duration_ms ? Math.min(100, ((playback?.progress_ms || 0) / item.duration_ms) * 100) : 0;
    const volume = playback?.device?.volume_percent ?? 50;
    spotifyPanel.innerHTML = `
      <div class="spotify-heading"><div>${icon('music', 15)}<span>Spotify</span></div><div class="spotify-heading-actions">
        ${token ? `<button data-spotify-action="refresh" aria-label="Refresh">${icon('refresh', 14)}</button>` : ''}
        <button data-spotify-action="hide" aria-label="Hide Spotify">${icon('x', 14)}</button>
      </div></div>
      ${!token ? `<div class="spotify-connect">
        <p>Connect your active Spotify device and control it while writing.</p>
        <label><span>Spotify Client ID</span><input data-client-id value="${escapeHtml(clientId)}" placeholder="Paste Client ID" autocomplete="off"></label>
        <button class="spotify-primary" data-spotify-action="connect" ${spotifyBusy ? 'disabled' : ''}>${icon('music', 15)} Connect Spotify</button>
        <small>Add <strong>${escapeHtml(redirectUri())}</strong> as a redirect URI in your Spotify developer app. Premium is required for remote playback controls.</small>
      </div>` : `<div class="spotify-player">
        <div class="spotify-track"><div class="spotify-artwork">${artwork ? `<img src="${escapeHtml(artwork)}" alt="">` : icon('music', 22)}</div><div>
          <strong>${escapeHtml(item?.name || 'No active playback')}</strong><span>${escapeHtml(playback?.device?.name || subtitle)}</span>${item && playback?.device ? `<small>${escapeHtml(subtitle)}</small>` : ''}
        </div></div>
        ${item ? `<div class="spotify-progress"><i><b style="width:${progress}%"></b></i><span>${formatTime(playback?.progress_ms)} / ${formatTime(item.duration_ms)}</span></div>` : ''}
        <div class="spotify-controls">
          <button data-spotify-action="previous" ${spotifyBusy ? 'disabled' : ''} aria-label="Previous">${icon('previous', 17)}</button>
          <button class="spotify-play" data-spotify-action="${playback?.is_playing ? 'pause' : 'play'}" ${spotifyBusy ? 'disabled' : ''} aria-label="${playback?.is_playing ? 'Pause' : 'Play'}">${icon(playback?.is_playing ? 'pause' : 'play', 17)}</button>
          <button data-spotify-action="next" ${spotifyBusy ? 'disabled' : ''} aria-label="Next">${icon('next', 17)}</button>
        </div>
        ${playback?.device?.supports_volume ? `<label class="spotify-volume">${icon('volume', 14)}<input data-volume type="range" min="0" max="100" value="${volume}"><span>${volume}</span></label>` : ''}
        <button class="spotify-disconnect" data-spotify-action="disconnect">${icon('logout', 13)} Disconnect</button>
      </div>`}
      ${spotifyError ? `<p class="spotify-error">${escapeHtml(spotifyError)}</p>` : ''}`;

    if (token && !spotifyTimer) spotifyTimer = setInterval(() => loadPlayback(true), 5000);
  }

  function init() {
    const observer = new MutationObserver(() => {
      createViewMenu();
      if (document.querySelector('.header-actions')) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    createViewMenu();
    applyPrefs();
    handleOAuthCallback();
    if (token && prefs.spotify) loadPlayback();
  }

  init();
})();
