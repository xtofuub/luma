(() => {
  'use strict';

  const MUSIC_STATE_KEY = 'luma-youtube-music-state-v4';
  let focusPlayer = null;
  let focusObserver = null;
  let scheduled = false;
  let enhancing = false;

  function readCurrentTrack() {
    try {
      return JSON.parse(localStorage.getItem(MUSIC_STATE_KEY) || '{}')?.current || null;
    } catch {
      return null;
    }
  }

  function parseTime(value) {
    const parts = String(value || '').trim().split(':').map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
  }

  function syncFocusModeClass() {
    document.body.classList.toggle('luma-focus-active', Boolean(document.querySelector('.app.focus-mode')));
  }

  function updateProgress() {
    if (!focusPlayer) return;
    const value = focusPlayer.querySelector('[data-focus-time]')?.textContent || '';
    const [elapsedText, durationText] = value.split('/').map((part) => part.trim());
    const elapsed = parseTime(elapsedText);
    const duration = parseTime(durationText);
    const percentage = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;
    focusPlayer.style.setProperty('--luma-focus-progress', `${percentage}%`);
  }

  function updateTrackDetails() {
    if (!focusPlayer) return;
    const track = readCurrentTrack();
    const artwork = focusPlayer.querySelector('.luma-focus-artwork img');
    const channel = focusPlayer.querySelector('[data-focus-channel]');
    if (channel) channel.textContent = track?.channel || 'YouTube';
    if (artwork) {
      if (track?.thumbnail) {
        artwork.src = track.thumbnail;
        artwork.closest('.luma-focus-artwork')?.classList.add('has-image');
      } else {
        artwork.removeAttribute('src');
        artwork.closest('.luma-focus-artwork')?.classList.remove('has-image');
      }
    }
  }

  function enhancePlayer() {
    scheduled = false;
    syncFocusModeClass();
    if (!focusPlayer || focusPlayer.hidden || enhancing) return;

    if (!focusPlayer.classList.contains('luma-focus-polished')) {
      const previous = focusPlayer.querySelector('[data-action="previous"]');
      const play = focusPlayer.querySelector('[data-action="toggle-play"]');
      const next = focusPlayer.querySelector('[data-action="next"]');
      const title = focusPlayer.querySelector('strong')?.textContent || 'Nothing playing';
      const time = focusPlayer.querySelector('[data-focus-time]')?.textContent || '0:00 / 0:00';
      if (!previous || !play || !next) return;

      enhancing = true;
      const artwork = document.createElement('div');
      artwork.className = 'luma-focus-artwork';
      artwork.setAttribute('aria-hidden', 'true');
      artwork.innerHTML = '<img alt=""><span>♪</span>';

      const copy = document.createElement('div');
      copy.className = 'luma-focus-copy';
      copy.innerHTML = `<strong>${escapeHtml(title)}</strong><div><span data-focus-channel>YouTube</span><i></i><small data-focus-time>${escapeHtml(time)}</small></div>`;

      const controls = document.createElement('div');
      controls.className = 'luma-focus-controls';
      previous.setAttribute('aria-label', 'Previous track');
      previous.title = 'Previous';
      play.setAttribute('aria-label', 'Play or pause');
      play.title = 'Play or pause';
      next.setAttribute('aria-label', 'Next track');
      next.title = 'Next';
      controls.append(previous, play, next);

      const progress = document.createElement('div');
      progress.className = 'luma-focus-progress';
      progress.setAttribute('aria-hidden', 'true');
      progress.innerHTML = '<i></i>';

      focusPlayer.replaceChildren(artwork, copy, controls, progress);
      focusPlayer.classList.add('luma-focus-polished');
      enhancing = false;
    }

    updateTrackDetails();
    updateProgress();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhancePlayer);
  }

  function connect() {
    const next = document.querySelector('.luma-youtube-focus-player');
    if (!next) {
      syncFocusModeClass();
      return false;
    }
    if (focusPlayer !== next) {
      focusObserver?.disconnect();
      focusPlayer = next;
      focusObserver = new MutationObserver(scheduleEnhance);
      focusObserver.observe(focusPlayer, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['hidden'],
      });
    }
    scheduleEnhance();
    return true;
  }

  new MutationObserver(() => {
    syncFocusModeClass();
    if (!focusPlayer?.isConnected) connect();
    else scheduleEnhance();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  window.addEventListener('storage', (event) => {
    if (event.key === MUSIC_STATE_KEY) scheduleEnhance();
  });

  window.setInterval(() => {
    syncFocusModeClass();
    updateTrackDetails();
    updateProgress();
  }, 500);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect, { once: true });
  else connect();
})();
