import { formatBytes, escapeHtml, triggerDownload, wireDropzone } from './util.js';

/* --- MERGE --- */
try { (function() {
  let queue = [];
  const list = document.getElementById('mergeFileList'), btn = document.getElementById('mergeBtn');
  function render() {
    btn.classList.toggle('is-empty', !queue.length);
    if(!queue.length) { list.innerHTML = '<li class="empty-state">No files yet — add PDFs above.</li>'; return; }
    list.innerHTML = queue.map((q, i) => `<li class="file-row"><span class="drag-handle">&#8942;&#8942;</span><span class="file-info"><p class="file-name">${escapeHtml(q.file.name)}</p><p class="file-size">${formatBytes(q.file.size)}</p></span><span class="file-actions"><button type="button" class="icon-btn" data-action="remove" data-idx="${i}">&times;</button></span></li>`).join('');
  }
  wireDropzone(document.getElementById('mergeDropzone'), document.getElementById('mergeFileInput'), document.getElementById('mergeBrowseBtn'), files => {
    Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')).forEach(file => queue.push({ id: Math.random().toString(), file }));
    render();
  });
  list.addEventListener('click', e => { if (e.target.dataset.action === 'remove') { queue.splice(e.target.dataset.idx, 1); render(); } });
  if (typeof Sortable !== 'undefined') {
    new Sortable(list, { handle: '.drag-handle', animation: 150, onEnd: e => { queue.splice(e.newIndex, 0, queue.splice(e.oldIndex, 1)[0]); render(); } });
  }
  btn.addEventListener('click', async () => {
    if(!queue.length) return; btn.disabled = true; btn.textContent = 'Merging…';
    try {
      const out = await PDFLib.PDFDocument.create();
      for (const q of queue) {
        const src = await PDFLib.PDFDocument.load(await q.file.arrayBuffer(), { ignoreEncryption: true });
        (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
      }
      triggerDownload(new Blob([await out.save()], { type: 'application/pdf' }), 'merged.pdf');
    } catch (e) { alert('Merge failed: ' + e.message); } finally { btn.disabled = false; btn.textContent = 'Merge & Download'; }
  });
  render();
})(); } catch (e) { console.error('Merge failed to init', e); }

/* --- REORDER --- */
try { (function() {
  let pages = [];
  const grid = document.getElementById('thumbGrid'), btn = document.getElementById('reorderExportBtn');
  function render() {
    btn.classList.toggle('is-empty', !pages.length);
    if(!pages.length) { grid.innerHTML = '<p class="empty-state">No pages yet — add PDFs above.</p>'; return; }
    grid.innerHTML = pages.map((p, i) => `<div class="thumb-card" data-idx="${i}"><button class="thumb-remove" data-action="remove" data-idx="${i}">&times;</button><img src="${p.imgSrc}"><span class="thumb-badge">${i+1}</span></div>`).join('');
  }
  wireDropzone(document.getElementById('reorderDropzone'), document.getElementById('reorderFileInput'), document.getElementById('reorderBrowseBtn'), async files => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfFiles.length) return;
    grid.innerHTML = '<p class="empty-state">Loading pages...</p>';
    for (const file of pdfFiles) {
      const srcPdf = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push({ srcPdf, pageIdx: i - 1, imgSrc: canvas.toDataURL('image/jpeg', 0.8) });
      }
    }
    render();
  });
  grid.addEventListener('click', e => {
    if (e.target.dataset.action === 'remove') {
      pages.splice(parseInt(e.target.dataset.idx, 10), 1);
      render();
    }
  });
  if (typeof Sortable !== 'undefined') {
    new Sortable(grid, { animation: 150, onEnd: e => { pages.splice(e.newIndex, 0, pages.splice(e.oldIndex, 1)[0]); render(); } });
  }
  btn.addEventListener('click', async () => {
    if(!pages.length) return;
    btn.disabled = true; btn.textContent = 'Generating PDF…';
    try {
      const outPdf = await PDFLib.PDFDocument.create();
      for (const p of pages) {
        const [copiedPage] = await outPdf.copyPages(p.srcPdf, [p.pageIdx]);
        outPdf.addPage(copiedPage);
      }
      triggerDownload(new Blob([await outPdf.save()], { type: 'application/pdf' }), 'reordered.pdf');
    } catch (e) { alert('Export failed: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = 'Download reordered PDF'; }
  });
})(); } catch (e) { console.error('Reorder failed to init', e); }
