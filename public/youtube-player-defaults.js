(() => {
  'use strict';

  const LEGACY_KEY = 'luma-youtube-api-key-v1';
  let defaultSourceApplied = false;
  let scheduled = false;

  localStorage.removeItem(LEGACY_KEY);

  function cleanPlayer() {
    scheduled = false;

    const popover = document.querySelector('.luma-music-popover');
    if (!popover) return;

    const tabs = popover.querySelector('.luma-source-tabs');
    const youtubeTab = tabs?.querySelector('[data-action="source-youtube"]');
    const localTab = tabs?.querySelector('[data-action="source-local"]');

    if (tabs && youtubeTab && localTab && tabs.firstElementChild !== youtubeTab) {
      tabs.prepend(youtubeTab);
    }

    if (!defaultSourceApplied && youtubeTab && localTab?.classList.contains('active')) {
      defaultSourceApplied = true;
      youtubeTab.click();
      return;
    }

    defaultSourceApplied ||= Boolean(youtubeTab?.classList.contains('active'));

    popover.querySelector('.luma-youtube-search')?.remove();
    popover.querySelector('.luma-youtube-results')?.remove();
    popover.querySelector('.luma-youtube-setup')?.remove();

    const heading = popover.querySelector('.luma-popover-heading small');
    if (heading) heading.textContent = 'YouTube links with optional local playback';

    const linkForm = popover.querySelector('.luma-youtube-link');
    const input = linkForm?.querySelector('[data-input="youtube-url"]');
    if (input) input.placeholder = 'Paste a YouTube link or video ID';

    if (linkForm && !popover.querySelector('.luma-keyless-note')) {
      const note = document.createElement('p');
      note.className = 'luma-youtube-status luma-keyless-note';
      note.textContent = 'YouTube, YouTube Music, Shorts, and youtu.be links work without an API key.';
      linkForm.insertAdjacentElement('afterend', note);
    }

    const footerNote = popover.querySelector('.luma-note');
    if (footerNote) {
      footerNote.textContent = 'No API key is required. YouTube uses the official embedded player; local files stay on your device.';
    }
  }

  function scheduleClean() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(cleanPlayer);
  }

  const observer = new MutationObserver(scheduleClean);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleClean, { once: true });
  } else {
    scheduleClean();
  }
})();
