(() => {
  'use strict';

  function removeLegacyBackdrop() {
    document.querySelectorAll('.luma-music-backdrop').forEach((backdrop) => backdrop.remove());
  }

  new MutationObserver(removeLegacyBackdrop).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyBackdrop, { once: true });
  } else {
    removeLegacyBackdrop();
  }
})();
