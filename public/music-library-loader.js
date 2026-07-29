(() => {
  'use strict';

  const ORIGINAL_SOURCE = '/music-library.js';
  const AUTO_QUEUE_PATTERN = /^\s*if \(!queue\.some\(\(item\) => sameTrack\(item, track\)\)\) queue\.push\(track\);\s*$/m;
  const SEARCH_LIMIT_PATTERN = /const params = new URLSearchParams\(\{ limit: '12', region \}\);/;

  function labelAction(button, label, tooltip) {
    button.classList.add('luma-track-action');
    button.title = tooltip;
    button.setAttribute('aria-label', tooltip);
    button.dataset.tooltip = tooltip;

    let text = button.querySelector('.luma-track-action-label');
    if (!text) {
      text = document.createElement('span');
      text.className = 'luma-track-action-label';
      button.appendChild(text);
    }
    text.textContent = label;
  }

  function enhanceMusicActions() {
    const drawer = document.querySelector('.luma-music-drawer');
    if (!drawer) return;

    drawer.querySelectorAll('[data-action="play-track"]').forEach((button) => {
      button.title = 'Play now — does not add to queue';
      button.setAttribute('aria-label', 'Play now');
    });

    drawer.querySelectorAll('[data-action="queue-track"]').forEach((button) => {
      const queued = button.classList.contains('active');
      labelAction(button, queued ? 'Queued' : 'Queue', queued ? 'Already in queue' : 'Add to queue');
    });

    drawer.querySelectorAll('[data-action="playlist-picker"]').forEach((button) => {
      labelAction(button, 'Playlist', 'Add to playlist');
    });

    drawer.querySelectorAll('[data-action="remove-playlist-track"]').forEach((button) => {
      button.title = 'Remove from playlist';
      button.setAttribute('aria-label', 'Remove from playlist');
    });

    const queueTab = drawer.querySelector('[data-action="set-view"][data-view="queue"]');
    if (queueTab) queueTab.title = 'View songs waiting to play';

    const playlistTab = drawer.querySelector('[data-action="set-view"][data-view="playlists"]');
    if (playlistTab) playlistTab.title = 'View and manage playlists';
  }

  function watchMusicUi() {
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        enhanceMusicActions();
      });
    };

    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    schedule();
  }

  async function start() {
    try {
      const response = await fetch(ORIGINAL_SOURCE, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Music source returned ${response.status}`);

      const original = await response.text();
      if (!AUTO_QUEUE_PATTERN.test(original)) {
        throw new Error('The automatic queue line could not be found.');
      }
      if (!SEARCH_LIMIT_PATTERN.test(original)) {
        throw new Error('The YouTube search result limit could not be found.');
      }

      const patched = original
        .replace(AUTO_QUEUE_PATTERN, '')
        .replace(SEARCH_LIMIT_PATTERN, "const params = new URLSearchParams({ limit: '30', region });")
        .replace('No embeddable music videos matched that search.', 'No playable YouTube videos matched that search.');

      Function(`${patched}\n//# sourceURL=luma-music-library-patched.js`)();
      watchMusicUi();
    } catch (error) {
      console.error('[Luma music] Could not apply playback behavior patch.', error);
      const fallback = document.createElement('script');
      fallback.src = ORIGINAL_SOURCE;
      fallback.defer = true;
      fallback.addEventListener('load', watchMusicUi, { once: true });
      document.head.appendChild(fallback);
    }
  }

  void start();
})();
