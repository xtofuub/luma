(() => {
  'use strict';

  const PREFS_KEY = 'luma-panel-preferences-v2';
  const DEFAULT_PREFS = { library: true, details: true, stats: true };
  let prefs = loadPrefs();
  let shell;
  let popover;

  function loadPrefs() {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; }
    catch { return { ...DEFAULT_PREFS }; }
  }

  function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function icon(name, size = 16) {
    const paths = {
      settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function applyPrefs() {
    document.documentElement.classList.toggle('luma-hide-library', !prefs.library);
    document.documentElement.classList.toggle('luma-hide-details', !prefs.details);
    document.documentElement.classList.toggle('luma-hide-stats', !prefs.stats);
    savePrefs();
    render();
  }

  function createInterface() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-view-shell')) return;
    shell = document.createElement('div');
    shell.className = 'menu luma-view-shell';
    shell.innerHTML = `<button class="icon-control luma-view-trigger" aria-label="Configure visible panels" title="Configure panels">${icon('settings', 17)}</button><div class="menu-popover view-popover" hidden></div>`;
    actions.insertBefore(shell, actions.querySelector('.text-control') || actions.lastElementChild);
    popover = shell.querySelector('.view-popover');
    shell.addEventListener('click', (event) => {
      const trigger = event.target.closest('.luma-view-trigger');
      if (trigger) {
        popover.hidden = !popover.hidden;
        return;
      }
      const button = event.target.closest('[data-pref]');
      if (!button) return;
      const key = button.dataset.pref;
      if (key === 'all') prefs = { ...DEFAULT_PREFS };
      else prefs[key] = !prefs[key];
      applyPrefs();
    });
    document.addEventListener('mousedown', (event) => {
      if (shell && !shell.contains(event.target)) popover.hidden = true;
    });
    render();
  }

  function render() {
    if (!popover) return;
    const rows = [['library', 'Left library'], ['details', 'Document details'], ['stats', 'Writing statistics']];
    popover.innerHTML = `<p>Visible panels</p>${rows.map(([key, label]) => `<button class="view-toggle" data-pref="${key}"><span class="toggle-mark ${prefs[key] ? 'enabled' : ''}">${prefs[key] ? icon('check', 12) : ''}</span>${label}</button>`).join('')}<div class="menu-divider"></div><button data-pref="all">${icon('eye', 16)} Show everything</button>`;
  }

  new MutationObserver(createInterface).observe(document.documentElement, { childList: true, subtree: true });
  createInterface();
  applyPrefs();
})();