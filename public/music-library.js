(() => {
  'use strict';

  const DB_NAME = 'luma-music-library-v1';
  const DB_VERSION = 1;
  const TRACK_STORE = 'tracks';
  const STATE_KEY = 'luma-music-state-v3';
  const PLAYLISTS_KEY = 'luma-music-playlists-v1';
  const SETTINGS_KEY = 'luma-ambience-settings-v2';
  const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|m4a|aac|ogg|oga|opus|webm)$/i;

  const audio = new Audio();
  audio.preload = 'metadata';

  let database;
  let shell;
  let popover;
  let fileInput;
  let folderInput;
  let focusPlayer;
  let tracks = [];
  let playlists = loadJson(PLAYLISTS_KEY, []);
  let queue = [];
  let currentId = null;
  let view = 'library';
  let searchValue = '';
  let activePlaylistId = null;
  let playlistPickerTrackId = null;
  let shuffle = false;
  let repeatMode = 'off';
  let status = '';
  let currentObjectUrl = '';
  let initialized = false;
  let rendering = false;

  const ICONS = {
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    folder: '<path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/>',
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v4h16v-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    play: '<path d="m7 4 13 8-13 8V4Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    previous: '<path d="M19 20 9 12l10-8v16ZM5 19V5"/>',
    next: '<path d="m5 4 10 8-10 8V4ZM19 5v14"/>',
    shuffle: '<path d="M3 7h3c5 0 6 10 11 10h4"/><path d="m18 14 3 3-3 3"/><path d="M3 17h3c1.8 0 3.1-1.3 4.3-3"/><path d="M14.7 10C16 8.3 17 7 21 7"/><path d="m18 4 3 3-3 3"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    queue: '<path d="M8 6h13M8 12h13M8 18h8"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    playlist: '<path d="M4 6h10M4 11h10M4 16h7"/><path d="M18 13v7"/><path d="M15 17h6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronUp: '<path d="m18 15-6-6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
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

  function makeId() {
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadState() {
    const saved = loadJson(STATE_KEY, {});
    queue = Array.isArray(saved.queue) ? saved.queue : [];
    currentId = typeof saved.currentId === 'string' ? saved.currentId : null;
    shuffle = Boolean(saved.shuffle);
    repeatMode = ['off', 'all', 'one'].includes(saved.repeatMode) ? saved.repeatMode : 'off';
    view = ['library', 'queue', 'playlists'].includes(saved.view) ? saved.view : 'library';
    activePlaylistId = typeof saved.activePlaylistId === 'string' ? saved.activePlaylistId : null;
    audio.volume = getSavedVolume();
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      queue,
      currentId,
      shuffle,
      repeatMode,
      view,
      activePlaylistId,
    }));
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

  function openDatabase() {
    if (database) return Promise.resolve(database);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TRACK_STORE)) {
          const store = db.createObjectStore(TRACK_STORE, { keyPath: 'id' });
          store.createIndex('fingerprint', 'fingerprint', { unique: true });
          store.createIndex('addedAt', 'addedAt');
        }
      };
      request.onsuccess = () => {
        database = request.result;
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error('Could not open the music library.'));
    });
  }

  async function getAllTracks() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(TRACK_STORE, 'readonly').objectStore(TRACK_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error('Could not read the music library.'));
    });
  }

  async function putTrack(track) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(TRACK_STORE, 'readwrite').objectStore(TRACK_STORE).put(track);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Could not save the track.'));
    });
  }

  async function deleteTrackFromDb(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(TRACK_STORE, 'readwrite').objectStore(TRACK_STORE).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Could not delete the track.'));
    });
  }

  async function clearTrackDb() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(TRACK_STORE, 'readwrite').objectStore(TRACK_STORE).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Could not clear the music library.'));
    });
  }

  function currentTrack() {
    return tracks.find((track) => track.id === currentId) || null;
  }

  function trackById(id) {
    return tracks.find((track) => track.id === id) || null;
  }

  function activePlaylist() {
    return playlists.find((playlist) => playlist.id === activePlaylistId) || null;
  }

  function cleanReferences() {
    const valid = new Set(tracks.map((track) => track.id));
    queue = queue.filter((id) => valid.has(id));
    if (!valid.has(currentId)) currentId = queue[0] || null;
    playlists = playlists.map((playlist) => ({
      ...playlist,
      trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds.filter((id) => valid.has(id)) : [],
    }));
    if (activePlaylistId && !playlists.some((playlist) => playlist.id === activePlaylistId)) activePlaylistId = null;
    savePlaylists();
    saveState();
  }

  function parseFileName(fileName) {
    const base = fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim() || 'Untitled track';
    const pieces = base.split(/\s+-\s+/).map((piece) => piece.trim()).filter(Boolean);
    if (pieces.length >= 2) {
      return { artist: pieces.shift(), name: pieces.join(' - ') };
    }
    return { artist: 'Unknown artist', name: base };
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function formatCount(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function filteredTracks() {
    const query = searchValue.trim().toLowerCase();
    const sorted = [...tracks].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (!query) return sorted;
    return sorted.filter((track) => `${track.name} ${track.artist} ${track.album || ''}`.toLowerCase().includes(query));
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    loadState();
    try {
      tracks = await getAllTracks();
      cleanReferences();
      status = tracks.length ? '' : 'Import audio files or a folder to build your library.';
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not open the local music library.';
    }
    createInterface();
    render();
    if (currentId) loadCurrentTrack(false);
  }

  function createInterface() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-music-shell')) return;

    shell = document.createElement('div');
    shell.className = 'luma-music-shell luma-tool';
    shell.innerHTML = `
      <button class="icon-control luma-trigger luma-music-trigger" data-panel="music" aria-label="Music library" title="Music library">
        ${icon('music')}
        <span class="luma-badge" hidden></span>
      </button>
      <div class="luma-popover luma-music-popover" hidden></div>`;
    actions.insertBefore(shell, actions.querySelector('.text-control') || actions.lastElementChild);
    popover = shell.querySelector('.luma-music-popover');

    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.oga,.opus,.webm';
    fileInput.multiple = true;
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => importFiles(fileInput.files));
    document.body.appendChild(fileInput);

    folderInput = document.createElement('input');
    folderInput.type = 'file';
    folderInput.accept = fileInput.accept;
    folderInput.multiple = true;
    folderInput.hidden = true;
    folderInput.setAttribute('webkitdirectory', '');
    folderInput.setAttribute('directory', '');
    folderInput.addEventListener('change', () => importFiles(folderInput.files));
    document.body.appendChild(folderInput);

    focusPlayer = document.createElement('div');
    focusPlayer.className = 'luma-focus-player';
    focusPlayer.hidden = true;
    document.body.appendChild(focusPlayer);

    shell.addEventListener('click', handleClick);
    shell.addEventListener('input', handleInput);
    shell.addEventListener('change', handleChange);
    shell.addEventListener('submit', handleSubmit);
    focusPlayer.addEventListener('click', handleClick);

    popover.addEventListener('dragenter', handleDrag);
    popover.addEventListener('dragover', handleDrag);
    popover.addEventListener('dragleave', handleDragLeave);
    popover.addEventListener('drop', handleDrop);

    document.addEventListener('mousedown', (event) => {
      if (shell && !shell.contains(event.target)) popover.hidden = true;
    });

    new MutationObserver(renderFocusPlayer).observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    render();
  }

  function render() {
    if (!shell || !popover || rendering) return;
    rendering = true;

    const badge = shell.querySelector('.luma-badge');
    badge.hidden = queue.length === 0;
    badge.textContent = String(queue.length);

    popover.innerHTML = `
      <div class="luma-popover-heading">
        <div><strong>Music library</strong><small>Search imported tracks, build playlists, and manage your queue</small></div>
        <button class="luma-add" data-action="add-files">${icon('plus', 14)} Import</button>
      </div>

      ${playerMarkup()}

      <div class="luma-library-tabs" role="tablist" aria-label="Music views">
        ${tabButton('library', 'list', 'Library')}
        ${tabButton('queue', 'queue', 'Queue', queue.length)}
        ${tabButton('playlists', 'playlist', 'Playlists', playlists.length)}
      </div>

      <div class="luma-music-view">
        ${view === 'library' ? libraryMarkup() : view === 'queue' ? queueMarkup() : playlistsMarkup()}
      </div>

      ${status ? `<p class="luma-library-status">${escapeHtml(status)}</p>` : ''}
      <p class="luma-note">Music files and playlists are stored locally in this browser. Search covers imported tracks only.</p>
      <div class="luma-drop-overlay" aria-hidden="true">${icon('upload', 23)}<strong>Drop audio files to import</strong></div>`;

    rendering = false;
    syncPlaybackUi();
    renderFocusPlayer();
  }

  function tabButton(id, iconName, label, count = null) {
    return `<button role="tab" data-action="set-view" data-view="${id}" class="${view === id ? 'active' : ''}" aria-selected="${view === id}">${icon(iconName, 14)}<span>${label}</span>${count !== null ? `<small>${count}</small>` : ''}</button>`;
  }

  function playerMarkup() {
    const track = currentTrack();
    if (!track) {
      return `<button class="luma-empty-music" data-action="add-files">${icon('music', 23)}<strong>Your music, without another account</strong><small>Import MP3, WAV, FLAC, M4A, OGG, AAC, Opus, or WebM audio.</small></button>`;
    }

    return `
      <section class="luma-player luma-library-player">
        <div class="luma-track-summary">
          <i>${icon('music', 18)}</i>
          <div><strong title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist || 'Unknown artist')}</small></div>
        </div>
        <label class="luma-seek">
          <input data-input="seek" type="range" min="0" max="${Math.max(0, audio.duration || track.duration || 0)}" step="0.1" value="${Math.max(0, audio.currentTime || 0)}">
          <span data-time-current>${formatTime(audio.currentTime)}</span><span data-time-total>${formatTime(audio.duration || track.duration)}</span>
        </label>
        <div class="luma-transport">
          <button data-action="toggle-shuffle" class="${shuffle ? 'active' : ''}" aria-label="Shuffle" title="Shuffle">${icon('shuffle', 15)}</button>
          <button data-action="previous" aria-label="Previous" title="Previous">${icon('previous', 17)}</button>
          <button class="luma-play" data-action="toggle-play" aria-label="${audio.paused ? 'Play' : 'Pause'}">${icon(audio.paused ? 'play' : 'pause', 18)}</button>
          <button data-action="next" aria-label="Next" title="Next">${icon('next', 17)}</button>
          <button data-action="cycle-repeat" class="${repeatMode !== 'off' ? 'active' : ''}" aria-label="Repeat: ${repeatMode}" title="Repeat: ${repeatMode}">${icon('repeat', 15)}${repeatMode === 'one' ? '<small>1</small>' : ''}</button>
        </div>
        <label class="luma-range luma-music-volume"><span>${icon('volume', 14)}</span><input data-input="volume" type="range" min="0" max="100" value="${Math.round(audio.volume * 100)}"><small>${Math.round(audio.volume * 100)}%</small></label>
      </section>`;
  }

  function libraryMarkup() {
    const visible = filteredTracks();
    return `
      <div class="luma-library-toolbar">
        <label class="luma-library-search">${icon('search', 14)}<input data-input="library-search" value="${escapeHtml(searchValue)}" placeholder="Search songs or artists" autocomplete="off">${searchValue ? `<button type="button" data-action="clear-search" aria-label="Clear search">${icon('x', 12)}</button>` : ''}</label>
        <button data-action="add-folder" title="Import a folder">${icon('folder', 15)}<span>Folder</span></button>
      </div>
      <div class="luma-library-meta"><span>${formatCount(visible.length, 'track')}</span>${tracks.length ? `<button data-action="clear-library">Clear library</button>` : ''}</div>
      ${visible.length ? `<div class="luma-track-list">${visible.map(trackRowMarkup).join('')}</div>` : emptyLibraryMarkup()}`;
  }

  function emptyLibraryMarkup() {
    return `<div class="luma-library-empty">${icon(searchValue ? 'search' : 'folder', 22)}<strong>${searchValue ? 'No matching tracks' : 'Your library is empty'}</strong><small>${searchValue ? 'Try a different song or artist.' : 'Import individual files or an entire music folder.'}</small>${!searchValue ? `<button data-action="add-files">Import music</button>` : ''}</div>`;
  }

  function trackRowMarkup(track) {
    const inQueue = queue.includes(track.id);
    const pickerOpen = playlistPickerTrackId === track.id;
    return `
      <div class="luma-track-block ${track.id === currentId ? 'active' : ''}">
        <div class="luma-library-track">
          <button class="luma-track-main" data-action="play-track" data-id="${track.id}">
            <span>${track.id === currentId && !audio.paused ? icon('pause', 12) : icon('play', 12)}</span>
            <span><strong title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist || 'Unknown artist')}${track.duration ? ` · ${formatTime(track.duration)}` : ''}</small></span>
          </button>
          <div class="luma-track-actions">
            <button data-action="queue-track" data-id="${track.id}" class="${inQueue ? 'active' : ''}" aria-label="${inQueue ? 'Already queued' : 'Add to queue'}" title="${inQueue ? 'Already queued' : 'Add to queue'}">${icon(inQueue ? 'check' : 'queue', 13)}</button>
            <button data-action="open-playlist-picker" data-id="${track.id}" aria-label="Add to playlist" title="Add to playlist">${icon('playlist', 13)}</button>
            <button data-action="delete-track" data-id="${track.id}" aria-label="Delete track" title="Delete track">${icon('trash', 13)}</button>
          </div>
        </div>
        ${pickerOpen ? playlistPickerMarkup(track.id) : ''}
      </div>`;
  }

  function playlistPickerMarkup(trackId) {
    return `<div class="luma-playlist-picker"><div><strong>Add to playlist</strong><button data-action="close-playlist-picker" aria-label="Close">${icon('x', 12)}</button></div>${playlists.length ? playlists.map((playlist) => {
      const included = playlist.trackIds.includes(trackId);
      return `<button data-action="toggle-track-playlist" data-track-id="${trackId}" data-playlist-id="${playlist.id}" class="${included ? 'active' : ''}"><span>${escapeHtml(playlist.name)}</span><small>${included ? 'Added' : formatCount(playlist.trackIds.length, 'track')}</small></button>`;
    }).join('') : '<p>Create a playlist first from the Playlists tab.</p>'}</div>`;
  }

  function queueMarkup() {
    if (!queue.length) {
      return `<div class="luma-library-empty">${icon('queue', 22)}<strong>The queue is empty</strong><small>Add tracks from your library to line up what plays next.</small><button data-action="set-view" data-view="library">Open library</button></div>`;
    }

    return `
      <div class="luma-queue-header"><span>${formatCount(queue.length, 'track')}</span><button data-action="clear-queue">Clear queue</button></div>
      <div class="luma-queue-list">${queue.map((id, index) => {
        const track = trackById(id);
        if (!track) return '';
        return `<div class="luma-queue-item ${id === currentId ? 'active' : ''}">
          <button class="luma-queue-track" data-action="play-queue-index" data-index="${index}">
            <span class="luma-queue-icon">${id === currentId && !audio.paused ? icon('pause', 11) : icon('play', 11)}</span>
            <span class="luma-queue-copy"><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist || 'Unknown artist')}</small></span>
          </button>
          <div class="luma-queue-actions">
            <button data-action="move-queue" data-index="${index}" data-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="Move up">${icon('chevronUp', 12)}</button>
            <button data-action="move-queue" data-index="${index}" data-direction="1" ${index === queue.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('chevronDown', 12)}</button>
            <button data-action="remove-queue" data-index="${index}" aria-label="Remove from queue">${icon('x', 12)}</button>
          </div>
        </div>`;
      }).join('')}</div>`;
  }

  function playlistsMarkup() {
    const playlist = activePlaylist();
    if (playlist) return playlistDetailMarkup(playlist);

    return `
      <form class="luma-playlist-create" data-form="create-playlist">
        <input name="playlistName" placeholder="New playlist name" maxlength="60" autocomplete="off">
        <button type="submit">${icon('plus', 14)} Create</button>
      </form>
      ${playlists.length ? `<div class="luma-playlist-list">${playlists.map((item) => `
        <div class="luma-playlist-card">
          <button class="luma-playlist-open" data-action="open-playlist" data-id="${item.id}">
            <i>${icon('music', 16)}</i><span><strong>${escapeHtml(item.name)}</strong><small>${formatCount(item.trackIds.length, 'track')}</small></span>
          </button>
          <div><button data-action="play-playlist" data-id="${item.id}" aria-label="Play playlist">${icon('play', 13)}</button><button data-action="rename-playlist" data-id="${item.id}" aria-label="Rename playlist">${icon('more', 13)}</button><button data-action="delete-playlist" data-id="${item.id}" aria-label="Delete playlist">${icon('trash', 13)}</button></div>
        </div>`).join('')}</div>` : `<div class="luma-library-empty">${icon('playlist', 22)}<strong>No playlists yet</strong><small>Create one, then add tracks from your library.</small></div>`}`;
  }

  function playlistDetailMarkup(playlist) {
    const playlistTracks = playlist.trackIds.map(trackById).filter(Boolean);
    return `
      <div class="luma-playlist-detail-heading">
        <button data-action="close-playlist">${icon('chevronLeft', 14)}</button>
        <div><strong>${escapeHtml(playlist.name)}</strong><small>${formatCount(playlistTracks.length, 'track')}</small></div>
        <div><button data-action="play-playlist" data-id="${playlist.id}" ${playlistTracks.length ? '' : 'disabled'}>${icon('play', 13)} Play</button><button data-action="shuffle-playlist" data-id="${playlist.id}" ${playlistTracks.length ? '' : 'disabled'}>${icon('shuffle', 13)}</button></div>
      </div>
      ${playlistTracks.length ? `<div class="luma-track-list">${playlistTracks.map((track) => `
        <div class="luma-library-track ${track.id === currentId ? 'active' : ''}">
          <button class="luma-track-main" data-action="play-track" data-id="${track.id}"><span>${icon(track.id === currentId && !audio.paused ? 'pause' : 'play', 12)}</span><span><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.artist || 'Unknown artist')}</small></span></button>
          <div class="luma-track-actions"><button data-action="queue-track" data-id="${track.id}" aria-label="Add to queue">${icon('queue', 13)}</button><button data-action="remove-from-playlist" data-track-id="${track.id}" data-playlist-id="${playlist.id}" aria-label="Remove from playlist">${icon('x', 13)}</button></div>
        </div>`).join('')}</div>` : `<div class="luma-library-empty"><strong>This playlist is empty</strong><small>Add tracks from the Library tab.</small><button data-action="set-view" data-view="library">Open library</button></div>`}`;
  }

  function renderFocusPlayer() {
    if (!focusPlayer) return;
    const app = document.querySelector('.app');
    const track = currentTrack();
    focusPlayer.hidden = !app?.classList.contains('focus-mode') || !track;
    if (focusPlayer.hidden) return;
    focusPlayer.innerHTML = `<button data-action="previous" aria-label="Previous">${icon('previous', 14)}</button><button class="luma-focus-play" data-action="toggle-play" aria-label="${audio.paused ? 'Play' : 'Pause'}">${icon(audio.paused ? 'play' : 'pause', 14)}</button><div><strong>${escapeHtml(track.name)}</strong><small data-focus-time>${formatTime(audio.currentTime)} / ${formatTime(audio.duration || track.duration)}</small></div><button data-action="next" aria-label="Next">${icon('next', 14)}</button>`;
  }

  function syncPlaybackUi() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : currentTrack()?.duration || 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    for (const seek of document.querySelectorAll('[data-input="seek"]')) {
      seek.max = String(Math.max(0, duration));
      seek.value = String(Math.min(duration || current, current));
    }
    for (const node of document.querySelectorAll('[data-time-current]')) node.textContent = formatTime(current);
    for (const node of document.querySelectorAll('[data-time-total]')) node.textContent = formatTime(duration);
    for (const node of document.querySelectorAll('[data-focus-time]')) node.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }

  async function importFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(file.name));
    fileInput.value = '';
    folderInput.value = '';
    if (!files.length) {
      status = 'No supported audio files were found.';
      render();
      return;
    }

    status = `Importing ${formatCount(files.length, 'track')}…`;
    render();
    const fingerprints = new Set(tracks.map((track) => track.fingerprint));
    let imported = 0;
    let skipped = 0;

    for (const file of files) {
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      if (fingerprints.has(fingerprint)) {
        skipped += 1;
        continue;
      }
      const parsed = parseFileName(file.name);
      const track = {
        id: makeId(),
        name: parsed.name,
        artist: parsed.artist,
        album: 'Local library',
        duration: 0,
        type: file.type || 'audio/mpeg',
        size: file.size,
        lastModified: file.lastModified,
        fingerprint,
        addedAt: Date.now() + imported,
        blob: file,
      };
      try {
        await putTrack(track);
        tracks.push(track);
        fingerprints.add(fingerprint);
        imported += 1;
      } catch (error) {
        if (error?.name === 'ConstraintError') skipped += 1;
        else status = error instanceof Error ? error.message : 'A track could not be imported.';
      }
    }

    status = `Imported ${formatCount(imported, 'track')}${skipped ? ` · skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`;
    if (!currentId && tracks[0]) {
      queueTrack(tracks[tracks.length - imported]?.id || tracks[0].id, false);
    }
    render();
  }

  async function loadCurrentTrack(autoplay = true) {
    const track = currentTrack();
    if (!track?.blob) return;

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(track.blob);
    audio.src = currentObjectUrl;
    audio.volume = getSavedVolume();
    audio.load();
    updateMediaSession(track);

    if (autoplay) {
      try {
        await audio.play();
      } catch {
        status = 'Press play to start audio in this browser.';
      }
    }
    saveState();
    render();
  }

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.name, artist: track.artist || 'Unknown artist', album: track.album || 'Luma' });
    } catch {
      // Some browsers expose mediaSession without MediaMetadata.
    }
  }

  function playTrack(id) {
    if (!trackById(id)) return;
    if (!queue.includes(id)) queue.push(id);
    if (currentId === id && audio.src) {
      togglePlay();
      return;
    }
    currentId = id;
    void loadCurrentTrack(true);
  }

  function playQueueIndex(index) {
    const id = queue[index];
    if (!id) return;
    currentId = id;
    void loadCurrentTrack(true);
  }

  function queueTrack(id, announce = true) {
    const track = trackById(id);
    if (!track) return;
    if (!queue.includes(id)) {
      queue.push(id);
      if (announce) status = `Queued “${track.name}”.`;
    } else if (announce) {
      status = 'That track is already in the queue.';
    }
    if (!currentId) currentId = id;
    saveState();
    render();
  }

  async function togglePlay() {
    if (!currentId) {
      const first = queue[0] || tracks[0]?.id;
      if (!first) {
        fileInput.click();
        return;
      }
      currentId = first;
      if (!queue.includes(first)) queue.push(first);
      await loadCurrentTrack(true);
      return;
    }
    if (!audio.src) {
      await loadCurrentTrack(true);
      return;
    }
    if (audio.paused) {
      try { await audio.play(); } catch { status = 'Press play again to allow audio.'; }
    } else {
      audio.pause();
    }
    render();
  }

  function nextTrack(fromEnded = false) {
    if (!queue.length) return;
    if (fromEnded && repeatMode === 'one') {
      audio.currentTime = 0;
      void audio.play();
      return;
    }

    let nextIndex;
    const currentIndex = queue.indexOf(currentId);
    if (shuffle && queue.length > 1) {
      const choices = queue.map((_, index) => index).filter((index) => index !== currentIndex);
      nextIndex = choices[Math.floor(Math.random() * choices.length)];
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else {
          audio.pause();
          audio.currentTime = 0;
          render();
          return;
        }
      }
    }
    playQueueIndex(Math.max(0, nextIndex));
  }

  function previousTrack() {
    if (!queue.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      syncPlaybackUi();
      return;
    }
    const currentIndex = Math.max(0, queue.indexOf(currentId));
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : repeatMode === 'all' ? queue.length - 1 : 0;
    playQueueIndex(previousIndex);
  }

  function moveQueue(index, direction) {
    const target = index + direction;
    if (index < 0 || target < 0 || target >= queue.length) return;
    [queue[index], queue[target]] = [queue[target], queue[index]];
    saveState();
    render();
  }

  function removeFromQueue(index) {
    const removed = queue[index];
    queue.splice(index, 1);
    if (removed === currentId) {
      currentId = queue[index] || queue[index - 1] || null;
      if (currentId) void loadCurrentTrack(!audio.paused);
      else stopPlayback();
    }
    saveState();
    render();
  }

  function clearQueue() {
    queue = [];
    currentId = null;
    stopPlayback();
    saveState();
    status = 'Queue cleared.';
    render();
  }

  function stopPlayback() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = '';
  }

  async function deleteTrack(id) {
    const track = trackById(id);
    if (!track || !confirm(`Delete “${track.name}” from this browser?`)) return;
    await deleteTrackFromDb(id);
    tracks = tracks.filter((item) => item.id !== id);
    queue = queue.filter((item) => item !== id);
    playlists = playlists.map((playlist) => ({ ...playlist, trackIds: playlist.trackIds.filter((item) => item !== id) }));
    if (currentId === id) {
      currentId = queue[0] || null;
      if (currentId) void loadCurrentTrack(false);
      else stopPlayback();
    }
    savePlaylists();
    saveState();
    status = `Deleted “${track.name}”.`;
    render();
  }

  async function clearLibrary() {
    if (!tracks.length || !confirm('Delete every imported track and playlist from this browser?')) return;
    await clearTrackDb();
    tracks = [];
    playlists = [];
    queue = [];
    currentId = null;
    activePlaylistId = null;
    stopPlayback();
    savePlaylists();
    saveState();
    status = 'Music library cleared.';
    render();
  }

  function createPlaylist(name) {
    const clean = name.trim();
    if (!clean) return;
    const playlist = { id: makeId(), name: clean, trackIds: [], createdAt: Date.now() };
    playlists.push(playlist);
    savePlaylists();
    activePlaylistId = playlist.id;
    saveState();
    status = `Created “${clean}”.`;
    render();
  }

  function toggleTrackPlaylist(trackId, playlistId) {
    playlists = playlists.map((playlist) => {
      if (playlist.id !== playlistId) return playlist;
      const included = playlist.trackIds.includes(trackId);
      return { ...playlist, trackIds: included ? playlist.trackIds.filter((id) => id !== trackId) : [...playlist.trackIds, trackId] };
    });
    savePlaylists();
    render();
  }

  function removeFromPlaylist(trackId, playlistId) {
    playlists = playlists.map((playlist) => playlist.id === playlistId ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) } : playlist);
    savePlaylists();
    render();
  }

  function playPlaylist(id, shouldShuffle = false) {
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist?.trackIds.length) return;
    queue = [...playlist.trackIds];
    if (shouldShuffle) queue.sort(() => Math.random() - 0.5);
    currentId = queue[0];
    shuffle = shouldShuffle;
    saveState();
    void loadCurrentTrack(true);
  }

  function renamePlaylist(id) {
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist) return;
    const name = prompt('Rename playlist', playlist.name)?.trim();
    if (!name) return;
    playlist.name = name;
    savePlaylists();
    render();
  }

  function deletePlaylist(id) {
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist || !confirm(`Delete playlist “${playlist.name}”?`)) return;
    playlists = playlists.filter((item) => item.id !== id);
    if (activePlaylistId === id) activePlaylistId = null;
    savePlaylists();
    saveState();
    render();
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.panel === 'music') {
      popover.hidden = !popover.hidden;
      if (!popover.hidden) window.setTimeout(() => popover.querySelector('[data-input="library-search"]')?.focus(), 0);
      return;
    }

    const action = button.dataset.action;
    if (action === 'add-files') fileInput.click();
    else if (action === 'add-folder') folderInput.click();
    else if (action === 'set-view') {
      view = button.dataset.view;
      if (view !== 'playlists') activePlaylistId = null;
      saveState();
      render();
    } else if (action === 'clear-search') {
      searchValue = '';
      render();
    } else if (action === 'play-track') playTrack(button.dataset.id);
    else if (action === 'queue-track') queueTrack(button.dataset.id);
    else if (action === 'delete-track') void deleteTrack(button.dataset.id);
    else if (action === 'open-playlist-picker') {
      playlistPickerTrackId = playlistPickerTrackId === button.dataset.id ? null : button.dataset.id;
      render();
    } else if (action === 'close-playlist-picker') {
      playlistPickerTrackId = null;
      render();
    } else if (action === 'toggle-track-playlist') toggleTrackPlaylist(button.dataset.trackId, button.dataset.playlistId);
    else if (action === 'play-queue-index') playQueueIndex(Number(button.dataset.index));
    else if (action === 'move-queue') moveQueue(Number(button.dataset.index), Number(button.dataset.direction));
    else if (action === 'remove-queue') removeFromQueue(Number(button.dataset.index));
    else if (action === 'clear-queue') clearQueue();
    else if (action === 'toggle-play') void togglePlay();
    else if (action === 'next') nextTrack(false);
    else if (action === 'previous') previousTrack();
    else if (action === 'toggle-shuffle') {
      shuffle = !shuffle;
      saveState();
      render();
    } else if (action === 'cycle-repeat') {
      repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
      saveState();
      render();
    } else if (action === 'clear-library') void clearLibrary();
    else if (action === 'open-playlist') {
      activePlaylistId = button.dataset.id;
      saveState();
      render();
    } else if (action === 'close-playlist') {
      activePlaylistId = null;
      saveState();
      render();
    } else if (action === 'play-playlist') playPlaylist(button.dataset.id, false);
    else if (action === 'shuffle-playlist') playPlaylist(button.dataset.id, true);
    else if (action === 'rename-playlist') renamePlaylist(button.dataset.id);
    else if (action === 'delete-playlist') deletePlaylist(button.dataset.id);
    else if (action === 'remove-from-playlist') removeFromPlaylist(button.dataset.trackId, button.dataset.playlistId);
  }

  function handleInput(event) {
    if (event.target.dataset.input === 'library-search') {
      searchValue = event.target.value;
      const selectionStart = event.target.selectionStart;
      render();
      const replacement = popover.querySelector('[data-input="library-search"]');
      replacement?.focus();
      replacement?.setSelectionRange(selectionStart, selectionStart);
    } else if (event.target.dataset.input === 'seek') {
      audio.currentTime = Number(event.target.value) || 0;
      syncPlaybackUi();
    } else if (event.target.dataset.input === 'volume') {
      audio.volume = (Number(event.target.value) || 0) / 100;
      saveVolume(audio.volume);
      event.target.parentElement.querySelector('small').textContent = `${Math.round(audio.volume * 100)}%`;
    }
  }

  function handleChange(event) {
    if (event.target.dataset.input === 'seek') syncPlaybackUi();
  }

  function handleSubmit(event) {
    const form = event.target.closest('form');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'create-playlist') {
      createPlaylist(new FormData(form).get('playlistName')?.toString() || '');
    }
  }

  function handleDrag(event) {
    event.preventDefault();
    popover.classList.add('is-dragging');
  }

  function handleDragLeave(event) {
    if (!popover.contains(event.relatedTarget)) popover.classList.remove('is-dragging');
  }

  function handleDrop(event) {
    event.preventDefault();
    popover.classList.remove('is-dragging');
    void importFiles(event.dataTransfer?.files);
  }

  audio.addEventListener('loadedmetadata', async () => {
    const track = currentTrack();
    if (track && Number.isFinite(audio.duration) && audio.duration > 0 && Math.abs((track.duration || 0) - audio.duration) > 1) {
      track.duration = audio.duration;
      try { await putTrack(track); } catch { /* Playback still works without persisting duration. */ }
    }
    render();
  });
  audio.addEventListener('timeupdate', syncPlaybackUi);
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => nextTrack(true));
  audio.addEventListener('error', () => {
    status = 'This audio file could not be played by the browser.';
    render();
  });

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => void togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => void togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', previousTrack);
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') audio.currentTime = details.seekTime;
      });
    } catch {
      // Media Session actions are optional.
    }
  }

  new MutationObserver(() => {
    if (!shell) createInterface();
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else void initialize();

  window.addEventListener('beforeunload', () => {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  });
})();