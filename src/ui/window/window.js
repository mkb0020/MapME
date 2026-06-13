/**
 * ============================================================
 * PRETTY KIT — window.js
 * Cyberpunk Glassmorphism Desktop Window Framework
 * Tauri 2 Compatible
 * ============================================================
 */

/**
 * Detect Tauri environment safely.
 * Works for both Tauri 1.x and 2.x.
 */
const IS_TAURI = typeof window !== 'undefined' && (
  '__TAURI__' in window ||
  '__TAURI_INTERNALS__' in window
);

// ── Tauri API shim ───────────────────────────────────────────
// Lazily loaded so the file works in a plain browser too.
let _tauriWindow = null;

async function getTauriWindow() {
  if (!IS_TAURI) return null;
  if (_tauriWindow) return _tauriWindow;
  try {
    // Tauri 2.x
    const mod = await import('@tauri-apps/api/window');
    _tauriWindow = mod.getCurrentWebviewWindow
      ? mod.getCurrentWebviewWindow()
      : (mod.appWindow ?? mod.getCurrent?.());
  } catch {
    try {
      // Tauri 1.x fallback
      const mod = await import('@tauri-apps/api/window');
      _tauriWindow = mod.appWindow;
    } catch {
      console.warn('[PrettyKit] Tauri window API unavailable.');
    }
  }
  return _tauriWindow;
}

// ── Internal state ────────────────────────────────────────────
const _state = {
  title:       'Pretty Kit',
  icon:        '',
  accentColor: null,   // css named key or hex string
  isMaximized: false,
  statusText:  'READY',
  version:     'v1.0.0',
};

// ── DOM refs (resolved after DOMContentLoaded) ────────────────
const $ = (id) => document.getElementById(id);

let _els = {};

function _resolveEls() {
  _els = {
    window:      $('pretty-window'),
    titlebar:    $('pretty-titlebar'),
    icon:        $('pretty-icon'),
    title:       $('pretty-title'),
    controls:    $('pretty-controls'),
    content:     $('pretty-content'),
    statusbar:   $('pretty-statusbar'),
    statusText:  $('pk-status-text'),
    statusVer:   $('pk-status-version'),
    btnMin:      $('pk-minimize'),
    btnMax:      $('pk-maximize'),
    btnClose:    $('pk-close'),
    maxIcon:     $('pk-max-icon'),
    restoreIcon: $('pk-restore-icon'),
  };
}

// ═════════════════════════════════════════════════════════════
//  PUBLIC API
// ═════════════════════════════════════════════════════════════

/**
 * Bootstrap Pretty Kit.
 *
 * @param {Object} options
 * @param {string}  [options.title]        - Window title text
 * @param {string}  [options.icon]         - Path or emoji for the icon
 * @param {string}  [options.accentColor]  - Named key: 'aqua'|'pink'|'violet'|'green'|'orange'
 *                                           or any CSS hex: '#ff00ff'
 * @param {string}  [options.version]      - Status bar version string
 * @param {string}  [options.statusText]   - Initial status bar text
 * @param {boolean} [options.showStatus]   - Show/hide the status bar (default true)
 * @returns {PrettyKitInstance}
 */
function createPrettyWindow(options = {}) {
  const {
    title       = 'Pretty Kit',
    icon        = '',
    accentColor = 'aqua',
    version     = 'v1.0.0',
    statusText  = 'READY',
    showStatus  = true,
  } = options;

  // Apply options
  setTitle(title);
  setIcon(icon);
  setAccentColor(accentColor);
  setVersion(version);
  setStatusText(statusText);

  if (!showStatus && _els.statusbar) {
    _els.statusbar.style.display = 'none';
  }

  return _instance;
}

/**
 * Set the window title.
 * @param {string} title
 */
function setTitle(title) {
  _state.title = title;
  if (_els.title) _els.title.textContent = title;
  document.title = title;
  if (IS_TAURI) {
    getTauriWindow().then(win => win?.setTitle?.(title));
  }
}

/**
 * Set the app icon.
 * Accepts an image path, a URL, or an emoji string.
 * @param {string} icon
 */
function setIcon(icon) {
  _state.icon = icon;
  if (!_els.icon) return;

  const el = _els.icon;
  if (!icon) {
    el.style.display = 'none';
    return;
  }

  // Emoji or text fallback
  if ([...icon].length <= 2 && isNaN(Number(icon))) {
    el.tagName === 'IMG' && el.replaceWith(_makeSpanIcon(icon));
    return;
  }

  el.src = icon;
  el.style.display = '';
}

/**
 * Set the accent color theme.
 * Named presets: 'aqua' | 'pink' | 'violet' | 'green' | 'orange'
 * Or pass any CSS hex string like '#ff00ff' for a custom accent.
 *
 * @param {string} color
 */
