(() => {
  'use strict';

  const STORAGE_KEY = 'luma-ambience-settings-v2';
  const LEGACY_KEY = 'luma-typing-sound-settings-v1';
  const PALETTES = [
    ['paper', 'Paper', ['#efeee9', '#fbfaf7', '#375c4a']],
    ['sage', 'Sage', ['#e7ece6', '#f8faf6', '#51705d']],
    ['ocean', 'Ocean', ['#e6edf1', '#f7fafc', '#456c7c']],
    ['rose', 'Rose', ['#f0e8e7', '#fcf8f7', '#8a5b63']],
    ['lavender', 'Lavender', ['#ebe8f1', '#faf8fc', '#6e6189']],
    ['amber', 'Amber', ['#f1eadf', '#fdfaf4', '#86683a']],
  ];
  const PRESETS = new Set(['butter', 'thock', 'felt']);
  const defaults = { palette: 'paper', soundEnabled: true, soundPreset: 'butter', soundVolume: 30, musicVolume: 55 };
  let settings = loadSettings();
  let shell;
  let soundPopover;
  let palettePopover;
  let context;
  let master;
  let noiseBuffer;
  let lastSound = 0;

  function clamp(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : fallback;
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}');
      return {
        ...defaults,
        ...saved,
        palette: PALETTES.some(([id]) => id === saved.palette) ? saved.palette : defaults.palette,
        soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : typeof legacy.enabled === 'boolean' ? legacy.enabled : defaults.soundEnabled,
        soundPreset: PRESETS.has(saved.soundPreset) ? saved.soundPreset : defaults.soundPreset,
        soundVolume: clamp(saved.soundVolume ?? legacy.volume, defaults.soundVolume),
        musicVolume: clamp(saved.musicVolume, defaults.musicVolume),
      };
    } catch {
      return { ...defaults };
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function icon(name, size = 17) {
    const paths = {
      keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M19 10h.01M7 14h.01M11 14h6"/>',
      palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"/><path d="M15.5 16.5c.8 1.1 2.8.9 3.7-.4"/>',
      volume: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8.5 8.5 0 0 1 0 12"/>',
      volumeOff: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 5"/><path d="m21 9-5 5"/>',
      check: '<path d="M20 6 9 17l-5-5"/>',
    };
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${paths[name]}</svg>`;
  }

  function applyPalette() {
    document.documentElement.dataset.palette = settings.palette;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const colors = {
      paper: dark ? '#161716' : '#efeee9', sage: dark ? '#121713' : '#e7ece6', ocean: dark ? '#10161a' : '#e6edf1',
      rose: dark ? '#181315' : '#f0e8e7', lavender: dark ? '#15131a' : '#ebe8f1', amber: dark ? '#18150f' : '#f1eadf',
    };
    meta.content = colors[settings.palette];
  }

  function ensureAudio() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return context;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const lowpass = context.createBiquadFilter();
    compressor.threshold.value = -23;
    compressor.knee.value = 20;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.13;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3100;
    lowpass.Q.value = 0.3;
    master.connect(compressor).connect(lowpass).connect(context.destination);
    noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.2), context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      previous = previous * 0.9 + (Math.random() * 2 - 1) * 0.1;
      data[index] = previous;
    }
    return context;
  }

  function playKey(key, force = false, override = null) {
    if (!force && !settings.soundEnabled) return;
    if (['Shift','Control','Alt','Meta','CapsLock','Tab','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Insert'].includes(key) || /^F\d+$/.test(key)) return;
    const stamp = performance.now();
    if (!force && stamp - lastSound < 15) return;
    lastSound = stamp;
    const audio = ensureAudio();
    if (!audio || !master || !noiseBuffer) return;

    const preset = override || settings.soundPreset;
    const profile = {
      butter: { fundamental: 116, body: 224, noise: 880, duration: .085, bodyGain: .043, noiseGain: .017 },
      thock: { fundamental: 86, body: 164, noise: 620, duration: .11, bodyGain: .054, noiseGain: .02 },
      felt: { fundamental: 142, body: 278, noise: 1080, duration: .067, bodyGain: .03, noiseGain: .011 },
    }[preset];
    const start = audio.currentTime;
    const level = Math.max(.001, settings.soundVolume / 100);
    const pitch = (key === ' ' ? .8 : key === 'Enter' ? .9 : key === 'Backspace' || key === 'Delete' ? 1.07 : 1) * (.95 + Math.random() * .1);
    const duration = profile.duration * (key === ' ' ? 1.18 : 1);
    const bodyFilter = audio.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.value = preset === 'thock' ? 1000 : 1450;
    bodyFilter.Q.value = .4;
    bodyFilter.connect(master);

    const tone = (frequency, amount, type, decay) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency * pitch;
      oscillator.detune.value = (Math.random() - .5) * 10;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002, amount * level), start + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, start + decay);
      oscillator.connect(gain).connect(bodyFilter);
      oscillator.start(start);
      oscillator.stop(start + decay + .015);
    };
    tone(profile.fundamental, profile.bodyGain, 'sine', duration);
    tone(profile.body, profile.bodyGain * .36, 'triangle', duration * .72);

    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = profile.noise * pitch;
    filter.Q.value = preset === 'felt' ? .55 : .8;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(profile.noiseGain * level, start + .0025);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration * .56);
    source.connect(filter).connect(gain).connect(master);
    source.start(start, Math.random() * .06, Math.min(noiseBuffer.duration - .06, duration));
    source.stop(start + duration + .01);
  }

  function createInterface() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.querySelector('.luma-extras-shell')) return;
    shell = document.createElement('div');
    shell.className = 'luma-extras-shell';
    shell.innerHTML = `
      <div class="luma-tool"><button class="icon-control luma-trigger" data-panel="sound" aria-label="Typing sounds" title="Typing sounds">${icon('keyboard')}</button><div class="luma-popover luma-sound-popover" hidden></div></div>
      <div class="luma-tool"><button class="icon-control luma-trigger" data-panel="palette" aria-label="Color palette" title="Color palette">${icon('palette')}</button><div class="luma-popover luma-palette-popover" hidden></div></div>`;
    actions.insertBefore(shell, actions.querySelector('.text-control') || actions.lastElementChild);
    soundPopover = shell.querySelector('.luma-sound-popover');
    palettePopover = shell.querySelector('.luma-palette-popover');
    shell.addEventListener('click', handleClick);
    shell.addEventListener('input', handleInput);
    render();
  }

  function render() {
    applyPalette();
    if (!shell) return;
    shell.querySelector('[data-panel="sound"]').classList.toggle('is-active', settings.soundEnabled);
    soundPopover.innerHTML = `
      <div class="luma-popover-heading"><div><strong>Typing sounds</strong><small>Soft, low and distraction-free</small></div><button class="luma-switch ${settings.soundEnabled ? 'on' : ''}" data-action="toggle" role="switch" aria-checked="${settings.soundEnabled}"><i></i></button></div>
      <div class="luma-section"><p class="control-label">Sound</p><div class="luma-sound-presets">
        ${[['butter','Butter','Creamy'],['thock','Deep thock','Low'],['felt','Felt','Quiet']].map(([id,label,detail]) => `<button data-action="preset" data-preset="${id}" class="${settings.soundPreset === id ? 'active' : ''}"><strong>${label}</strong><small>${detail}</small></button>`).join('')}
      </div></div>
      <label class="luma-range"><span>${settings.soundVolume ? icon('volume',14) : icon('volumeOff',14)} Volume</span><input type="range" min="0" max="100" value="${settings.soundVolume}" data-input="sound-volume"><small>${settings.soundVolume}%</small></label>
      <button class="luma-preview" data-action="preview">Preview sound</button>`;
    palettePopover.innerHTML = `
      <div class="luma-popover-heading"><div><strong>Color palette</strong><small>Choose a calmer writing atmosphere</small></div></div>
      <div class="luma-palette-grid">${PALETTES.map(([id,label,colors]) => `<button data-action="palette" data-palette="${id}" class="${settings.palette === id ? 'active' : ''}"><i>${colors.map(color => `<b style="background:${color}"></b>`).join('')}</i><span>${label}</span>${settings.palette === id ? icon('check',13) : ''}</button>`).join('')}</div>
      <p class="luma-note">Use Luma’s moon button to switch any palette between light and dark.</p>`;
  }

  function handleClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.panel) {
      const target = button.dataset.panel === 'sound' ? soundPopover : palettePopover;
      const open = target.hidden;
      soundPopover.hidden = true;
      palettePopover.hidden = true;
      target.hidden = !open;
      return;
    }
    if (button.dataset.action === 'toggle') {
      settings.soundEnabled = !settings.soundEnabled;
      save(); render();
      if (settings.soundEnabled) playKey('a', true);
    } else if (button.dataset.action === 'preview') {
      playKey('Enter', true);
    } else if (button.dataset.action === 'preset') {
      settings.soundPreset = button.dataset.preset;
      save(); render(); playKey('a', true, settings.soundPreset);
    } else if (button.dataset.action === 'palette') {
      settings.palette = button.dataset.palette;
      save(); render();
    }
  }

  function handleInput(event) {
    if (event.target.dataset.input !== 'sound-volume') return;
    settings.soundVolume = Number(event.target.value);
    save();
    event.target.parentElement.querySelector('small').textContent = `${settings.soundVolume}%`;
  }

  document.addEventListener('keydown', event => {
    if (!(event.target instanceof Element) || !event.target.matches('.editor-field,.title-field') || event.ctrlKey || event.metaKey || event.altKey) return;
    playKey(event.key);
  }, true);
  document.addEventListener('pointerdown', event => {
    if (shell && !shell.contains(event.target)) [soundPopover, palettePopover].forEach(popover => { if (popover) popover.hidden = true; });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') [soundPopover, palettePopover].forEach(popover => { if (popover) popover.hidden = true; });
  });
  new MutationObserver(() => { createInterface(); applyPalette(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'] });
  applyPalette();
  createInterface();
})();
