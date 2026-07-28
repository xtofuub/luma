(() => {
  'use strict';

  const STATE_KEY = 'luma-online-music-state-v1';
  const PLAYLISTS_KEY = 'luma-online-music-playlists-v1';
  const SETTINGS_KEY = 'luma-ambience-settings-v2';
  const audio = new Audio();
  audio.preload = 'metadata';

  let shell;
  let popover;
  let focusPlayer;
  let results = [];
  let queue = [];
  let playlists = loadJson(PLAYLISTS_KEY, []);
  let current = null;
  let view = 'discover';
  let activePlaylistId = null;
  let playlistPickerTrackId = null;
  let searchValue = '';
  let loading = false;
  let status = '';
  let shuffle = false;
  let repeatMode = 'off';
  let initialized = false;
  let requestId = 0;

  const ICONS = {
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    play: '<path d="m7 4 13 8-13 8V4Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    previous: '<path d="M19 20 9 12l10-8v16ZM5 19V5"/>',
    next: '<path d="m5 4 10 8-10 8V4ZM19 5v14"/>',
    shuffle: '<path d="M3 7h3c5 0 6 10 11 10h4"/><path d="m18 14 3 3-3 3"/><path d="M3 17h3c1.8 0 3.1-1.3 4.3-3"/><path d="M14.7 10C16 8.3 17 7 21 7"/><path d="m18 4 3 3-3 3"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    queue: '<path d="M8 6h13M8 12h13M8 18h8"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    playlist: '<path d="M4 6h10M4 11h10M4 16h7"/><path d="M18 13v7"/><path d="M15 17h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronUp: '<path d="m18 15-6-6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
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
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function sameTrack(a, b) {
    return Boolean(a?.id && b?.id && a.id === b.id);
  }

  function cleanTrack(track) {
    if (!track || !track.id || !track.title || !track.streamUrl) return null;
    return {
      id: String(track.id),
      title: String(track.title),
      artist: String(track.artist || 'Audius artist'),
      artistHandle: String(track.artistHandle || ''),
      duration: Number(track.duration) || 0,
      artwork: String(track.artwork || ''),
      genre: String(track.genre || ''),
      mood: String(track.mood || ''),
      permalink: String(track.permalink || ''),
      streamUrl: String(track.streamUrl),
    };
  }

  function loadState() {
    const saved = loadJson(STATE_KEY, {});
    queue = Array.isArray(saved.queue) ? saved.queue.map(cleanTrack).filter(Boolean) : [];
    current = cleanTrack(saved.current);
    view = ['discover', 'queue', 'playlists'].includes(saved.view) ? saved.view : 'discover';
    activePlaylistId = typeof saved.activePlaylistId === 'string' ? saved.activePlaylistId : null;
    shuffle = Boolean(saved.shuffle);
    repeatMode = ['off', 'all', 'one'].includes(saved.repeatMode) ? saved.repeatMode : 'off';
    playlists = Array.isArray(playlists) ? playlists.map((playlist) => ({
      id: String(playlist.id || crypto.randomUUID()),
      name: String(playlist.name || 'Untitled playlist'),
      tracks: Array.isArray(playlist.tracks) ? playlist.tracks.map(cleanTrack).filter(Boolean) : [],
      createdAt: Number(playlist.createdAt) || Date.now(),
    })) : [];
    audio.volume = getSavedVolume();
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify({ queue, current, view, activePlaylistId, shuffle, repeatMode }));
  }

  function savePlaylists() {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  }

  function getSavedVolume() {
    const settings = loadJson(SETTINGS_KEY, {});
    const value = Number(settings.musicVolume);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : 0.55;
  }

  function saveVolume(value) {
    const settings = loadJson(SETTINGS_KEY, {});
    settings.musicVolume = Math.round(value * 100);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function formatCount(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function activePlaylist() {
    return playlists.find((playlist) => playlist.id === activePlaylistId) || null;
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    loadState();
    createInterface();
    render();
    if (current) loadTrack(current, false);
    void searchTracks('');
  }

  function createInterface() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-music-shell')) return;
    shell = document.createElement('div');
    shell.className = 'luma-music-shell luma-tool';
    shell.innerHTML = `<button class="icon-control luma-trigger luma-music-trigger" data-panel="music" aria-label="Online music" title="Online music">${icon('music')}<span class="luma-badge" hidden></span></button><div class="luma-popover luma-music-popover" hidden></div>`;
    actions.insertBefore(shell, actions.querySelector('.text-control') || actions.lastElementChild);
    popover = shell.querySelector('.luma-music-popover');

    focusPlayer = document.createElement('div');
    focusPlayer.className = 'luma-focus-player';
    focusPlayer.hidden = true;
    document.body.appendChild(focusPlayer);

    shell.addEventListener('click', handleClick);
    shell.addEventListener('input', handleInput);
    shell.addEventListener('submit', handleSubmit);
    focusPlayer.addEventListener('click', handleClick);
    document.addEventListener('mousedown', (event) => {
      if (shell && !shell.contains(event.target)) popover.hidden = true;
    });
    new MutationObserver(renderFocusPlayer).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function render() {
    if (!shell || !popover) return;
    const badge = shell.querySelector('.luma-badge');
    badge.hidden = queue.length === 0;
    badge.textContent = String(queue.length);
    popover.innerHTML = `
      <div class="luma-popover-heading"><div><strong>Online music</strong><small>Search and stream tracks from Audius</small></div><a class="luma-provider-link" href="https://audius.co" target="_blank" rel="noreferrer">Audius ${icon('external', 11)}</a></div>
      ${playerMarkup()}
      <div class="luma-library-tabs" role="tablist" aria-label="Music views">
        ${tabButton('discover', 'compass', 'Discover')}${tabButton('queue', 'queue', 'Queue', queue.length)}${tabButton('playlists', 'playlist', 'Playlists', playlists.length)}
      </div>
      <div class="luma-music-view">${view === 'discover' ? discoverMarkup() : view === 'queue' ? queueMarkup() : playlistsMarkup()}</div>
      ${status ? `<p class="luma-library-status">${escapeHtml(status)}</p>` : ''}
      <p class="luma-note">Tracks stream online from Audius. Luma stores only your queue and playlists in this browser.</p>`;
    syncPlaybackUi();
    renderFocusPlayer();
  }

  function tabButton(id, iconName, label, count = null) {
    return `<button role="tab" data-action="set-view" data-view="${id}" class="${view === id ? 'active' : ''}" aria-selected="${view === id}">${icon(iconName, 14)}<span>${label}</span>${count !== null ? `<small>${count}</small>` : ''}</button>`;
  }

  function playerMarkup() {
    if (!current) return `<div class="luma-online-hero">${icon('music', 24)}<div><strong>Search. Queue. Keep writing.</strong><small>Choose any available Audius track below to start playing.</small></div></div>`;
    return `<section class="luma-player luma-library-player">
      <div class="luma-track-summary">${current.artwork ? `<img src="${escapeHtml(current.artwork)}" alt="">` : `<i>${icon('music', 18)}</i>`}<div><strong title="${escapeHtml(current.title)}">${escapeHtml(current.title)}</strong><small>${escapeHtml(current.artist)}</small></div></div>
      <label class="luma-seek"><input data-input="seek" type="range" min="0" max="${Math.max(0, audio.duration || current.duration || 0)}" step="0.1" value="${Math.max(0, audio.currentTime || 0)}"><span data-time-current>${formatTime(audio.currentTime)}</span><span data-time-total>${formatTime(audio.duration || current.duration)}</span></label>
      <div class="luma-transport"><button data-action="toggle-shuffle" class="${shuffle ? 'active' : ''}" aria-label="Shuffle">${icon('shuffle', 15)}</button><button data-action="previous" aria-label="Previous">${icon('previous', 17)}</button><button class="luma-play" data-action="toggle-play" aria-label="${audio.paused ? 'Play' : 'Pause'}">${icon(audio.paused ? 'play' : 'pause', 18)}</button><button data-action="next" aria-label="Next">${icon('next', 17)}</button><button data-action="cycle-repeat" class="${repeatMode !== 'off' ? 'active' : ''}" aria-label="Repeat: ${repeatMode}">${icon('repeat', 15)}${repeatMode === 'one' ? '<small>1</small>' : ''}</button></div>
      <label class="luma-range luma-music-volume"><span>${icon('volume', 14)}</span><input data-input="volume" type="range" min="0" max="100" value="${Math.round(audio.volume * 100)}"><small>${Math.round(audio.volume * 100)}%</small></label>
    </section>`;
  }

  function discoverMarkup() {
    return `<form class="luma-online-search" data-form="search"><label>${icon('search', 14)}<input data-input="search" value="${escapeHtml(searchValue)}" placeholder="Search songs or artists" autocomplete="off"></label><button type="submit" ${loading ? 'disabled' : ''}>${loading ? 'Searching…' : 'Search'}</button></form>
      <div class="luma-library-meta"><span>${searchValue.trim() ? 'Search results' : 'Trending this week'}</span><small>${formatCount(results.length, 'track')}</small></div>
      ${loading ? '<div class="luma-online-loading"><i></i><span>Finding music…</span></div>' : results.length ? `<div class="luma-track-list">${results.map(resultRowMarkup).join('')}</div>` : `<div class="luma-library-empty">${icon('search', 22)}<strong>No tracks found</strong><small>Try another song, artist, genre, or mood.</small></div>`}`;
  }

  function resultRowMarkup(track) {
    const inQueue = queue.some((item) => sameTrack(item, track));
    const pickerOpen = playlistPickerTrackId === track.id;
    return `<div class="luma-track-block ${sameTrack(track, current) ? 'active' : ''}"><div class="luma-library-track"><button class="luma-track-main" data-action="play-result" data-id="${track.id}">${track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="">` : `<span>${sameTrack(track, current) && !audio.paused ? icon('pause', 12) : icon('play', 12)}</span>`}<span><strong title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}${track.duration ? ` · ${formatTime(track.duration)}` : ''}</small></span></button><div class="luma-track-actions"><button data-action="queue-result" data-id="${track.id}" class="${inQueue ? 'active' : ''}" aria-label="Add to queue">${icon(inQueue ? 'check' : 'queue', 13)}</button><button data-action="open-playlist-picker" data-id="${track.id}" aria-label="Add to playlist">${icon('playlist', 13)}</button></div></div>${pickerOpen ? playlistPickerMarkup(track) : ''}</div>`;
  }

  function playlistPickerMarkup(track) {
    return `<div class="luma-playlist-picker"><div><strong>Add to playlist</strong><button data-action="close-playlist-picker" aria-label="Close">${icon('x', 12)}</button></div>${playlists.length ? playlists.map((playlist) => { const included = playlist.tracks.some((item) => sameTrack(item, track)); return `<button data-action="toggle-track-playlist" data-track-id="${track.id}" data-playlist-id="${playlist.id}" class="${included ? 'active' : ''}"><span>${escapeHtml(playlist.name)}</span><small>${included ? 'Added' : formatCount(playlist.tracks.length, 'track')}</small></button>`; }).join('') : '<p>Create a playlist first from the Playlists tab.</p>'}</div>`;
  }

  function queueMarkup() {
    if (!queue.length) return `<div class="luma-library-empty">${icon('queue', 22)}<strong>The queue is empty</strong><small>Search online tracks and add what should play next.</small><button data-action="set-view" data-view="discover">Discover music</button></div>`;
    return `<div class="luma-queue-header"><span>${formatCount(queue.length, 'track')}</span><button data-action="clear-queue">Clear queue</button></div><div class="luma-queue-list">${queue.map((track, index) => `<div class="luma-queue-item ${sameTrack(track, current) ? 'active' : ''}"><button class="luma-queue-track" data-action="play-queue-index" data-index="${index}">${track.artwork ? `<img class="luma-queue-art" src="${escapeHtml(track.artwork)}" alt="">` : `<span class="luma-queue-icon">${sameTrack(track, current) && !audio.paused ? icon('pause', 11) : icon('play', 11)}</span>`}<span class="luma-queue-copy"><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span></button><div class="luma-queue-actions"><button data-action="move-queue" data-index="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>${icon('chevronUp', 12)}</button><button data-action="move-queue" data-index="${index}" data-direction="1" ${index === queue.length - 1 ? 'disabled' : ''}>${icon('chevronDown', 12)}</button><button data-action="remove-queue" data-index="${index}">${icon('x', 12)}</button></div></div>`).join('')}</div>`;
  }

  function playlistsMarkup() {
    const playlist = activePlaylist();
    if (playlist) return playlistDetailMarkup(playlist);
    return `<form class="luma-playlist-create" data-form="create-playlist"><input name="playlistName" placeholder="New playlist name" maxlength="60" autocomplete="off"><button type="submit">${icon('plus', 14)} Create</button></form>${playlists.length ? `<div class="luma-playlist-list">${playlists.map((item) => `<div class="luma-playlist-card"><button class="luma-playlist-open" data-action="open-playlist" data-id="${item.id}"><i>${icon('music', 16)}</i><span><strong>${escapeHtml(item.name)}</strong><small>${formatCount(item.tracks.length, 'track')}</small></span></button><div><button data-action="play-playlist" data-id="${item.id}">${icon('play', 13)}</button><button data-action="rename-playlist" data-id="${item.id}">${icon('more', 13)}</button><button data-action="delete-playlist" data-id="${item.id}">${icon('trash', 13)}</button></div></div>`).join('')}</div>` : `<div class="luma-library-empty">${icon('playlist', 22)}<strong>No playlists yet</strong><small>Create one, then add online tracks from Discover.</small></div>`}`;
  }

  function playlistDetailMarkup(playlist) {
    return `<div class="luma-playlist-detail-heading"><button data-action="close-playlist">${icon('chevronLeft', 14)}</button><div><strong>${escapeHtml(playlist.name)}</strong><small>${formatCount(playlist.tracks.length, 'track')}</small></div><div><button data-action="play-playlist" data-id="${playlist.id}" ${playlist.tracks.length ? '' : 'disabled'}>${icon('play', 13)} Play</button><button data-action="shuffle-playlist" data-id="${playlist.id}" ${playlist.tracks.length ? '' : 'disabled'}>${icon('shuffle', 13)}</button></div></div>${playlist.tracks.length ? `<div class="luma-track-list">${playlist.tracks.map((track) => `<div class="luma-library-track ${sameTrack(track, current) ? 'active' : ''}"><button class="luma-track-main" data-action="play-saved-track" data-track="${escapeHtml(encodeURIComponent(JSON.stringify(track)))}">${track.artwork ? `<img src="${escapeHtml(track.artwork)}" alt="">` : `<span>${icon('play', 12)}</span>`}<span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span></button><div class="luma-track-actions"><button data-action="queue-saved-track" data-track="${escapeHtml(encodeURIComponent(JSON.stringify(track)))}">${icon('queue', 13)}</button><button data-action="remove-from-playlist" data-track-id="${track.id}" data-playlist-id="${playlist.id}">${icon('x', 13)}</button></div></div>`).join('')}</div>` : `<div class="luma-library-empty"><strong>This playlist is empty</strong><small>Add tracks from Discover.</small><button data-action="set-view" data-view="discover">Discover music</button></div>`}`;
  }

  function renderFocusPlayer() {
    if (!focusPlayer) return;
    const app = document.querySelector('.app');
    focusPlayer.hidden = !app?.classList.contains('focus-mode') || !current;
    if (focusPlayer.hidden) return;
    focusPlayer.innerHTML = `<button data-action="previous">${icon('previous', 14)}</button><button class="luma-focus-play" data-action="toggle-play">${icon(audio.paused ? 'play' : 'pause', 14)}</button><div><strong>${escapeHtml(current.title)}</strong><small data-focus-time>${formatTime(audio.currentTime)} / ${formatTime(audio.duration || current.duration)}</small></div><button data-action="next">${icon('next', 14)}</button>`;
  }

  function findResult(id) {
    return results.find((track) => track.id === id) || null;
  }

  function parseTrackAttribute(value) {
    try { return cleanTrack(JSON.parse(decodeURIComponent(value || ''))); } catch { return null; }
  }

  async function searchTracks(query) {
    const token = ++requestId;
    loading = true;
    status = '';
    render();
    try {
      const response = await fetch(`/api/audius${query ? `?q=${encodeURIComponent(query)}` : ''}`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Online music search failed.');
      if (token !== requestId) return;
      results = Array.isArray(payload.tracks) ? payload.tracks.map(cleanTrack).filter(Boolean) : [];
      status = results.length ? '' : 'No tracks matched that search.';
    } catch (error) {
      if (token !== requestId) return;
      results = [];
      status = error instanceof Error ? error.message : 'Could not search online music.';
    } finally {
      if (token === requestId) { loading = false; render(); }
    }
  }

  async function loadTrack(track, autoplay = true) {
    current = cleanTrack(track);
    if (!current) return;
    audio.src = current.streamUrl;
    audio.volume = getSavedVolume();
    audio.load();
    updateMediaSession(current);
    saveState();
    if (autoplay) {
      try { await audio.play(); } catch { status = 'Press play to allow audio in this browser.'; }
    }
    render();
  }

  function playTrack(track) {
    if (!track) return;
    if (!queue.some((item) => sameTrack(item, track))) queue.push(track);
    if (sameTrack(current, track) && audio.src) { void togglePlay(); return; }
    void loadTrack(track, true);
  }

  function queueTrack(track) {
    if (!track) return;
    if (queue.some((item) => sameTrack(item, track))) status = 'That track is already in the queue.';
    else { queue.push(track); status = `Queued “${track.title}”.`; }
    if (!current) current = track;
    saveState();
    render();
  }

  async function togglePlay() {
    if (!current) {
      const first = queue[0] || results[0];
      if (!first) { view = 'discover'; render(); return; }
      await loadTrack(first, true);
      return;
    }
    if (!audio.src) { await loadTrack(current, true); return; }
    if (audio.paused) { try { await audio.play(); } catch { status = 'Press play again to allow audio.'; } }
    else audio.pause();
    render();
  }

  function currentQueueIndex() {
    return queue.findIndex((track) => sameTrack(track, current));
  }

  function nextTrack(fromEnded = false) {
    if (!queue.length) return;
    if (fromEnded && repeatMode === 'one') { audio.currentTime = 0; void audio.play(); return; }
    let index = currentQueueIndex();
    if (shuffle && queue.length > 1) {
      const choices = queue.map((_, i) => i).filter((i) => i !== index);
      index = choices[Math.floor(Math.random() * choices.length)];
    } else {
      index += 1;
      if (index >= queue.length) {
        if (repeatMode === 'all') index = 0;
        else { audio.pause(); audio.currentTime = 0; render(); return; }
      }
    }
    void loadTrack(queue[Math.max(0, index)], true);
  }

  function previousTrack() {
    if (audio.currentTime > 3) { audio.currentTime = 0; syncPlaybackUi(); return; }
    if (!queue.length) return;
    let index = currentQueueIndex();
    index = index > 0 ? index - 1 : repeatMode === 'all' ? queue.length - 1 : 0;
    void loadTrack(queue[index], true);
  }

  function moveQueue(index, direction) {
    const target = index + direction;
    if (index < 0 || target < 0 || target >= queue.length) return;
    [queue[index], queue[target]] = [queue[target], queue[index]];
    saveState(); render();
  }

  function removeQueue(index) {
    const removed = queue[index];
    queue.splice(index, 1);
    if (sameTrack(removed, current)) {
      const replacement = queue[index] || queue[index - 1] || null;
      if (replacement) void loadTrack(replacement, !audio.paused);
      else { current = null; audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }
    saveState(); render();
  }

  function createPlaylist(name) {
    const clean = name.trim();
    if (!clean) return;
    const playlist = { id: crypto.randomUUID?.() || `${Date.now()}`, name: clean, tracks: [], createdAt: Date.now() };
    playlists.push(playlist); activePlaylistId = playlist.id; savePlaylists(); saveState(); render();
  }

  function toggleTrackPlaylist(track, playlistId) {
    if (!track) return;
    playlists = playlists.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      const exists = playlist.tracks.some((item) => sameTrack(item, track));
      return { ...playlist, tracks: exists ? playlist.tracks.filter((item) => !sameTrack(item, track)) : [...playlist.tracks, track] };
    });
    savePlaylists(); render();
  }

  function playPlaylist(id, shouldShuffle = false) {
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist?.tracks.length) return;
    queue = [...playlist.tracks];
    if (shouldShuffle) queue.sort(() => Math.random() - 0.5);
    shuffle = shouldShuffle;
    void loadTrack(queue[0], true);
  }

  function renamePlaylist(id) {
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist) return;
    const name = prompt('Rename playlist', playlist.name)?.trim();
    if (!name) return;
    playlist.name = name; savePlaylists(); render();
  }

  function deletePlaylist(id) {
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist || !confirm(`Delete playlist “${playlist.name}”?`)) return;
    playlists = playlists.filter((item) => item.id !== id);
    if (activePlaylistId === id) activePlaylistId = null;
    savePlaylists(); saveState(); render();
  }

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: 'Audius', artwork: track.artwork ? [{ src: track.artwork }] : [] });
    } catch {}
  }

  function syncPlaybackUi() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : current?.duration || 0;
    const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    document.querySelectorAll('[data-input="seek"]').forEach((seek) => { seek.max = String(Math.max(0, duration)); seek.value = String(Math.min(duration || time, time)); });
    document.querySelectorAll('[data-time-current]').forEach((node) => { node.textContent = formatTime(time); });
    document.querySelectorAll('[data-time-total]').forEach((node) => { node.textContent = formatTime(duration); });
    document.querySelectorAll('[data-focus-time]').forEach((node) => { node.textContent = `${formatTime(time)} / ${formatTime(duration)}`; });
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.panel === 'music') { popover.hidden = !popover.hidden; if (!popover.hidden) setTimeout(() => popover.querySelector('[data-input="search"]')?.focus(), 0); return; }
    const action = button.dataset.action;
    if (action === 'set-view') { view = button.dataset.view; if (view !== 'playlists') activePlaylistId = null; saveState(); render(); }
    else if (action === 'play-result') playTrack(findResult(button.dataset.id));
    else if (action === 'queue-result') queueTrack(findResult(button.dataset.id));
    else if (action === 'open-playlist-picker') { playlistPickerTrackId = playlistPickerTrackId === button.dataset.id ? null : button.dataset.id; render(); }
    else if (action === 'close-playlist-picker') { playlistPickerTrackId = null; render(); }
    else if (action === 'toggle-track-playlist') toggleTrackPlaylist(findResult(button.dataset.trackId), button.dataset.playlistId);
    else if (action === 'play-saved-track') playTrack(parseTrackAttribute(button.dataset.track));
    else if (action === 'queue-saved-track') queueTrack(parseTrackAttribute(button.dataset.track));
    else if (action === 'play-queue-index') void loadTrack(queue[Number(button.dataset.index)], true);
    else if (action === 'move-queue') moveQueue(Number(button.dataset.index), Number(button.dataset.direction));
    else if (action === 'remove-queue') removeQueue(Number(button.dataset.index));
    else if (action === 'clear-queue') { queue = []; current = null; audio.pause(); audio.removeAttribute('src'); audio.load(); saveState(); render(); }
    else if (action === 'toggle-play') void togglePlay();
    else if (action === 'next') nextTrack(false);
    else if (action === 'previous') previousTrack();
    else if (action === 'toggle-shuffle') { shuffle = !shuffle; saveState(); render(); }
    else if (action === 'cycle-repeat') { repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'; saveState(); render(); }
    else if (action === 'open-playlist') { activePlaylistId = button.dataset.id; saveState(); render(); }
    else if (action === 'close-playlist') { activePlaylistId = null; saveState(); render(); }
    else if (action === 'play-playlist') playPlaylist(button.dataset.id, false);
    else if (action === 'shuffle-playlist') playPlaylist(button.dataset.id, true);
    else if (action === 'rename-playlist') renamePlaylist(button.dataset.id);
    else if (action === 'delete-playlist') deletePlaylist(button.dataset.id);
    else if (action === 'remove-from-playlist') { playlists = playlists.map((playlist) => playlist.id === button.dataset.playlistId ? { ...playlist, tracks: playlist.tracks.filter((track) => track.id !== button.dataset.trackId) } : playlist); savePlaylists(); render(); }
  }

  function handleInput(event) {
    if (event.target.dataset.input === 'search') searchValue = event.target.value;
    else if (event.target.dataset.input === 'seek') { audio.currentTime = Number(event.target.value) || 0; syncPlaybackUi(); }
    else if (event.target.dataset.input === 'volume') { audio.volume = (Number(event.target.value) || 0) / 100; saveVolume(audio.volume); event.target.parentElement.querySelector('small').textContent = `${Math.round(audio.volume * 100)}%`; }
  }

  function handleSubmit(event) {
    const form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'search') void searchTracks(searchValue.trim());
    else if (form.dataset.form === 'create-playlist') createPlaylist(new FormData(form).get('playlistName')?.toString() || '');
  }

  audio.addEventListener('loadedmetadata', render);
  audio.addEventListener('timeupdate', syncPlaybackUi);
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => nextTrack(true));
  audio.addEventListener('error', () => { status = 'This online track could not be streamed. Try another result.'; render(); });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => void togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => void togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false));
      navigator.mediaSession.setActionHandler('seekto', (details) => { if (typeof details.seekTime === 'number') audio.currentTime = details.seekTime; });
    } catch {}
  }

  new MutationObserver(() => { if (!shell) createInterface(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true }); else initialize();
})();
