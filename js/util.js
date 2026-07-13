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