function setAccentColor(color) {
  _state.accentColor = color;
  if (!_els.window) return;

  const namedPresets = new Set(['aqua', 'pink', 'violet', 'green', 'orange']);
  const el = _els.window;

  // Remove any previous accent attribute
  el.removeAttribute('data-accent');

  if (!color) return;

  if (namedPresets.has(color)) {
    if (color !== 'aqua') el.setAttribute('data-accent', color);
    // 'aqua' is the default, no attribute needed
  } else {
    // Custom hex/rgb: inject CSS variable override inline
    el.style.setProperty('--accent',      color);
    el.style.setProperty('--accent-glow', _hexToGlow(color, 0.40));
    el.style.setProperty('--accent-dim',  _hexToGlow(color, 0.12));
    el.style.setProperty('--holo-border', _hexToGlow(color, 0.30));
    el.style.setProperty('--holo-border-hover', _hexToGlow(color, 0.75));
  }
}

/**
 * Set the status bar text.
 * @param {string} text
 */
function setStatusText(text) {
  _state.statusText = text;
  if (_els.statusText) _els.statusText.textContent = text.toUpperCase();
}

/**
 * Set the version string shown in the status bar.
 * @param {string} ver
 */
function setVersion(ver) {
  _state.version = ver;
  if (_els.statusVer) _els.statusVer.textContent = ver;
}

/**
 * Minimize the window.
 */
async function minimize() {
  if (IS_TAURI) {
    const win = await getTauriWindow();
    await win?.minimize?.();
  } else {
    _els.window && (_els.window.style.transform = 'scale(0.95)');
    setTimeout(() => _els.window && (_els.window.style.transform = ''), 200);
  }
}

/**
 * Toggle maximize / restore.
 */
async function toggleMaximize() {
  if (IS_TAURI) {
    const win = await getTauriWindow();
    await win?.toggleMaximize?.();
    // Sync state from Tauri
    const maximized = await win?.isMaximized?.();
    _setMaximizedState(maximized ?? !_state.isMaximized);
  } else {
    _setMaximizedState(!_state.isMaximized);
  }
}

/**
 * Close the window.
 */
async function close() {
  if (IS_TAURI) {
    const win = await getTauriWindow();
    await win?.close?.();
  } else {
    window.close();
  }
}

// ═════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═════════════════════════════════════════════════════════════

function _setMaximizedState(isMaximized) {
  _state.isMaximized = isMaximized;
  if (!_els.btnMax) return;

  _els.btnMax.classList.toggle('is-maximized', isMaximized);
  _els.btnMax.setAttribute('aria-label', isMaximized ? 'Restore window' : 'Maximize window');
  _els.btnMax.title = isMaximized ? 'Restore' : 'Maximize';

  if (_els.maxIcon)     _els.maxIcon.style.display     = isMaximized ? 'none' : '';
  if (_els.restoreIcon) _els.restoreIcon.style.display = isMaximized ? ''     : 'none';

  // Adjust border-radius when maximized
  if (_els.window) {
    _els.window.style.borderRadius = isMaximized ? '0' : '';
  }
}

/**
 * Convert a hex color to rgba string for glow effects.
 * @param {string} hex  - e.g. '#ff69b4'
 * @param {number} alpha
 * @returns {string}
 */
function _hexToGlow(hex, alpha = 0.4) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(0,255,255,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Replace the <img> icon with a <span> for emoji/text icons.
 * @param {string} emoji
 * @returns {HTMLSpanElement}
 */
function _makeSpanIcon(emoji) {
  const span = document.createElement('span');
  span.id = 'pretty-icon';
  span.className = 'icon-placeholder';
  span.setAttribute('aria-hidden', 'true');
  span.textContent = emoji;
  span.style.cssText = 'font-size:18px;line-height:1;width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
  return span;
}

/**
 * Wire up all titlebar button click events.
 */
function _bindControls() {
  _els.btnMin?.addEventListener('click', (e) => {
    e.stopPropagation();
    minimize();
  });

  _els.btnMax?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMaximize();
  });

  _els.btnClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  // Double-click titlebar to maximize/restore
  _els.titlebar?.addEventListener('dblclick', () => {
    toggleMaximize();
  });
}

/**
 * Listen for Tauri window state events (maximized/restored).
 * This keeps the icon in sync when the user uses OS shortcuts.
 */
async function _bindTauriEvents() {
  if (!IS_TAURI) return;
  try {
    const { listen } = await import('@tauri-apps/api/event');
    await listen('tauri://resize', async () => {
      const win = await getTauriWindow();
      const maximized = await win?.isMaximized?.();
      if (typeof maximized === 'boolean') _setMaximizedState(maximized);
    });
  } catch {
    // Event API unavailable — non-fatal
  }
}

// ═════════════════════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════════════════════

function _init() {
  _resolveEls();
  _bindControls();
  _bindTauriEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}

// ═════════════════════════════════════════════════════════════
//  EXPORTED INSTANCE
// ═════════════════════════════════════════════════════════════

/**
 * The Pretty Kit instance object.
 * Use createPrettyWindow() to initialize, then call methods here.
 */
const _instance = {
  createPrettyWindow,
  setTitle,
  setIcon,
  setAccentColor,
  setStatusText,
  setVersion,
  minimize,
  toggleMaximize,
  close,
  get state() { return { ..._state }; },
  get content() { return _els.content ?? null; },
};

export default _instance;
export {
  createPrettyWindow,
  setTitle,
  setIcon,
  setAccentColor,
  setStatusText,
  setVersion,
  minimize,
  toggleMaximize,
  close,
};