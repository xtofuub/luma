(() => {
  'use strict';

  const STATE_KEY = 'luma-youtube-music-state-v4';
  const PLAYLISTS_KEY = 'luma-youtube-playlists-v2';
  const API_KEY_KEY = 'luma-youtube-api-key-v2';
  const SETTINGS_KEY = 'luma-ambience-settings-v2';

  let shell;
  let drawer;
  let backdrop;
  let content;
  let focusPlayer;
  let player;
  let playerReady = false;
  let playerState = -1;
  let pendingPlayback = null;
  let progressTimer = 0;
  let results = [];
  let queue = [];
  let playlists = [];
  let current = null;
  let view = 'search';
  let query = '';
  let loading = false;
  let status = '';
  let shuffle = false;
  let repeatMode = 'off';
  let playlistPickerId = null;
  let serverConfigured = false;
  let apiKey = localStorage.getItem(API_KEY_KEY) || '';
  let initialized = false;

  const ICONS = {
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    play: '<path d="m7 4 13 8-13 8V4Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    previous: '<path d="M19 20 9 12l10-8v16ZM5 19V5"/>',
    next: '<path d="m5 4 10 8-10 8V4ZM19 5v14"/>',
    shuffle: '<path d="M3 7h3c5 0 6 10 11 10h4"/><path d="m18 14 3 3-3 3"/><path d="M3 17h3c1.8 0 3.1-1.3 4.3-3"/><path d="M14.7 10C16 8.3 17 7 21 7"/><path d="m18 4 3 3-3 3"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    queue: '<path d="M8 6h13M8 12h13M8 18h8"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    playlist: '<path d="M4 6h10M4 11h10M4 16h7"/><path d="M18 13v7"/><path d="M15 17h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3.1 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
    trending: '<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  };

  function icon(name, size = 17) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function cleanTrack(track) {
    if (!track?.videoId || !track?.title) return null;
    return {
      videoId: String(track.videoId),
      title: String(track.title),
      channel: String(track.channel || 'YouTube'),
      thumbnail: String(track.thumbnail || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`),
      duration: Number(track.duration) || 0,
      publishedAt: String(track.publishedAt || ''),
    };
  }

  function sameTrack(a, b) {
    return Boolean(a?.videoId && b?.videoId && a.videoId === b.videoId);
  }

  function loadState() {
    const state = loadJson(STATE_KEY, {});
    queue = Array.isArray(state.queue) ? state.queue.map(cleanTrack).filter(Boolean) : [];
    current = cleanTrack(state.current);
    view = ['search', 'queue', 'playlists', 'settings'].includes(state.view) ? state.view : 'search';
    shuffle = Boolean(state.shuffle);
    repeatMode = ['off', 'all', 'one'].includes(state.repeatMode) ? state.repeatMode : 'off';
    query = typeof state.query === 'string' ? state.query : '';
    const savedPlaylists = loadJson(PLAYLISTS_KEY, []);
    playlists = (Array.isArray(savedPlaylists) ? savedPlaylists : []).map((playlist) => ({
      id: String(playlist.id || crypto.randomUUID()),
      name: String(playlist.name || 'Untitled playlist'),
      tracks: Array.isArray(playlist.tracks) ? playlist.tracks.map(cleanTrack).filter(Boolean) : [],
      createdAt: Number(playlist.createdAt) || Date.now(),
    }));
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify({ queue, current, view, shuffle, repeatMode, query }));
  }

  function savePlaylists() {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function getVolume() {
    const settings = loadJson(SETTINGS_KEY, {});
    const volume = Number(settings.musicVolume);
    return Number.isFinite(volume) ? Math.min(100, Math.max(0, volume)) : 55;
  }

  function saveVolume(volume) {
    const settings = loadJson(SETTINGS_KEY, {});
    settings.musicVolume = Math.round(volume);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function getTrack(id) {
    if (!id) return null;
    if (current?.videoId === id) return current;
    const result = results.find((track) => track.videoId === id);
    if (result) return result;
    const queued = queue.find((track) => track.videoId === id);
    if (queued) return queued;
    for (const playlist of playlists) {
      const track = playlist.tracks.find((item) => item.videoId === id);
      if (track) return track;
    }
    return null;
  }

  function createInterface() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-youtube-shell')) return false;

    shell = document.createElement('div');
    shell.className = 'luma-youtube-shell luma-tool';
    shell.innerHTML = `<button class="icon-control luma-trigger luma-youtube-trigger" data-action="toggle-drawer" aria-label="Music" aria-expanded="false" title="Music">${icon('music')}<span class="luma-badge" hidden></span></button>`;
    actions.insertBefore(shell, actions.querySelector('.text-control') || actions.lastElementChild);

    backdrop = document.createElement('button');
    backdrop.className = 'luma-music-backdrop';
    backdrop.type = 'button';
    backdrop.dataset.action = 'close-drawer';
    backdrop.setAttribute('aria-label', 'Close music panel');
    document.body.appendChild(backdrop);

    drawer = document.createElement('aside');
    drawer.className = 'luma-music-drawer';
    drawer.setAttribute('aria-label', 'YouTube music player');
    drawer.innerHTML = `
      <header class="luma-music-header">
        <div><span>${icon('music', 18)}</span><div><strong>Music</strong><small>YouTube player</small></div></div>
        <button data-action="close-drawer" aria-label="Close music panel">${icon('close', 17)}</button>
      </header>
      <section class="luma-youtube-player-card">
        <div class="luma-youtube-stage"><div id="luma-youtube-player"></div><div class="luma-player-placeholder">${icon('music', 25)}<strong>Choose a track</strong><small>Search YouTube and press play.</small></div></div>
        <div class="luma-now-playing"><div><strong data-now-title>Nothing playing</strong><small data-now-channel>Search YouTube to begin</small></div></div>
        <label class="luma-youtube-seek"><input data-input="seek" type="range" min="0" max="0" step="0.25" value="0"><span data-current-time>0:00</span><span data-total-time>0:00</span></label>
        <div class="luma-youtube-transport">
          <button data-action="toggle-shuffle" aria-label="Shuffle" title="Shuffle">${icon('shuffle', 16)}</button>
          <button data-action="previous" aria-label="Previous" title="Previous">${icon('previous', 18)}</button>
          <button class="luma-youtube-play" data-action="toggle-play" aria-label="Play">${icon('play', 19)}</button>
          <button data-action="next" aria-label="Next" title="Next">${icon('next', 18)}</button>
          <button data-action="cycle-repeat" aria-label="Repeat" title="Repeat">${icon('repeat', 16)}<small></small></button>
        </div>
        <label class="luma-youtube-volume">${icon('volume', 14)}<input data-input="volume" type="range" min="0" max="100" value="${getVolume()}"><small>${getVolume()}%</small></label>
      </section>
      <nav class="luma-music-tabs" aria-label="Music sections">
        ${tabButton('search', 'search', 'Search')}${tabButton('queue', 'queue', 'Queue')}${tabButton('playlists', 'playlist', 'Playlists')}${tabButton('settings', 'settings', 'Settings')}
      </nav>
      <div class="luma-music-content"></div>
      <p class="luma-music-status" hidden></p>`;
    document.body.appendChild(drawer);
    content = drawer.querySelector('.luma-music-content');

    focusPlayer = document.createElement('div');
    focusPlayer.className = 'luma-focus-player luma-youtube-focus-player';
    focusPlayer.hidden = true;
    document.body.appendChild(focusPlayer);

    document.addEventListener('click', handleClick);
    drawer.addEventListener('input', handleInput);
    drawer.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', handleKeydown);
    new MutationObserver(renderFocusPlayer).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
    progressTimer = window.setInterval(syncProgress, 500);
    return true;
  }

  function tabButton(id, iconName, label) {
    return `<button data-action="set-view" data-view="${id}" class="${view === id ? 'active' : ''}">${icon(iconName, 14)}<span>${label}</span><small data-tab-count="${id}"></small></button>`;
  }

  function setDrawer(open) {
    document.body.classList.toggle('luma-music-open', open);
    shell?.querySelector('[data-action="toggle-drawer"]')?.setAttribute('aria-expanded', String(open));
    shell?.querySelector('[data-action="toggle-drawer"]')?.classList.toggle('is-active', open);
    if (open) window.setTimeout(() => drawer.querySelector('[data-input="search"]')?.focus(), 180);
  }

  function render() {
    if (!drawer || !content) return;
    drawer.querySelectorAll('[data-action="set-view"]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
    drawer.querySelector('[data-tab-count="queue"]').textContent = queue.length ? String(queue.length) : '';
    drawer.querySelector('[data-tab-count="playlists"]').textContent = playlists.length ? String(playlists.length) : '';
    const badge = shell.querySelector('.luma-badge');
    badge.hidden = queue.length === 0;
    badge.textContent = String(queue.length);

    content.innerHTML = view === 'search' ? searchMarkup() : view === 'queue' ? queueMarkup() : view === 'playlists' ? playlistsMarkup() : settingsMarkup();
    const statusNode = drawer.querySelector('.luma-music-status');
    statusNode.hidden = !status;
    statusNode.textContent = status;
    renderPlayerState();
    renderFocusPlayer();
  }

  function renderPlayerState() {
    const title = drawer.querySelector('[data-now-title]');
    const channel = drawer.querySelector('[data-now-channel]');
    const placeholder = drawer.querySelector('.luma-player-placeholder');
    title.textContent = current?.title || 'Nothing playing';
    channel.textContent = current?.channel || 'Search YouTube to begin';
    placeholder.hidden = Boolean(current);

    const playing = playerState === 1;
    const playButton = drawer.querySelector('.luma-youtube-play');
    playButton.innerHTML = icon(playing ? 'pause' : 'play', 19);
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    drawer.querySelector('[data-action="toggle-shuffle"]').classList.toggle('active', shuffle);
    const repeatButton = drawer.querySelector('[data-action="cycle-repeat"]');
    repeatButton.classList.toggle('active', repeatMode !== 'off');
    repeatButton.querySelector('small').textContent = repeatMode === 'one' ? '1' : '';
    syncProgress();
  }

  function searchMarkup() {
    const configured = serverConfigured || Boolean(apiKey);
    return `
      <form class="luma-youtube-search-form" data-form="search">
        <label>${icon('search', 15)}<input data-input="search" value="${escapeHtml(query)}" placeholder="Search songs, artists, or mixes" autocomplete="off"></label>
        <button type="submit" ${loading ? 'disabled' : ''}>${loading ? 'Searching…' : 'Search'}</button>
      </form>
      <div class="luma-quick-searches">
        <button data-action="trending">${icon('trending', 12)} Trending</button>
        ${['lofi hip hop','focus music','jazz playlist','classical music'].map((term) => `<button data-action="quick-search" data-query="${escapeHtml(term)}">${escapeHtml(term)}</button>`).join('')}
      </div>
      ${!configured ? `<button class="luma-youtube-setup-card" data-action="open-settings">${icon('key', 20)}<span><strong>Add your YouTube API key</strong><small>Configure search once, then use the player normally.</small></span></button>` : ''}
      <div class="luma-section-heading"><span>${query.trim() ? 'Search results' : 'Popular music'}</span><small>${results.length ? `${results.length} videos` : ''}</small></div>
      ${loading ? `<div class="luma-youtube-loading"><i></i><span>Searching YouTube…</span></div>` : results.length ? `<div class="luma-youtube-results">${results.map(resultMarkup).join('')}</div>` : `<div class="luma-youtube-empty">${icon('search', 22)}<strong>${configured ? 'Search for music' : 'API key required'}</strong><small>${configured ? 'Results will appear here.' : 'Open Settings and paste your YouTube Data API v3 key.'}</small></div>`}`;
  }

  function resultMarkup(track) {
    const inQueue = queue.some((item) => sameTrack(item, track));
    const pickerOpen = playlistPickerId === track.videoId;
    return `<div class="luma-youtube-result-wrap ${sameTrack(current, track) ? 'active' : ''}">
      <div class="luma-youtube-result">
        <button class="luma-youtube-result-main" data-action="play-track" data-id="${track.videoId}"><img src="${escapeHtml(track.thumbnail)}" alt=""><span><strong title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</strong><small>${escapeHtml(track.channel)}${track.duration ? ` · ${formatTime(track.duration)}` : ''}</small></span></button>
        <div><button data-action="queue-track" data-id="${track.videoId}" class="${inQueue ? 'active' : ''}" aria-label="Add to queue">${icon(inQueue ? 'check' : 'queue', 13)}</button><button data-action="playlist-picker" data-id="${track.videoId}" aria-label="Add to playlist">${icon('playlist', 13)}</button></div>
      </div>${pickerOpen ? playlistPickerMarkup(track) : ''}</div>`;
  }

  function playlistPickerMarkup(track) {
    return `<div class="luma-youtube-playlist-picker"><div><strong>Add to playlist</strong><button data-action="close-picker">${icon('close', 12)}</button></div>${playlists.length ? playlists.map((playlist) => { const added = playlist.tracks.some((item) => sameTrack(item, track)); return `<button data-action="toggle-playlist-track" data-id="${track.videoId}" data-playlist-id="${playlist.id}" class="${added ? 'active' : ''}"><span>${escapeHtml(playlist.name)}</span><small>${added ? 'Added' : `${playlist.tracks.length} tracks`}</small></button>`; }).join('') : '<p>Create a playlist from the Playlists tab first.</p>'}</div>`;
  }

  function queueMarkup() {
    if (!queue.length) return `<div class="luma-youtube-empty tall">${icon('queue', 23)}<strong>Your queue is empty</strong><small>Add videos from Search to choose what plays next.</small><button data-action="set-view" data-view="search">Search music</button></div>`;
    return `<div class="luma-queue-heading"><span>${queue.length} ${queue.length === 1 ? 'track' : 'tracks'}</span><button data-action="clear-queue">Clear queue</button></div><div class="luma-youtube-queue">${queue.map((track, index) => `<div class="luma-youtube-queue-row ${sameTrack(track, current) ? 'active' : ''}"><button data-action="play-queue" data-index="${index}"><img src="${escapeHtml(track.thumbnail)}" alt=""><span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.channel)}</small></span></button><div><button data-action="move-queue" data-index="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>${icon('up', 12)}</button><button data-action="move-queue" data-index="${index}" data-direction="1" ${index === queue.length - 1 ? 'disabled' : ''}>${icon('down', 12)}</button><button data-action="remove-queue" data-index="${index}">${icon('close', 12)}</button></div></div>`).join('')}</div>`;
  }

  function playlistsMarkup() {
    const active = playlists.find((playlist) => playlist.id === viewPlaylistId());
    if (active) return playlistDetailMarkup(active);
    return `<form class="luma-playlist-create" data-form="playlist"><input name="name" placeholder="New playlist name" maxlength="60" autocomplete="off"><button type="submit">${icon('plus', 13)} Create</button></form>${playlists.length ? `<div class="luma-youtube-playlists">${playlists.map((playlist) => `<div class="luma-youtube-playlist-card"><button data-action="open-playlist" data-playlist-id="${playlist.id}"><i>${icon('music', 16)}</i><span><strong>${escapeHtml(playlist.name)}</strong><small>${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'track' : 'tracks'}</small></span></button><div><button data-action="play-playlist" data-playlist-id="${playlist.id}">${icon('play', 13)}</button><button data-action="rename-playlist" data-playlist-id="${playlist.id}">${icon('more', 13)}</button><button data-action="delete-playlist" data-playlist-id="${playlist.id}">${icon('trash', 13)}</button></div></div>`).join('')}</div>` : `<div class="luma-youtube-empty tall">${icon('playlist', 23)}<strong>No playlists yet</strong><small>Create one and add tracks from Search.</small></div>`}`;
  }

  function viewPlaylistId() {
    return drawer?.dataset.playlistId || '';
  }

  function playlistDetailMarkup(playlist) {
    return `<div class="luma-playlist-detail-header"><button data-action="close-playlist">${icon('back', 14)}</button><div><strong>${escapeHtml(playlist.name)}</strong><small>${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'track' : 'tracks'}</small></div><div><button data-action="play-playlist" data-playlist-id="${playlist.id}" ${playlist.tracks.length ? '' : 'disabled'}>${icon('play', 13)} Play</button><button data-action="shuffle-playlist" data-playlist-id="${playlist.id}" ${playlist.tracks.length ? '' : 'disabled'}>${icon('shuffle', 13)}</button></div></div>${playlist.tracks.length ? `<div class="luma-youtube-results">${playlist.tracks.map((track) => `<div class="luma-youtube-result"><button class="luma-youtube-result-main" data-action="play-track" data-id="${track.videoId}"><img src="${escapeHtml(track.thumbnail)}" alt=""><span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.channel)}</small></span></button><div><button data-action="queue-track" data-id="${track.videoId}">${icon('queue', 13)}</button><button data-action="remove-playlist-track" data-id="${track.videoId}" data-playlist-id="${playlist.id}">${icon('close', 13)}</button></div></div>`).join('')}</div>` : `<div class="luma-youtube-empty tall"><strong>This playlist is empty</strong><small>Add tracks from Search.</small><button data-action="set-view" data-view="search">Search music</button></div>`}`;
  }

  function settingsMarkup() {
    return `<div class="luma-youtube-settings">
      <section><div class="luma-settings-title">${icon('key', 17)}<div><strong>YouTube Data API key</strong><small>Required only for search. Playback uses YouTube's embedded player.</small></div></div><form data-form="api-key"><label><input type="password" name="apiKey" value="${escapeHtml(apiKey)}" placeholder="AIza…" autocomplete="off"><button type="button" data-action="toggle-key">Show</button></label><div><button type="submit">Save key</button>${apiKey ? '<button type="button" data-action="clear-key">Remove local key</button>' : ''}</div></form><p class="luma-settings-note">The local key stays in this browser and is sent only to Luma's search endpoint. For a shared deployment, add <code>YOUTUBE_API_KEY</code> in Vercel instead.</p></section>
      <section><div class="luma-settings-status ${serverConfigured ? 'ok' : ''}"><i></i><div><strong>${serverConfigured ? 'Vercel key detected' : apiKey ? 'Local browser key saved' : 'No API key configured'}</strong><small>${serverConfigured ? 'Visitors can search without entering a key.' : apiKey ? 'This browser can search YouTube.' : 'Paste your key above to enable search.'}</small></div></div></section>
      <section><div class="luma-settings-title">${icon('settings', 17)}<div><strong>Playback</strong><small>Queue and playlists are saved in this browser.</small></div></div><button class="luma-reset-music" data-action="reset-music">Reset queue, playlists, and player</button></section>
    </div>`;
  }

  function loadYouTubeApi() {
    return new Promise((resolve) => {
      if (window.YT?.Player) { resolve(); return; }
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (typeof previous === 'function') previous(); resolve(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }

  async function ensurePlayer() {
    if (player) return player;
    await loadYouTubeApi();
    player = new window.YT.Player('luma-youtube-player', {
      width: '100%', height: '100%',
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: (event) => {
          playerReady = true;
          event.target.setVolume(getVolume());
          if (pendingPlayback?.track) {
            const pending = pendingPlayback;
            pendingPlayback = null;
            if (pending.autoplay) event.target.loadVideoById(pending.track.videoId);
            else event.target.cueVideoById(pending.track.videoId);
          }
          renderPlayerState();
        },
        onStateChange: (event) => {
          playerState = event.data;
          if (event.data === window.YT.PlayerState.ENDED) handleEnded();
          renderPlayerState();
        },
        onError: () => {
          status = 'This video cannot be played in the embedded player. Try another result.';
          render();
        },
      },
    });
    return player;
  }

  async function loadTrack(track, autoplay = true) {
    track = cleanTrack(track);
    if (!track) return;
    current = track;
    if (!queue.some((item) => sameTrack(item, track))) queue.push(track);
    saveState();
    render();
    await ensurePlayer();
    if (!playerReady) pendingPlayback = { track, autoplay };
    else if (autoplay) player.loadVideoById(track.videoId);
    else player.cueVideoById(track.videoId);
  }

  async function searchYouTube(searchQuery = query.trim()) {
    if (!serverConfigured && !apiKey) {
      view = 'settings';
      status = 'Add your YouTube Data API v3 key to enable search.';
      render();
      return;
    }
    loading = true;
    status = '';
    query = searchQuery;
    view = 'search';
    saveState();
    render();
    const region = (navigator.language.split('-')[1] || 'US').toUpperCase();
    try {
      const params = new URLSearchParams({ limit: '12', region });
      if (searchQuery) params.set('q', searchQuery);
      const response = await fetch(`/api/youtube-search?${params}`, { headers: apiKey ? { 'X-YouTube-API-Key': apiKey } : {} });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'YouTube search failed.');
      results = Array.isArray(payload.videos) ? payload.videos.map(cleanTrack).filter(Boolean) : [];
      serverConfigured = Boolean(payload.serverConfigured) || serverConfigured;
      status = results.length ? '' : 'No embeddable music videos matched that search.';
    } catch (error) {
      results = [];
      status = error instanceof Error ? error.message : 'YouTube search failed.';
      if (/key|credential|api/i.test(status)) view = 'settings';
    } finally {
      loading = false;
      render();
    }
  }

  async function checkConfiguration() {
    try {
      const response = await fetch('/api/youtube-search?status=1');
      const payload = await response.json();
      serverConfigured = Boolean(payload.serverConfigured);
    } catch {
      serverConfigured = false;
    }
    render();
    if (serverConfigured || apiKey) void searchYouTube('');
  }

  function togglePlay() {
    if (!current) {
      const first = queue[0] || results[0];
      if (first) void loadTrack(first, true);
      else { view = 'search'; setDrawer(true); render(); }
      return;
    }
    void ensurePlayer().then(() => {
      if (!playerReady) { pendingPlayback = { track: current, autoplay: true }; return; }
      if (playerState === 1) player.pauseVideo();
      else if (playerState === -1 || playerState === 5) player.loadVideoById(current.videoId);
      else player.playVideo();
    });
  }

  function currentIndex() {
    return queue.findIndex((track) => sameTrack(track, current));
  }

  function nextTrack(fromEnded = false) {
    if (!queue.length) return;
    if (fromEnded && repeatMode === 'one') { player?.seekTo(0, true); player?.playVideo(); return; }
    let index = currentIndex();
    if (shuffle && queue.length > 1) {
      const choices = queue.map((_, position) => position).filter((position) => position !== index);
      index = choices[Math.floor(Math.random() * choices.length)];
    } else {
      index += 1;
      if (index >= queue.length) {
        if (repeatMode === 'all') index = 0;
        else { player?.pauseVideo(); player?.seekTo(0, true); return; }
      }
    }
    void loadTrack(queue[Math.max(0, index)], true);
  }

  function previousTrack() {
    if (playerReady && player.getCurrentTime() > 3) { player.seekTo(0, true); return; }
    if (!queue.length) return;
    let index = currentIndex();
    index = index > 0 ? index - 1 : repeatMode === 'all' ? queue.length - 1 : 0;
    void loadTrack(queue[index], true);
  }

  function handleEnded() {
    nextTrack(true);
  }

  function queueTrack(track) {
    if (!track) return;
    if (queue.some((item) => sameTrack(item, track))) status = 'That track is already in the queue.';
    else { queue.push(track); status = `Queued “${track.title}”.`; }
    saveState();
    render();
  }

  function moveQueue(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= queue.length) return;
    [queue[index], queue[target]] = [queue[target], queue[index]];
    saveState(); render();
  }

  function removeQueue(index) {
    const removed = queue[index];
    queue.splice(index, 1);
    if (sameTrack(removed, current)) {
      const replacement = queue[index] || queue[index - 1] || null;
      current = replacement;
      if (replacement) void loadTrack(replacement, false);
      else { player?.stopVideo(); playerState = -1; }
    }
    saveState(); render();
  }

  function togglePlaylistTrack(track, playlistId) {
    if (!track) return;
    playlists = playlists.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      const exists = playlist.tracks.some((item) => sameTrack(item, track));
      return { ...playlist, tracks: exists ? playlist.tracks.filter((item) => !sameTrack(item, track)) : [...playlist.tracks, track] };
    });
    savePlaylists(); render();
  }

  function playPlaylist(playlistId, randomize = false) {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist?.tracks.length) return;
    queue = [...playlist.tracks];
    if (randomize) queue.sort(() => Math.random() - 0.5);
    shuffle = randomize;
    saveState();
    void loadTrack(queue[0], true);
  }

  function syncProgress() {
    if (!drawer) return;
    let currentTime = 0;
    let duration = current?.duration || 0;
    if (playerReady) {
      try { currentTime = player.getCurrentTime() || 0; duration = player.getDuration() || duration; } catch {}
    }
    const seek = drawer.querySelector('[data-input="seek"]');
    if (seek && document.activeElement !== seek) {
      seek.max = String(Math.max(0, duration));
      seek.value = String(Math.min(duration || currentTime, currentTime));
    }
    drawer.querySelector('[data-current-time]').textContent = formatTime(currentTime);
    drawer.querySelector('[data-total-time]').textContent = formatTime(duration);
    const focusTime = focusPlayer?.querySelector('[data-focus-time]');
    if (focusTime) focusTime.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  }

  function renderFocusPlayer() {
    if (!focusPlayer) return;
    const inFocus = document.querySelector('.app')?.classList.contains('focus-mode');
    focusPlayer.hidden = !inFocus || !current;
    if (focusPlayer.hidden) return;
    focusPlayer.innerHTML = `<button data-action="previous">${icon('previous', 14)}</button><button class="luma-focus-play" data-action="toggle-play">${icon(playerState === 1 ? 'pause' : 'play', 14)}</button><div><strong>${escapeHtml(current.title)}</strong><small data-focus-time>0:00 / ${formatTime(current.duration)}</small></div><button data-action="next">${icon('next', 14)}</button>`;
    syncProgress();
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (!(shell?.contains(button) || drawer?.contains(button) || focusPlayer?.contains(button) || button === backdrop)) return;
    const action = button.dataset.action;
    if (!action) return;
    if (action === 'toggle-drawer') setDrawer(!document.body.classList.contains('luma-music-open'));
    else if (action === 'close-drawer') setDrawer(false);
    else if (action === 'set-view') { view = button.dataset.view; if (view !== 'playlists') delete drawer.dataset.playlistId; saveState(); render(); }
    else if (action === 'open-settings') { view = 'settings'; saveState(); render(); }
    else if (action === 'quick-search') { query = button.dataset.query || ''; void searchYouTube(query); }
    else if (action === 'trending') { query = ''; void searchYouTube(''); }
    else if (action === 'play-track') void loadTrack(getTrack(button.dataset.id), true);
    else if (action === 'queue-track') queueTrack(getTrack(button.dataset.id));
    else if (action === 'playlist-picker') { playlistPickerId = playlistPickerId === button.dataset.id ? null : button.dataset.id; render(); }
    else if (action === 'close-picker') { playlistPickerId = null; render(); }
    else if (action === 'toggle-playlist-track') togglePlaylistTrack(getTrack(button.dataset.id), button.dataset.playlistId);
    else if (action === 'toggle-play') togglePlay();
    else if (action === 'previous') previousTrack();
    else if (action === 'next') nextTrack(false);
    else if (action === 'toggle-shuffle') { shuffle = !shuffle; saveState(); render(); }
    else if (action === 'cycle-repeat') { repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'; saveState(); render(); }
    else if (action === 'play-queue') void loadTrack(queue[Number(button.dataset.index)], true);
    else if (action === 'move-queue') moveQueue(Number(button.dataset.index), Number(button.dataset.direction));
    else if (action === 'remove-queue') removeQueue(Number(button.dataset.index));
    else if (action === 'clear-queue') { queue = []; current = null; player?.stopVideo(); playerState = -1; saveState(); render(); }
    else if (action === 'open-playlist') { drawer.dataset.playlistId = button.dataset.playlistId; render(); }
    else if (action === 'close-playlist') { delete drawer.dataset.playlistId; render(); }
    else if (action === 'play-playlist') playPlaylist(button.dataset.playlistId, false);
    else if (action === 'shuffle-playlist') playPlaylist(button.dataset.playlistId, true);
    else if (action === 'rename-playlist') { const playlist = playlists.find((item) => item.id === button.dataset.playlistId); const name = playlist && prompt('Rename playlist', playlist.name)?.trim(); if (name) { playlist.name = name; savePlaylists(); render(); } }
    else if (action === 'delete-playlist') { const playlist = playlists.find((item) => item.id === button.dataset.playlistId); if (playlist && confirm(`Delete playlist “${playlist.name}”?`)) { playlists = playlists.filter((item) => item.id !== playlist.id); delete drawer.dataset.playlistId; savePlaylists(); render(); } }
    else if (action === 'remove-playlist-track') { playlists = playlists.map((playlist) => playlist.id === button.dataset.playlistId ? { ...playlist, tracks: playlist.tracks.filter((track) => track.videoId !== button.dataset.id) } : playlist); savePlaylists(); render(); }
    else if (action === 'toggle-key') { const input = drawer.querySelector('input[name="apiKey"]'); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? 'Show' : 'Hide'; }
    else if (action === 'clear-key') { apiKey = ''; localStorage.removeItem(API_KEY_KEY); status = 'Local API key removed.'; void checkConfiguration(); }
    else if (action === 'reset-music' && confirm('Reset the YouTube queue, playlists, and player?')) { queue = []; playlists = []; current = null; results = []; query = ''; shuffle = false; repeatMode = 'off'; player?.stopVideo(); localStorage.removeItem(STATE_KEY); localStorage.removeItem(PLAYLISTS_KEY); render(); }
  }

  function handleInput(event) {
    if (event.target.dataset.input === 'search') query = event.target.value;
    else if (event.target.dataset.input === 'seek' && playerReady) player.seekTo(Number(event.target.value) || 0, true);
    else if (event.target.dataset.input === 'volume') {
      const volume = Number(event.target.value) || 0;
      saveVolume(volume);
      if (playerReady) player.setVolume(volume);
      event.target.parentElement.querySelector('small').textContent = `${volume}%`;
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'search') void searchYouTube(query.trim());
    else if (form.dataset.form === 'playlist') {
      const name = new FormData(form).get('name')?.toString().trim();
      if (name) { const playlist = { id: crypto.randomUUID?.() || `${Date.now()}`, name, tracks: [], createdAt: Date.now() }; playlists.push(playlist); drawer.dataset.playlistId = playlist.id; savePlaylists(); render(); }
    } else if (form.dataset.form === 'api-key') {
      const key = new FormData(form).get('apiKey')?.toString().trim() || '';
      if (!key) { status = 'Paste a YouTube Data API v3 key first.'; render(); return; }
      apiKey = key;
      localStorage.setItem(API_KEY_KEY, apiKey);
      status = 'API key saved in this browser.';
      view = 'search';
      render();
      void searchYouTube('');
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && document.body.classList.contains('luma-music-open')) setDrawer(false);
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    loadState();
    if (!createInterface()) {
      initialized = false;
      return;
    }
    render();
    if (current) pendingPlayback = { track: current, autoplay: false };
    void checkConfiguration();
  }

  new MutationObserver(() => { if (!shell) initialize(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true }); else initialize();
  window.addEventListener('beforeunload', () => window.clearInterval(progressTimer));
})();
