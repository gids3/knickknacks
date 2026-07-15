/* --- Shared Helpers --- */
export function loadScript(url) {
  const cache = loadScript._cache;
  if (cache[url]) return cache[url];
  cache[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => { delete cache[url]; reject(new Error('Failed to load ' + url)); };
    document.head.appendChild(s);
  });
  return cache[url];
}
loadScript._cache = {};
export function loadScripts(urls) { return Promise.all(urls.map(loadScript)); }

// --- Hardware-aware file-size limits ---
// All file processing happens client-side, so oversized files blow up RAM
// (full ArrayBuffer + decoded bitmaps) and CPU (parse/render), which
// freezes or crashes the tab. We scale caps to the device's reported RAM
// (navigator.deviceMemory is Chromium-only; fall back to a safe 4 GB).
function getDeviceRamGB() { return (navigator.deviceMemory && navigator.deviceMemory > 0) ? navigator.deviceMemory : 4; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
const RAM_GB = getDeviceRamGB();

// Convert/Files tab: raster decode is RAM-heavy per byte, so cap tighter.
export const MAX_CONVERT_MB = clamp(Math.round(RAM_GB * 12.5), 25, 100);
// Merge/Reorder PDF tab: held decompressed in memory by two libs.
export const MAX_MERGE_MB = clamp(Math.round(RAM_GB * 25), 50, 200);
// Raster images: cap decoded pixel count so the bitmap/canvas fit in RAM.
export const MAX_RASTER_MP = clamp(Math.round(RAM_GB * 30), 25, 200);

// Returns an error string if `file` exceeds `maxMb`, otherwise null.
export function checkFileSize(file, maxMb) {
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `File is ${formatBytes(file.size)} — the limit for this tool is ${maxMb} MB. Try a smaller file.`;
  }
  return null;
}

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
export function createFsTipController(fsTipEl) {
  let fsTipTimer = null;
  return {
    show() {
      if (!fsTipEl) return;
      fsTipEl.hidden = false;
      clearTimeout(fsTipTimer);
      fsTipTimer = setTimeout(() => { fsTipEl.hidden = true; }, 4000);
    },
    hide() {
      if (fsTipEl) fsTipEl.hidden = true;
      clearTimeout(fsTipTimer);
    },
  };
}

export function wireDropzone(drop, input, btn, cb) {
  drop.addEventListener('click', () => input.click());
  btn.addEventListener('click', e => { e.stopPropagation(); input.click(); });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); cb(e.dataTransfer.files); });
  input.addEventListener('change', e => { cb(e.target.files); input.value = ''; });
}
