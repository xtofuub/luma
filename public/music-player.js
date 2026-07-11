(() => {
  'use strict';

  const STORAGE_KEY = 'luma-ambience-settings-v2';
  let settings = loadSettings();
  let shell;
  let popover;
  let fileInput;
  let focusPlayer;
  let tracks = [];
  let currentIndex = -1;
  let shuffle = false;
  let repeatMode = 'off';
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = settings.musicVolume / 100;

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...saved, musicVolume: Number.isFinite(Number(saved.musicVolume)) ? Math.min(100, Math.max(0, Number(saved.musicVolume))) : 55 };
    } catch {
      return { musicVolume: 55 };
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function escapeHtml(value) {
    return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function icon(name, size = 17) {
    const paths = {
      music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      volume:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/>',
      volumeOff:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 5"/><path d="m21 9-5 5"/>',
      play:'<path d="m6 3 14 9-14 9V3Z"/>', pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
      previous:'<path d="m19 20-9-8 9-8v16Z"/><path d="M5 19V5"/>', next:'<path d="m5 4 9 8-9 8V4Z"/><path d="M19 5v14"/>',
      shuffle:'<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.6c3.5 0 5.3-2 7.1-6 1.8-4 3.6-6 7.1-6H22"/><path d="M2 6h1.6c1.6 0 2.8.4 3.8 1.2"/><path d="M15 16.8c.8.8 1.8 1.2 2.8 1.2H22"/>',
      repeat:'<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
      plus:'<path d="M12 5v14M5 12h14"/>', up:'<path d="m18 15-6-6-6 6"/>', down:'<path d="m6 9 6 6 6-6"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${paths[name]}</svg>`;
  }

  function createInterface() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-music-shell')) return;
    shell = document.createElement('div');
    shell.className = 'luma-music-shell luma-tool';
    shell.innerHTML = `<button class="icon-control luma-trigger luma-music-trigger" data-panel="music" aria-label="Music queue" title="Music queue">${icon('music')}<span class="luma-badge" hidden></span></button><div class="luma-popover luma-music-popover" hidden></div>`;
    actions.insertBefore(shell, actions.querySelector('.text-control') || actions.lastElementChild);
    popover = shell.querySelector('.luma-music-popover');
    shell.addEventListener('click', handleClick);
    shell.addEventListener('input', handleInput);

    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.opus';
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => { if (fileInput.files) addTracks(fileInput.files); fileInput.value = ''; });
    document.body.appendChild(fileInput);

    focusPlayer = document.createElement('div');
    focusPlayer.className = 'luma-focus-player';
    focusPlayer.hidden = true;
    focusPlayer.addEventListener('click', handleClick);
    document.body.appendChild(focusPlayer);
    render();
  }

  function currentTrack() {
    return currentIndex >= 0 ? tracks[currentIndex] || null : null;
  }

  function render() {
    if (!shell || !popover) return;
    const track = currentTrack();
    const badge = shell.querySelector('.luma-badge');
    badge.hidden = !tracks.length;
    badge.textContent = tracks.length;
    shell.querySelector('[data-panel="music"]').classList.toggle('is-active', Boolean(track && !audio.paused));
    popover.innerHTML = `
      <div class="luma-popover-heading"><div><strong>Music queue</strong><small>Played locally from your device</small></div><button class="luma-add" data-action="add">${icon('plus',14)} Add</button></div>
      ${track ? playerMarkup(track) : `<button class="luma-empty-music" data-action="add">${icon('music',23)}<strong>Add music to your queue</strong><small>MP3, WAV, FLAC, M4A, OGG and more</small></button>`}
      ${tracks.length ? queueMarkup() : ''}<p class="luma-note">Music never leaves your device. The queue resets after a refresh.</p>`;
    renderFocus();
  }

  function playerMarkup(track) {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    return `<div class="luma-player"><div class="luma-track-summary"><i>${icon('music',17)}</i><div><strong>${escapeHtml(track.name)}</strong><small>${audio.paused ? 'Paused' : 'Playing'}</small></div></div>
      <label class="luma-seek"><input type="range" min="0" max="${duration}" step="0.1" value="${Math.min(time,duration)}" data-input="seek"><span>${formatTime(time)}</span><span>${formatTime(duration)}</span></label>
      <div class="luma-transport"><button data-action="shuffle" class="${shuffle ? 'active' : ''}">${icon('shuffle',15)}</button><button data-action="previous">${icon('previous',17)}</button><button class="luma-play" data-action="play">${audio.paused ? icon('play',17) : icon('pause',17)}</button><button data-action="next">${icon('next',17)}</button><button data-action="repeat" class="${repeatMode !== 'off' ? 'active' : ''}">${icon('repeat',15)}${repeatMode === 'one' ? '<small>1</small>' : ''}</button></div>
      <label class="luma-range luma-music-volume"><span>${settings.musicVolume ? icon('volume',14) : icon('volumeOff',14)}</span><input type="range" min="0" max="100" value="${settings.musicVolume}" data-input="volume"><small>${Math.round(settings.musicVolume)}%</small></label></div>`;
  }

  function queueMarkup() {
    return `<div class="luma-queue"><div class="luma-queue-label"><span>Queue</span><small>${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}</small></div>${tracks.map((track,index) => `<div class="luma-queue-item ${index === currentIndex ? 'active' : ''}"><button class="luma-queue-track" data-action="track" data-index="${index}"><span>${index === currentIndex && !audio.paused ? icon('pause',12) : icon('play',12)}</span><strong>${escapeHtml(track.name)}</strong></button><div class="luma-queue-actions"><button data-action="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>${icon('up',12)}</button><button data-action="down" data-index="${index}" ${index === tracks.length - 1 ? 'disabled' : ''}>${icon('down',12)}</button><button data-action="remove" data-index="${index}">${icon('x',12)}</button></div></div>`).join('')}</div>`;
  }

  function renderFocus() {
    if (!focusPlayer) return;
    const track = currentTrack();
    const app = document.querySelector('.app');
    focusPlayer.hidden = !(track && app?.classList.contains('focus-mode'));
    if (!track) return;
    focusPlayer.innerHTML = `<button data-action="previous">${icon('previous',14)}</button><button class="luma-focus-play" data-action="play">${audio.paused ? icon('play',14) : icon('pause',14)}</button><div><strong>${escapeHtml(track.name)}</strong><small>${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}</small></div><button data-action="next">${icon('next',14)}</button>`;
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.panel) { popover.hidden = !popover.hidden; return; }
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    if (action === 'add') fileInput.click();
    else if (action === 'play') togglePlay();
    else if (action === 'previous') previous();
    else if (action === 'next') next(false);
    else if (action === 'shuffle') { shuffle = !shuffle; render(); }
    else if (action === 'repeat') { repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'; render(); }
    else if (action === 'track') playTrack(index);
    else if (action === 'up') move(index,-1);
    else if (action === 'down') move(index,1);
    else if (action === 'remove') remove(index);
  }

  function handleInput(event) {
    if (event.target.dataset.input === 'volume') {
      settings.musicVolume = Number(event.target.value);
      audio.volume = settings.musicVolume / 100;
      save();
      event.target.parentElement.querySelector('small').textContent = `${Math.round(settings.musicVolume)}%`;
    } else if (event.target.dataset.input === 'seek') {
      audio.currentTime = Number(event.target.value);
      updateTime();
    }
  }

  function addTracks(fileList) {
    const files = Array.from(fileList).filter(file => file.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(file.name));
    tracks.push(...files.map(file => ({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name: file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim() || 'Untitled track', url: URL.createObjectURL(file) })));
    if (currentIndex < 0 && tracks.length) { currentIndex = 0; load(false); }
    render();
  }

  function load(play) {
    const track = currentTrack();
    if (!track) return;
    audio.src = track.url;
    audio.load();
    if (play) void audio.play().catch(render);
    render();
  }

  function togglePlay() {
    if (!currentTrack()) { fileInput.click(); return; }
    if (audio.paused) void audio.play(); else audio.pause();
  }

  function playTrack(index) {
    if (!tracks[index]) return;
    if (index === currentIndex && !audio.paused) { audio.pause(); return; }
    currentIndex = index; load(true);
  }

  function previous() {
    if (!tracks.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    currentIndex = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1; load(true);
  }

  function next(ended) {
    if (!tracks.length) return;
    if (ended && repeatMode === 'one') { audio.currentTime = 0; void audio.play(); return; }
    if (shuffle && tracks.length > 1) { let nextIndex = currentIndex; while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * tracks.length); currentIndex = nextIndex; load(true); return; }
    if (currentIndex < tracks.length - 1) { currentIndex += 1; load(true); }
    else if (repeatMode === 'all' || !ended) { currentIndex = 0; load(true); }
    else { audio.pause(); audio.currentTime = 0; render(); }
  }

  function move(index,direction) {
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    const id = currentTrack()?.id;
    [tracks[index],tracks[target]] = [tracks[target],tracks[index]];
    currentIndex = id ? tracks.findIndex(track => track.id === id) : -1;
    render();
  }

  function remove(index) {
    const track = tracks[index];
    if (!track) return;
    const wasPlaying = !audio.paused;
    const active = index === currentIndex;
    URL.revokeObjectURL(track.url);
    tracks.splice(index,1);
    if (!tracks.length) { currentIndex = -1; audio.pause(); audio.removeAttribute('src'); audio.load(); }
    else if (index < currentIndex) currentIndex -= 1;
    else if (active) { currentIndex = Math.min(index,tracks.length - 1); load(wasPlaying); return; }
    render();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return `${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
  }

  function updateTime() {
    const seek = popover?.querySelector('[data-input="seek"]');
    if (seek) {
      seek.max = Number.isFinite(audio.duration) ? audio.duration : 0;
      seek.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const labels = seek.parentElement.querySelectorAll('span');
      labels[0].textContent = formatTime(audio.currentTime); labels[1].textContent = formatTime(audio.duration);
    }
    renderFocus();
  }

  audio.addEventListener('loadedmetadata', render);
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => next(true));
  document.addEventListener('pointerdown', event => { if (shell && !shell.contains(event.target)) popover.hidden = true; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && popover) popover.hidden = true; });
  window.addEventListener('beforeunload', () => tracks.forEach(track => URL.revokeObjectURL(track.url)));
  new MutationObserver(() => { createInterface(); renderFocus(); }).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  createInterface();
})();
