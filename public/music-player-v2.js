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
  let status = '';

  function icon(name, size = 17) {
    const paths = {
      music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      youtube: '<path d="M22.5 6.4a2.8 2.8 0 0 0-2-2C17.8 3.7 12 3.7 12 3.7s-5.8 0-8.5.7a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 2 2c2.7.7 8.5.7 8.5.7s5.8 0 8.5-.7a2.8 2.8 0 0 0 2-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.6Z"/><path d="m10 15 5-3-5-3v6Z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      play: '<path d="m6 3 14 9-14 9V3Z"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
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

      if (host === 'youtu.be') {
        return url.pathname.split('/').filter(Boolean)[0] || '';
      }

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
          <small>YouTube first, with local files as an optional fallback</small>
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

      <p class="luma-note">No API key is required. YouTube uses the official embedded player; local files stay on your device.</p>
    `;
  }

  function youtubePanel() {
    return `
      <div class="luma-youtube-panel">
        <form class="luma-youtube-link" data-form="youtube-link">
          <label>
            ${icon('link', 14)}
            <input data-input="youtube-url" value="${escapeHtml(youtubeValue)}" placeholder="Paste a YouTube link or video ID" autocomplete="off">
          </label>
          <button type="submit">Add</button>
        </form>
        <p class="luma-youtube-status ${status.startsWith('Error:') ? 'error' : ''}">
          ${escapeHtml(status || 'YouTube, YouTube Music, Shorts, and youtu.be links work without an API key.')}
        </p>
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
            <div><strong>${escapeHtml(track.name)}</strong><small>YouTube</small></div>
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
        <strong>${source === 'youtube' ? 'Paste a YouTube link' : 'Add local music'}</strong>
        <small>${source === 'youtube' ? 'Playback uses YouTube official embedded player.' : 'Files stay on this device.'}</small>
      </button>
    `;
  }

  function queueMarkup() {
    return `
      <div class="luma-queue">
        <div class="luma-queue-label"><span>Queue</span><small>${queue.length} ${queue.length === 1 ? 'track' : 'tracks'}</small></div>
        ${queue.map((track) => `
          <div class="luma-queue-item ${track.id === currentId ? 'active' : ''}">
            <button class="luma-queue-track" data-action="select-track" data-id="${track.id}">
              <span>${icon(track.source === 'youtube' ? 'youtube' : 'play', 12)}</span>
              <span class="luma-queue-copy"><strong>${escapeHtml(track.name)}</strong><small>${track.source === 'youtube' ? 'YouTube' : 'Local'}</small></span>
            </button>
            <div class="luma-queue-actions">
              <button data-action="remove-track" data-id="${track.id}" title="Remove">${icon('x', 12)}</button>
            </div>
          </div>
        `).join('')}
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
    }
  }

  function handleInput(event) {
    if (event.target.dataset.input === 'youtube-url') {
      youtubeValue = event.target.value;
    }

    if (event.target.matches('.luma-native-audio')) {
      event.target.volume = getVolume();
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest('form');
    if (!form || form.dataset.form !== 'youtube-link') return;

    event.preventDefault();
    const videoId = parseYouTubeId(youtubeValue);

    if (!videoId) {
      status = 'Error: Paste a valid YouTube, YouTube Music, Shorts, or youtu.be link.';
      render();
      focusYouTubeInput();
      return;
    }

    const track = {
      id: makeId(),
      source: 'youtube',
      videoId,
      name: `YouTube video (${videoId})`,
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
      currentId = track.id;
    }

    fileInput.value = '';
    render();

    const audio = popover.querySelector('.luma-native-audio');
    if (audio) audio.volume = getVolume();
  }

  function removeTrack(id) {
    const track = queue.find((item) => item.id === id);
    if (track?.source === 'local') URL.revokeObjectURL(track.url);

    queue = queue.filter((item) => item.id !== id);
    if (currentId === id) currentId = queue.at(-1)?.id || null;
    render();
  }

  function focusYouTubeInput() {
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
