import './units.js';
import './clock.js';
import './timer.js';
import './alarm.js';
import './stopwatch.js';

/* --- Lazy Script Loader --- */
const _scriptCache = {};
export function loadScript(url) {
  if (_scriptCache[url]) return _scriptCache[url];
  _scriptCache[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => { delete _scriptCache[url]; reject(new Error('Failed to load ' + url)); };
    document.head.appendChild(s);
  });
  return _scriptCache[url];
}
export function loadScripts(urls) { return Promise.all(urls.map(loadScript)); }

const PDF_SCRIPTS = [
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
];
const CONVERT_SCRIPTS = [
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js',
];

function setupPdfWorker() {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
}

const _tabLoads = {};
function loadTabModule(tabName) {
  if (tabName === 'merge' || tabName === 'reorder') {
    if (!_tabLoads.pdf) {
      _tabLoads.pdf = loadScripts(PDF_SCRIPTS)
        .then(() => { setupPdfWorker(); return import('./pdf.js'); })
        .catch(e => { console.error('PDF load failed', e); delete _tabLoads.pdf; });
    }
  } else if (tabName === 'convert' || tabName === 'files') {
    if (!_tabLoads.converter) {
      _tabLoads.converter = loadScripts(CONVERT_SCRIPTS)
        .then(() => { setupPdfWorker(); return import('./converter.js'); })
        .catch(e => { console.error('Converter load failed', e); delete _tabLoads.converter; });
    }
  } else if (tabName === 'speed') {
    if (!_tabLoads.speed) {
      _tabLoads.speed = import('./speed.js')
        .catch(e => { console.error('Speed load failed', e); delete _tabLoads.speed; });
    }
  }
}

/* --- Light/Dark Theme Setup --- */
const themeToggle = document.getElementById('theme-toggle');
const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function setTheme(isLight) {
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    themeToggle.innerHTML = isLight ? moonIcon : sunIcon;
}

let isLightMode = prefersLight.matches;
setTheme(isLightMode);

themeToggle.addEventListener('click', () => { isLightMode = !isLightMode; setTheme(isLightMode); });
prefersLight.addEventListener('change', (e) => { isLightMode = e.matches; setTheme(isLightMode); });

/* --- Tab Management (with hash routing) --- */
const tabButtons = document.querySelectorAll('.tab-btn');
const siteNote = document.getElementById('siteNote');
const fileBasedTabs = ['merge', 'reorder', 'files'];
const validTabs = ['home', 'units', 'files', ...Array.from(tabButtons).map(b => b.dataset.tab)];
const DEFAULT_TAB = 'home';
let convertView = 'units';

// Renders a tab as active without touching the URL — used by both the hashchange
// listener and the initial load, so the hash is always the single source of truth.
function activateTab(tabName, focusInput) {
  if (!validTabs.includes(tabName)) tabName = DEFAULT_TAB;
  const isConvertView = (tabName === 'units' || tabName === 'files');
  if (isConvertView) convertView = (tabName === 'units') ? 'units' : 'files';
  tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === (isConvertView ? 'convert' : tabName)));
  document.querySelectorAll('.tab-dropdown-item').forEach(i => i.classList.toggle('active', (isConvertView && i.dataset.convert === convertView)));
  document.querySelectorAll('.tab-panel').forEach(p => p.hidden = p.id !== 'tab-' + tabName);
  siteNote.hidden = !fileBasedTabs.includes(tabName);
  loadTabModule(tabName);
  if (tabName === 'units' && focusInput) document.getElementById('num-in').focus();
  return tabName;
}

// Clicking a tab updates the hash (bookmarkable + back/forward friendly). If the
// hash is already correct (e.g. re-clicking the current tab), hashchange won't
// fire on its own, so activate directly in that case. Some sandboxed embeds (e.g.
// an about:srcdoc preview iframe) disallow URL/History changes entirely — fall
// back to just switching the panel so the tabs still work there.
tabButtons.forEach(btn => btn.addEventListener('click', () => {
  let tabName = btn.dataset.tab;
  if (tabName === 'convert') tabName = (convertView === 'files') ? 'files' : 'units';
  if (location.hash.slice(1) === tabName) { activateTab(tabName, true); return; }
  try { location.hash = tabName; }
  catch (e) { activateTab(tabName, true); }
}));

document.querySelectorAll('.tab-dropdown-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const tabName = (item.dataset.convert === 'units') ? 'units' : 'files';
    if (location.hash.slice(1) === tabName) { activateTab(tabName, true); return; }
    try { location.hash = tabName; }
    catch (e) { activateTab(tabName, true); }
  });
});

document.querySelectorAll('.home-tile').forEach(tile => tile.addEventListener('click', () => {
  const tabName = tile.dataset.goto;
  if (location.hash.slice(1) === tabName) { activateTab(tabName, true); return; }
  try { location.hash = tabName; }
  catch (e) { activateTab(tabName, true); }
}));

const homeFab = document.getElementById('homeFab');
function goHome() {
  if (location.hash.slice(1) === 'home') { activateTab('home', false); return; }
  try { location.hash = 'home'; }
  catch (e) { activateTab('home', false); }
}
homeFab.addEventListener('click', goHome);

window.addEventListener('hashchange', () => activateTab(location.hash.slice(1), true));

// Initial route: honor whatever hash the page was loaded/bookmarked with, defaulting
// to Units. replaceState (not setting location.hash) avoids adding an extra history
// entry, but some sandboxed embeds throw on any History API call — ignore that safely.
const startTab = activateTab(location.hash.slice(1), false);
if (location.hash.slice(1) !== startTab) {
  try { history.replaceState(null, '', '#' + startTab); } catch (e) { /* URL update unavailable in this embed; tab still activated above */ }
}

/* --- Shared Helpers --- */
export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}
export function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
export function getExt(filename) { return filename.toLowerCase().split('.').pop() || ''; }
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function wireDropzone(drop, input, btn, cb) {
  drop.addEventListener('click', () => input.click());
  btn.addEventListener('click', e => { e.stopPropagation(); input.click(); });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); cb(e.dataTransfer.files); });
  input.addEventListener('change', e => { cb(e.target.files); input.value = ''; });
}

// Fullscreen Logic
document.querySelectorAll('.fs-btn').forEach(btn => btn.addEventListener('click', e => {
  if (btn.disabled) return;
  const p = e.target.closest('.panel');
  if (!document.fullscreenElement) {
      p.closest('.tab-panel').requestFullscreen && p.closest('.tab-panel').requestFullscreen();
      document.querySelectorAll('.fs-tip').forEach(t => t.hidden = true);
  } else {
      document.exitFullscreen && document.exitFullscreen();
  }
}));

document.addEventListener('fullscreenchange', () => {
  const fsEl = document.fullscreenElement;
  document.querySelectorAll('.panel.time-panel, .panel.speed-panel').forEach(p => {
      const btn = p.querySelector('.fs-btn');
      if (fsEl && fsEl.contains(p)) {
          p.classList.add('fs-active');
          if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
          document.querySelectorAll('.fs-tip').forEach(t => t.hidden = true);
      } else {
          p.classList.remove('fs-active');
          if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
      }
  });
});
