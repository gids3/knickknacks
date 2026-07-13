import { formatBytes, escapeHtml, triggerDownload, wireDropzone } from './util.js';

/* --- MERGE / REORDER (combined) --- */
try { (function() {
  // Real thumbnail images are only generated for a window at each end of a large
  // PDF. The middle pages still render as draggable placeholder cards (an
  // ellipsis run) so the full order stays intact and editable with no data loss.
  const THUMB_WINDOW = 15;

  // `documents` is the ordered model: each entry is one source PDF ("folder")
  // and holds its (possibly reordered / cross-moved) pages. `docMap` keeps the
  // loaded PDFDocument + pdfjs doc + metadata keyed by id, used for export.
  let documents = [];
  let docMap = {};

  const docList = document.getElementById('docList');
  const btn = document.getElementById('mrExportBtn');

  function totalPages() { return documents.reduce((n, d) => n + d.pages.length, 0); }

  function isWindowIndex(i, n) {
    return n <= THUMB_WINDOW * 2 || i < THUMB_WINDOW || i >= n - THUMB_WINDOW;
  }

  function makePageCard(page, windowed, loaded) {
    const card = document.createElement('div');
    card.className = 'page-card';
    card.dataset.homeDoc = page.homeDocId;
    card.dataset.pageIdx = page.pageIdx;
    card.dataset.origNum = page.origNum;
    if (windowed) {
      if (loaded) card.dataset.imgSrc = page.imgSrc;
      card.classList.add(loaded ? 'has-thumb' : 'page-loading');
      card.innerHTML = `
        ${loaded ? `<img src="${page.imgSrc}" alt="Page ${page.origNum}">` : '<img alt="Page ' + page.origNum + '">'}
        <span class="thumb-badge">p.${page.origNum}</span>
        <button type="button" class="thumb-remove" data-action="remove-page" aria-label="Remove page">&times;</button>`;
    } else {
      card.classList.add('page-placeholder');
      card.innerHTML = `
        <span class="page-ellipsis">&hellip;</span>
        <span class="thumb-badge">p.${page.origNum}</span>
        <button type="button" class="thumb-remove" data-action="remove-page" aria-label="Remove page">&times;</button>`;
    }
    return card;
  }

  function renderDoc(doc) {
    const card = document.createElement('div');
    card.className = 'doc-card' + (doc.expanded ? ' expanded' : '');
    card.dataset.docId = doc.id;

    const head = document.createElement('div');
    head.className = 'doc-header';
    head.innerHTML = `
      <span class="doc-toggle" title="Expand / collapse" role="button" aria-label="Expand or collapse">${doc.expanded ? '▾' : '▸'}</span>
      <span class="doc-handle" title="Drag to reorder PDF">&#8942;&#8942;</span>
      <span class="doc-info">
        <p class="doc-name">${escapeHtml(doc.name)}</p>
        <p class="doc-meta">${doc.pages.length} page${doc.pages.length !== 1 ? 's' : ''} &middot; ${formatBytes(doc.size)}</p>
      </span>
      <button type="button" class="icon-btn doc-remove" data-action="remove-doc" aria-label="Remove PDF" title="Remove PDF">&times;</button>`;

    const body = document.createElement('div');
    body.className = 'pages';
    body.hidden = !doc.expanded;
    const n = doc.pages.length;
    doc.pages.forEach((p, i) => {
      const windowed = isWindowIndex(i, n);
      body.appendChild(makePageCard(p, windowed, !!p.imgSrc));
    });

    card.appendChild(head);
    card.appendChild(body);
    head.querySelector('.doc-toggle').addEventListener('click', () => toggleDoc(card));
    docList.appendChild(card);

    if (doc.expanded && typeof Sortable !== 'undefined') {
      body._sortable = new Sortable(body, { group: 'mr-pages', draggable: '.page-card', animation: 150, onEnd: syncFromDOM });
    }
    return card;
  }

  async function generateThumbs(card, doc) {
    const body = card.querySelector('.pages');
    const id = doc.id;
    const n = doc.pages.length;
    for (let i = 0; i < n; i++) {
      if (!isWindowIndex(i, n)) continue;
      const pc = body.children[i];
      if (!pc || !pc.classList.contains('page-loading')) continue;
      const p = doc.pages[i];
      try {
        const pg = await docMap[id].pdfjsDoc.getPage(p.pageIdx + 1);
        const vp = pg.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        const url = canvas.toDataURL('image/jpeg', 0.8);
        p.imgSrc = url;
        pc.dataset.imgSrc = url;
        pc.classList.remove('page-loading');
        pc.classList.add('has-thumb');
        const img = pc.querySelector('img');
        if (img) img.src = url;
      } catch (e) { /* leave placeholder if a page fails to render */ }
    }
  }

  function setEmptyState() {
    if (!documents.length) {
      docList.innerHTML = '';
    }
  }

  // Rebuild `documents` from the current DOM after any drag, then refresh
  // derived UI (counts, export button, empty docs removed).
  function syncFromDOM() {
    const next = [];
    docList.querySelectorAll(':scope > .doc-card').forEach(card => {
      const id = card.dataset.docId;
      const pages = [];
      card.querySelectorAll('.pages .page-card').forEach(pc => {
        pages.push({
          homeDocId: pc.dataset.homeDoc,
          pageIdx: parseInt(pc.dataset.pageIdx, 10),
          origNum: parseInt(pc.dataset.origNum, 10),
          imgSrc: pc.dataset.imgSrc || null,
        });
      });
      if (!pages.length) { card.remove(); return; }
      next.push({ id, name: docMap[id].name, size: docMap[id].size, expanded: card.classList.contains('expanded'), pages });
    });
    documents = next;
    documents.forEach(d => {
      const card = docList.querySelector(`.doc-card[data-doc-id="${d.id}"]`);
      if (card) {
        const meta = card.querySelector('.doc-meta');
        if (meta) meta.textContent = `${d.pages.length} page${d.pages.length !== 1 ? 's' : ''} · ${formatBytes(d.size)}`;
      }
    });
    btn.classList.toggle('is-empty', totalPages() === 0);
    setEmptyState();
  }

  function toggleDoc(card) {
    const id = card.dataset.docId;
    const doc = documents.find(d => d.id === id);
    if (!doc) return;
    doc.expanded = !doc.expanded;
    card.classList.toggle('expanded', doc.expanded);
    const body = card.querySelector('.pages');
    body.hidden = !doc.expanded;
    card.querySelector('.doc-toggle').textContent = doc.expanded ? '▾' : '▸';
    if (doc.expanded) {
      if (!body._sortable && typeof Sortable !== 'undefined') {
        body._sortable = new Sortable(body, { group: 'mr-pages', draggable: '.page-card', animation: 150, onEnd: syncFromDOM });
      }
    } else if (body._sortable) {
      body._sortable.destroy();
      body._sortable = null;
    }
  }

  function updateSizePreview() {
    const el = document.getElementById('mrSizePreview');
    const originalTotal = documents.reduce((n, d) => n + d.origCount, 0);
    const multi = documents.length > 1;
    const deleted = totalPages() < originalTotal;
    if (!multi && !deleted) { el.hidden = true; return; }
    el.hidden = false;
    const bytes = documents.reduce((n, d) => n + d.size, 0);
    el.textContent = `Combined size: ≈ ${formatBytes(bytes)}`;
  }

  docList.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    if (t.dataset.action === 'remove-doc') {
      const card = t.closest('.doc-card');
      const id = card.dataset.docId;
      card.remove();
      delete docMap[id];
      documents = documents.filter(d => d.id !== id);
      btn.classList.toggle('is-empty', totalPages() === 0);
      updateSizePreview();
      setEmptyState();
      return;
    }
    if (t.dataset.action === 'remove-page') {
      t.closest('.page-card').remove();
      syncFromDOM();
      updateSizePreview();
    }
  });

  wireDropzone(document.getElementById('mrDropzone'), document.getElementById('mrFileInput'), document.getElementById('mrBrowseBtn'), async files => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfFiles.length) return;
    const es = docList.querySelector('.empty-state');
    if (es) es.remove();
    for (const file of pdfFiles) {
      const buf = await file.arrayBuffer();
      const srcPdf = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const id = 'd' + Math.random().toString(36).slice(2);
      docMap[id] = { srcPdf, pdfjsDoc, numPages: pdfjsDoc.numPages, name: file.name, size: file.size };
      const pages = [];
      for (let i = 1; i <= pdfjsDoc.numPages; i++) {
        pages.push({ homeDocId: id, pageIdx: i - 1, origNum: i, imgSrc: null });
      }
      const docObj = { id, name: file.name, size: file.size, expanded: true, origCount: pdfjsDoc.numPages, pages };
      documents.push(docObj);
      const card = renderDoc(docObj);
      generateThumbs(card, docObj);
    }
    btn.classList.toggle('is-empty', totalPages() === 0);
    updateSizePreview();
  });

  if (typeof Sortable !== 'undefined') {
    new Sortable(docList, { group: 'mr-docs', draggable: '.doc-card', handle: '.doc-handle', animation: 150, onEnd: syncFromDOM });
  }

  btn.addEventListener('click', async () => {
    if (!totalPages()) return;
    btn.disabled = true; btn.textContent = 'Merging…';
    try {
      const out = await PDFLib.PDFDocument.create();
      for (const d of documents) {
        for (const p of d.pages) {
          const src = docMap[p.homeDocId].srcPdf;
          const [copied] = await out.copyPages(src, [p.pageIdx]);
          out.addPage(copied);
        }
      }
      triggerDownload(new Blob([await out.save()], { type: 'application/pdf' }), 'merged.pdf');
    } catch (e) { alert('Merge failed: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = 'Merge & Download'; }
  });

  setEmptyState();
})(); } catch (e) { console.error('Merge/Reorder failed to init', e); }
