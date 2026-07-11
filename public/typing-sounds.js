(() => {
  const STORAGE_KEY = 'luma-typing-sound-settings-v1';
  const DEFAULTS = { enabled: false, preset: 'soft', volume: 42 };
  const VALID_PRESETS = new Set(['soft', 'mechanical', 'typewriter']);

  let settings = loadSettings();
  let audioContext = null;
  let noiseBuffer = null;
  let shell = null;
  let popover = null;
  let trigger = null;

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        enabled: saved.enabled === true,
        preset: VALID_PRESETS.has(saved.preset) ? saved.preset : DEFAULTS.preset,
        volume: Number.isFinite(saved.volume)
          ? Math.min(100, Math.max(0, Math.round(saved.volume)))
          : DEFAULTS.volume,
      };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function getAudioContext() {
    if (audioContext) {
      if (audioContext.state === 'suspended') void audioContext.resume();
      return audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    audioContext = new AudioContextClass();
    noiseBuffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate), audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return audioContext;
  }

  function playKeySound(key, preset = settings.preset, force = false) {
    if (!force && !settings.enabled) return;
    if ([
      'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
      'PageUp', 'PageDown', 'Insert', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
      'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    ].includes(key)) return;

    const context = getAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const level = Math.max(0.001, settings.volume / 100);
    const isEnter = key === 'Enter';
    const isSpace = key === ' ';
    const isDelete = key === 'Backspace' || key === 'Delete';
    const variation = Math.random() * 0.14 + 0.93;

    function tone(frequency, type, gainAmount, duration, endFrequency) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency * variation, now);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency * variation, now + duration);
      gain.gain.setValueAtTime(Math.max(0.0001, gainAmount * level), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.01);
    }

    function noise(gainAmount, duration, filterType, frequency, q = 0.8) {
      if (!noiseBuffer) return;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = noiseBuffer;
      filter.type = filterType;
      filter.frequency.setValueAtTime(frequency * variation, now);
      filter.Q.setValueAtTime(q, now);
      gain.gain.setValueAtTime(Math.max(0.0001, gainAmount * level), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(now, Math.random() * 0.8, duration);
      source.stop(now + duration + 0.01);
    }

    if (preset === 'soft') {
      tone(isDelete ? 190 : isSpace ? 245 : 330, 'triangle', 0.022, 0.045, 150);
      noise(0.012, 0.035, 'lowpass', isSpace ? 1250 : 1800);
      return;
    }

    if (preset === 'mechanical') {
      tone(isDelete ? 105 : isSpace ? 155 : 210, 'square', 0.018, 0.028, 78);
      tone(isEnter ? 520 : 760, 'triangle', 0.009, 0.022, 260);
      noise(0.026, isSpace ? 0.048 : 0.032, 'bandpass', isSpace ? 950 : 2400, 1.2);
      return;
    }

    tone(isDelete ? 120 : isSpace ? 145 : 175, 'triangle', 0.028, 0.045, 68);
    noise(0.035, isSpace ? 0.065 : 0.044, 'bandpass', isSpace ? 780 : 1550, 0.9);
    if (isEnter) {
      const bellNow = now + 0.012;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1360, bellNow);
      oscillator.frequency.exponentialRampToValueAtTime(920, bellNow + 0.22);
      gain.gain.setValueAtTime(0.018 * level, bellNow);
      gain.gain.exponentialRampToValueAtTime(0.0001, bellNow + 0.24);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(bellNow);
      oscillator.stop(bellNow + 0.25);
    }
  }

  const speakerOn = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/></svg>';
  const speakerOff = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 5"/><path d="m21 9-5 5"/></svg>';
  const keyboardIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M19 10h.01M7 14h.01M11 14h6"/></svg>';

  function renderState() {
    if (!shell) return;
    trigger.innerHTML = settings.enabled ? speakerOn : speakerOff;
    trigger.classList.toggle('is-on', settings.enabled);
    trigger.title = settings.enabled ? 'Typing sounds on' : 'Typing sounds off';
    trigger.setAttribute('aria-label', trigger.title);

    const toggle = shell.querySelector('[data-sound-toggle]');
    toggle.classList.toggle('is-on', settings.enabled);
    toggle.setAttribute('aria-checked', String(settings.enabled));

    shell.querySelectorAll('[data-preset]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.preset === settings.preset);
    });

    const range = shell.querySelector('[data-sound-volume]');
    range.value = String(settings.volume);
    shell.querySelector('[data-volume-label]').textContent = `${settings.volume}%`;
  }

  function createInterface() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions || document.querySelector('.typing-sound-shell')) return;

    shell = document.createElement('div');
    shell.className = 'typing-sound-shell';
    shell.innerHTML = `
      <button class="icon-control typing-sound-trigger" type="button" aria-expanded="false"></button>
      <div class="typing-sound-popover" hidden>
        <div class="typing-sound-heading">
          <span>${keyboardIcon} Typing sounds</span>
          <button class="typing-sound-toggle" type="button" role="switch" data-sound-toggle><i></i></button>
        </div>
        <div class="typing-sound-section">
          <p class="control-label">Preset</p>
          <div class="typing-sound-presets" role="group" aria-label="Typing sound preset">
            <button type="button" data-preset="soft">Soft</button>
            <button type="button" data-preset="mechanical">Mechanical</button>
            <button type="button" data-preset="typewriter">Typewriter</button>
          </div>
        </div>
        <label class="typing-sound-volume">
          <span>Volume</span>
          <input type="range" min="0" max="100" step="1" data-sound-volume aria-label="Typing sound volume">
          <small data-volume-label></small>
        </label>
        <button class="typing-sound-preview" type="button">Preview sound</button>
      </div>`;

    const focusButton = headerActions.querySelector('.text-control');
    headerActions.insertBefore(shell, focusButton || headerActions.lastElementChild);
    trigger = shell.querySelector('.typing-sound-trigger');
    popover = shell.querySelector('.typing-sound-popover');

    trigger.addEventListener('click', () => {
      const willOpen = popover.hidden;
      popover.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
    });

    shell.querySelector('[data-sound-toggle]').addEventListener('click', () => {
      settings.enabled = !settings.enabled;
      saveSettings();
      renderState();
      if (settings.enabled) playKeySound('a', settings.preset, true);
    });

    shell.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        settings.preset = button.dataset.preset;
        saveSettings();
        renderState();
        playKeySound('a', settings.preset, true);
      });
    });

    const range = shell.querySelector('[data-sound-volume]');
    range.addEventListener('input', () => {
      settings.volume = Number(range.value);
      saveSettings();
      renderState();
    });
    range.addEventListener('change', () => playKeySound('a', settings.preset, true));
    shell.querySelector('.typing-sound-preview').addEventListener('click', () => playKeySound('Enter', settings.preset, true));
    renderState();
  }

  document.addEventListener('keydown', (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.matches('.editor-field, .title-field')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    playKeySound(event.key);
  }, true);

  document.addEventListener('pointerdown', (event) => {
    if (shell && !shell.contains(event.target)) {
      popover.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && popover && !popover.hidden) {
      popover.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  const observer = new MutationObserver(createInterface);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  createInterface();
})();