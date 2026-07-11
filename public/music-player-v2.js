(() => {
  'use strict';

  const SETTINGS_KEY = 'luma-ambience-settings-v2';
  const LEGACY_API_KEY = 'luma-youtube-api-key-v1';

  localStorage.removeItem(LEGACY_API_KEY);

  let shell;
  let popover;
  let fileInput;
  let source = 'youtube';
  let queue = [];
  let currentId = null;
  let youtubeValue = '';
  let youtubeSearchValue = '';
  let searchResults = [];
  let searchLoading = false;
  let searchError = '';
  let status = '';

  function icon(name, size = 17) {
    const paths = {
      music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      youtube: '<path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C17.8 3.7 12 3.7 12 3.7s-5.8 0-8.5.7a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 2 2c2.7.7 8.5.7 8.5.7s5.8 0 8.5-.7a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.6Z"/><path d="m10 15 5-3-5-3v6Z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      play: '<path d="m6 3 14 9-14 9V3Z"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function makeId() {
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getVolume() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      const value = Number(settings.musicVolume);
      return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : 0.55;
    } catch {
      return 0.55;
    }
  }

  function parseYouTubeId(value) {
    const text = value.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;

    try {
      const url = new URL(text.startsWith('http') ? text : `https://${text}`);
      const host = url.hostname.replace(/^www\./, '');

      if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';

      if (host.endsWith('youtube.com')) {
        const watchId = url.searchParams.get('v');
        if (watchId) return watchId;

        const parts = url.pathname.split('/').filter(Boolean);
        const marker = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
        if (marker >= 0) return parts[marker + 1] || '';
      }
    } catch {
      return '';
    }

    return '';
  }

  function currentTrack() {
    return queue.find((track) => track.id === currentId) || null;
  }

  function createInterface() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-music-shell')) return;

    shell = document.createElement('div');
    shell.className = 'luma-music-shell luma-tool';
    shell.innerHTML = `
      <button class="icon-control luma-trigger luma-music-trigger" data-panel="music" aria-label="Music player" title="Music player">
        ${icon('music')}
        <span class="luma-badge" hidden></span>
      </button>
      <div class="luma-popover luma-music-popover" hidden></div>
    `;

    actions.insertBefore(shell, actions.querySelector('.text-control') || actions.lastElementChild);
    popover = shell.querySelector('.luma-music-popover');

    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus';
    fileInput.multiple = true;
    fileInput.hidden = true;
    fileInput.addEventListener('change', addLocalFiles);
    document.body.appendChild(fileInput);

    shell.addEventListener('click', handleClick);
    shell.addEventListener('input', handleInput);
    shell.addEventListener('submit', handleSubmit);

    document.addEventListener('mousedown', (event) => {
      if (shell && !shell.contains(event.target)) popover.hidden = true;
    });

    render();
  }

  function render() {
    if (!shell || !popover) return;

    const track = currentTrack();
    const badge = shell.querySelector('.luma-badge');
    badge.hidden = queue.length === 0;
    badge.textContent = String(queue.length);

    popover.innerHTML = `
      <div class="luma-popover-heading">
        <div>
          <strong>Music</strong>
          <small>Search YouTube or add local files</small>
        </div>
        <button class="luma-add" data-action="${source === 'youtube' ? 'focus-youtube' : 'add-local'}">
          ${icon('plus', 14)} Add
        </button>
      </div>

      <div class="luma-source-tabs" role="tablist" aria-label="Music source">
        <button role="tab" data-action="source-youtube" class="${source === 'youtube' ? 'active' : ''}">
          ${icon('youtube', 15)} YouTube
        </button>
        <button role="tab" data-action="source-local" class="${source === 'local' ? 'active' : ''}">
          ${icon('music', 14)} Local
        </button>
      </div>

      ${source === 'youtube' ? youtubePanel() : localPanel()}
      ${track ? playerMarkup(track) : emptyMarkup()}
      ${queue.length ? queueMarkup() : ''}

      <p class="luma-note">Playback uses YouTube's official embedded player. Local files stay on this device.</p>
    `;
  }

  function youtubePanel() {
    return `
      <div class="luma-youtube-panel">
        <form class="luma-youtube-search" data-form="youtube-search">
          <label>
            ${icon('search', 14)}
            <input data-input="youtube-search" value="${escapeHtml(youtubeSearchValue)}" placeholder="Search songs or artists" autocomplete="off">
          </label>
          <button type="submit" ${searchLoading ? 'disabled' : ''}>${searchLoading ? 'Searching…' : 'Search'}</button>
        </form>

        ${searchError ? `<p class="luma-youtube-status error">${escapeHtml(searchError)}</p>` : ''}
        ${searchResultsMarkup()}

        <div class="luma-youtube-divider"><span>or paste a link</span></div>

        <form class="luma-youtube-link" data-form="youtube-link">
          <label>
            ${icon('link', 14)}
            <input data-input="youtube-url" value="${escapeHtml(youtubeValue)}" placeholder="YouTube link or video ID" autocomplete="off">
          </label>
          <button type="submit">Add</button>
        </form>
        <p class="luma-youtube-status ${status.startsWith('Error:') ? 'error' : ''}">
          ${escapeHtml(status || 'Paste-link playback works even when search is not configured.')}
        </p>
      </div>
    `;
  }

  function searchResultsMarkup() {
    if (searchLoading) return '<div class="luma-search-loading">Searching YouTube…</div>';
    if (!searchResults.length) return '';

    return `
      <div class="luma-youtube-results">
        <div class="luma-results-heading"><span>Results</span><small>${searchResults.length} videos</small></div>
        ${searchResults.map((result, index) => `
          <div class="luma-youtube-result">
            <div class="luma-result-copy">
              <strong title="${escapeHtml(result.title)}">${escapeHtml(result.title)}</strong>
              <small>${escapeHtml(result.channel)}</small>
            </div>
            <button data-action="queue-search-result" data-index="${index}">Queue</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function localPanel() {
    return `
      <button class="luma-source-card" data-action="add-local">
        ${icon('plus', 18)}
        <span>
          <strong>Add files from this device</strong>
          <small>MP3, WAV, FLAC, M4A, OGG and more</small>
        </span>
      </button>
    `;
  }

  function playerMarkup(track) {
    if (track.source === 'youtube') {
      return `
        <div class="luma-player youtube">
          <div class="luma-youtube-stage">
            <iframe
              src="https://www.youtube.com/embed/${encodeURIComponent(track.videoId)}?autoplay=1&playsinline=1&rel=0"
              title="${escapeHtml(track.name)}"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
          <div class="luma-track-summary">
            <img src="https://i.ytimg.com/vi/${encodeURIComponent(track.videoId)}/hqdefault.jpg" alt="">
            <div><strong>${escapeHtml(track.name)}</strong><small>${escapeHtml(track.channel || 'YouTube')}</small></div>
          </div>
        </div>
      `;
    }

    return `
      <div class="luma-player local">
        <div class="luma-track-summary">
          <i>${icon('music', 17)}</i>
          <div><strong>${escapeHtml(track.name)}</strong><small>Local file</small></div>
        </div>
        <audio class="luma-native-audio" src="${escapeHtml(track.url)}" controls autoplay></audio>
      </div>
    `;
  }

  function emptyMarkup() {
    return `
      <button class="luma-empty-music" data-action="${source === 'youtube' ? 'focus-youtube' : 'add-local'}">
        ${icon(source === 'youtube' ? 'youtube' : 'music', 23)}
        <strong>${source === 'youtube' ? 'Search YouTube' : 'Add local music'}</strong>
        <small>${source === 'youtube' ? 'Find a video above, then press Queue.' : 'Files stay on this device.'}</small>
      </button>
    `;
  }

  function queueMarkup() {
    return `
      <div class="luma-queue">
        <div class="luma-queue-label"><span>Queue</span><small>${queue.length} ${queue.length === 1 ? 'track' : 'tracks'}</small></div>
        <div class="luma-queue-list">
          ${queue.map((track) => `
            <div class="luma-queue-item ${track.id === currentId ? 'active' : ''}">
              <button class="luma-queue-track" data-action="select-track" data-id="${track.id}">
                <span class="luma-queue-icon">${icon(track.source === 'youtube' ? 'youtube' : 'play', 12)}</span>
                <span class="luma-queue-copy"><strong title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</strong><small>${track.source === 'youtube' ? escapeHtml(track.channel || 'YouTube') : 'Local'}</small></span>
              </button>
              <button class="luma-queue-remove" data-action="remove-track" data-id="${track.id}" title="Remove" aria-label="Remove ${escapeHtml(track.name)}">${icon('x', 12)}</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.panel === 'music') {
      popover.hidden = !popover.hidden;
      if (!popover.hidden && source === 'youtube') focusYouTubeInput();
      return;
    }

    const action = button.dataset.action;

    if (action === 'source-youtube') {
      source = 'youtube';
      render();
      focusYouTubeInput();
    } else if (action === 'source-local') {
      source = 'local';
      render();
    } else if (action === 'focus-youtube') {
      source = 'youtube';
      render();
      focusYouTubeInput();
    } else if (action === 'add-local') {
      fileInput.click();
    } else if (action === 'select-track') {
      currentId = button.dataset.id;
      render();
    } else if (action === 'remove-track') {
      removeTrack(button.dataset.id);
    } else if (action === 'queue-search-result') {
      queueSearchResult(Number(button.dataset.index));
    }
  }

  function handleInput(event) {
    if (event.target.dataset.input === 'youtube-url') youtubeValue = event.target.value;
    if (event.target.dataset.input === 'youtube-search') youtubeSearchValue = event.target.value;

    if (event.target.matches('.luma-native-audio')) {
      event.target.volume = getVolume();
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest('form');
    if (!form) return;

    event.preventDefault();

    if (form.dataset.form === 'youtube-search') {
      searchYouTube();
    } else if (form.dataset.form === 'youtube-link') {
      addYouTubeLink();
    }
  }

  async function searchYouTube() {
    const query = youtubeSearchValue.trim();
    if (query.length < 2) {
      searchError = 'Enter at least two characters.';
      searchResults = [];
      render();
      focusYouTubeInput();
      return;
    }

    searchLoading = true;
    searchError = '';
    render();

    try {
      const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(payload.error || 'YouTube search failed.');

      searchResults = Array.isArray(payload.items) ? payload.items : [];
      searchError = searchResults.length ? '' : 'No videos found. Try a different search.';
    } catch (error) {
      searchResults = [];
      searchError = error instanceof Error ? error.message : 'YouTube search failed.';
    } finally {
      searchLoading = false;
      render();
      focusYouTubeInput(false);
    }
  }

  function queueSearchResult(index) {
    const result = searchResults[index];
    if (!result?.videoId) return;

    const existing = queue.find((track) => track.source === 'youtube' && track.videoId === result.videoId);
    if (existing) {
      status = 'Already in queue.';
      render();
      return;
    }

    const track = {
      id: makeId(),
      source: 'youtube',
      videoId: result.videoId,
      name: result.title,
      channel: result.channel || 'YouTube',
    };

    queue.push(track);
    status = `Queued “${result.title}”.`;
    render();
  }

  function addYouTubeLink() {
    const videoId = parseYouTubeId(youtubeValue);

    if (!videoId) {
      status = 'Error: Paste a valid YouTube, YouTube Music, Shorts, or youtu.be link.';
      render();
      focusYouTubeLinkInput();
      return;
    }

    const existing = queue.find((track) => track.source === 'youtube' && track.videoId === videoId);
    if (existing) {
      status = 'Already in queue.';
      currentId = existing.id;
      render();
      return;
    }

    const track = {
      id: makeId(),
      source: 'youtube',
      videoId,
      name: `YouTube video (${videoId})`,
      channel: 'YouTube',
    };

    queue.push(track);
    currentId = track.id;
    youtubeValue = '';
    status = 'Added to queue.';
    render();
  }

  function addLocalFiles() {
    const files = Array.from(fileInput.files || []).filter((file) => {
      return file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(file.name);
    });

    for (const file of files) {
      const track = {
        id: makeId(),
        source: 'local',
        name: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled track',
        url: URL.createObjectURL(file),
      };
      queue.push(track);
      if (!currentId) currentId = track.id;
    }

    fileInput.value = '';
    render();

    const audio = popover.querySelector('.luma-native-audio');
    if (audio) audio.volume = getVolume();
  }

  function removeTrack(id) {
    const track = queue.find((item) => item.id === id);
    if (track?.source === 'local') URL.revokeObjectURL(track.url);

    const removedIndex = queue.findIndex((item) => item.id === id);
    queue = queue.filter((item) => item.id !== id);

    if (currentId === id) {
      currentId = queue[removedIndex]?.id || queue[removedIndex - 1]?.id || null;
    }
    render();
  }

  function focusYouTubeInput(select = true) {
    window.setTimeout(() => {
      const input = popover?.querySelector('[data-input="youtube-search"]');
      input?.focus();
      if (select) input?.select();
    }, 0);
  }

  function focusYouTubeLinkInput() {
    window.setTimeout(() => {
      popover?.querySelector('[data-input="youtube-url"]')?.focus();
    }, 0);
  }

  new MutationObserver(createInterface).observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createInterface, { once: true });
  } else {
    createInterface();
  }

  window.addEventListener('beforeunload', () => {
    for (const track of queue) {
      if (track.source === 'local') URL.revokeObjectURL(track.url);
    }
  });
})();