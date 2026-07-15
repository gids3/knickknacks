import { formatBytes, getExt, triggerDownload, wireDropzone, loadScript, checkFileSize, MAX_CONVERT_MB, MAX_RASTER_MP } from './util.js';

/* --- CONVERT FILES --- */
try { (function() {
  let curr = null, sizes = {}, bmpCache = null;
  const info = document.getElementById('cvFileInfo'), acts = document.getElementById('cvActions'), err = document.getElementById('cvError');
  const RASTER = ['png','jpg','jpeg','webp','bmp','gif','ico','tif','tiff','heic','heif'];

  function clearError() { err.hidden = true; }
  function showError(msg) { err.hidden = false; err.textContent = msg; }

  // Which output formats a given input extension can target.
  // fallow-ignore-next-line complexity
  function targetsFor(ext) {
    if (RASTER.includes(ext)) return [{ fmt:'png', label:'PNG' }, { fmt:'jpeg', label:'JPEG' }, { fmt:'webp', label:'WEBP' }];
    if (ext === 'pdf') return [{ fmt:'md', label:'MD' }, { fmt:'txt', label:'TXT' }];
    if (ext === 'txt' || ext === 'md') return [{ fmt:'pdf', label:'PDF' }];
    if (ext === 'html' || ext === 'htm' || ext === 'docx') return [{ fmt:'txt', label:'TXT' }, { fmt:'md', label:'MD' }, { fmt:'pdf', label:'PDF' }];
    if (ext === 'xlsx') return [{ fmt:'csv', label:'CSV' }, { fmt:'txt', label:'TXT' }];
    if (ext === 'pptx') return [{ fmt:'txt', label:'TXT' }, { fmt:'md', label:'MD' }];
    return [];
  }

  /* --- raster --- */
  async function getBitmap(f) {
    if (bmpCache && bmpCache.key === f.name + ':' + f.size) return bmpCache.bmp;
    const ext = getExt(f.name); let blob = f;
    if (ext === 'heic' || ext === 'heif') blob = [].concat(await heic2any({ blob: f, toType: 'image/png' }))[0];
    else if (ext === 'tif' || ext === 'tiff') blob = await tiffToBlob(f);
    const bmp = await createImageBitmap(blob);
    bmpCache = { key: f.name + ':' + f.size, bmp };
    return bmp;
  }
  async function tiffToBlob(f) {
    if (typeof UTIF === 'undefined') throw new Error('TIFF support failed to load. Try PNG/JPEG instead.');
    const buf = new Uint8Array(await f.arrayBuffer()), ifds = UTIF.decode(buf);
    UTIF.decodeImage(buf, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const c = document.createElement('canvas'); c.width = ifds[0].width; c.height = ifds[0].height;
    const ctx = c.getContext('2d'), img = ctx.createImageData(c.width, c.height);
    img.data.set(rgba); ctx.putImageData(img, 0, 0);
    return await new Promise(r => c.toBlob(r, 'image/png'));
  }
  async function rasterTo(fmt, f) {
    const bmp = await getBitmap(f), c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/' + fmt, 0.92));
    if (!blob) throw new Error('This browser cannot encode ' + fmt.toUpperCase());
    return blob;
  }

  /* --- text / markup --- */
  async function pdfPages(f) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF library failed to load. Check your connection and try again.');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise, pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      let p = ''; (await (await doc.getPage(i)).getTextContent()).items.forEach(it => p += (p && !p.endsWith(' ') ? ' ' : '') + it.str);
      pages.push(p);
    }
    return pages;
  }
  async function docxHtml(f) {
    if (typeof mammoth === 'undefined') throw new Error('DOCX library failed to load. Check your connection and try again.');
    return (await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })).value;
  }
  async function htmlOf(f, ext) {
    if (ext === 'html' || ext === 'htm') return await f.text();
    if (ext === 'docx') return await docxHtml(f);
    throw new Error('Not an HTML source');
  }
  function stripHtml(html) {
    const d = document.createElement('div'); d.innerHTML = html;
    d.querySelectorAll('br').forEach(e => e.replaceWith('\n'));
    d.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6,section,article').forEach(e => { e.appendChild(document.createTextNode('\n')); });
    return (d.textContent || '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }
  let _td;
  async function toMd(html) {
    if (!_td) { await loadScript('https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.min.js'); _td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' }); }
    return _td.turndown(html);
  }
  async function pptxText(f) {
    if (typeof JSZip === 'undefined') throw new Error('PPTX library failed to load. Check your connection and try again.');
    const zip = await JSZip.loadAsync(await f.arrayBuffer());
    const slides = Object.keys(zip.files).filter(n => /ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => +a.match(/slide(\d+)/)[1] - +b.match(/slide(\d+)/)[1]);
    const out = [];
    for (const s of slides) {
      const xml = await zip.files[s].async('string');
      const runs = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
      out.push(runs.map(x => x.replace(/<a:t>|<\/a:t>/g, '')).join(' ').trim());
    }
    return out.map((t, i) => `## Slide ${i + 1}\n\n${t}`).join('\n\n');
  }
  async function xlsxText(f, asCsv) {
    if (typeof XLSX === 'undefined') throw new Error('XLSX library failed to load. Check your connection and try again.');
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), out = [];
    wb.SheetNames.forEach(n => {
      out.push('# ' + n);
      XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })
        .forEach(r => out.push(r.join(asCsv ? ',' : '\t')));
    });
    return out.join('\n');
  }

  async function textToPdf(text, baseName) {
    if (typeof PDFLib === 'undefined') throw new Error('PDF library failed to load. Check your connection and try again.');
    const doc = await PDFLib.PDFDocument.create(), font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const size = 12, lineH = 16, margin = 40, maxW = 595 - margin * 2;
    let page = doc.addPage([595, 842]), y = page.getHeight() - margin, line = '';
    const newPage = () => { page = doc.addPage([595, 842]); y = page.getHeight() - margin; };
    for (const w of text.split(/\s+/)) {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW) {
        page.drawText(line, { x: margin, y, size, font, maxWidth: maxW, lineHeight: lineH });
        y -= lineH; line = w;
        if (y < margin) newPage();
      } else line = test;
    }
    if (line) page.drawText(line, { x: margin, y, size, font, maxWidth: maxW, lineHeight: lineH });
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }

  /* --- per-format producers --- */
  async function produceFromPdf(fmt, f) {
    const pages = await pdfPages(f);
    if (fmt === 'md') return new Blob([pages.map((p, i) => `## Page ${i + 1}\n\n${p}`).join('\n\n')], { type: 'text/markdown' });
    if (fmt === 'txt') return new Blob([pages.map((p, i) => `Page ${i}\n${'-'.repeat(20)}\n${p}`).join('\n\n')], { type: 'text/plain' });
    throw new Error('Unsupported conversion');
  }
  async function produceFromText(fmt, f) {
    if (fmt !== 'pdf') throw new Error('Unsupported conversion');
    return textToPdf(await f.text(), f.name);
  }
  async function produceFromHtml(fmt, f) {
    const ext = getExt(f.name);
    const html = await htmlOf(f, ext);
    if (fmt === 'txt') return new Blob([stripHtml(html)], { type: 'text/plain' });
    if (fmt === 'md') return new Blob([await toMd(html)], { type: 'text/markdown' });
    if (fmt === 'pdf') return textToPdf(stripHtml(html), f.name);
    throw new Error('Unsupported conversion');
  }
  async function produceFromXlsx(fmt, f) {
    if (fmt === 'csv') return new Blob([await xlsxText(f, true)], { type: 'text/csv' });
    if (fmt === 'txt') return new Blob([await xlsxText(f, false)], { type: 'text/plain' });
    throw new Error('Unsupported conversion');
  }
  async function produceFromPptx(fmt, f) {
    const txt = await pptxText(f);
    if (fmt === 'txt') return new Blob([txt], { type: 'text/plain' });
    if (fmt === 'md') return new Blob([txt], { type: 'text/markdown' });
    if (fmt === 'pdf') return textToPdf(txt, f.name);
    throw new Error('Unsupported conversion');
  }
  /* --- single entry point --- */
  async function produce(fmt, f) {
    const ext = getExt(f.name);
    if (RASTER.includes(ext)) return rasterTo(fmt, f);
    if (ext === 'pdf') return produceFromPdf(fmt, f);
    if (ext === 'txt' || ext === 'md') return produceFromText(fmt, f);
    if (ext === 'html' || ext === 'htm' || ext === 'docx') return produceFromHtml(fmt, f);
    if (ext === 'xlsx') return produceFromXlsx(fmt, f);
    if (ext === 'pptx') return produceFromPptx(fmt, f);
    throw new Error('Unsupported conversion');
  }
  const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', md: 'md', txt: 'txt', pdf: 'pdf', csv: 'csv' };

  async function setFile(f) {
    curr = f; sizes = {}; bmpCache = null; clearError();
    if (!f) { info.hidden = true; acts.innerHTML = ''; return; }
    const sizeErr = checkFileSize(f, MAX_CONVERT_MB);
    if (sizeErr) { showError(sizeErr); info.hidden = true; acts.innerHTML = ''; curr = null; return; }
    info.hidden = false;
    document.getElementById('cvFileName').textContent = f.name;
    document.getElementById('cvFileMeta').textContent = formatBytes(f.size);
    let ext = getExt(f.name);
    if (!targetsFor(ext).length) {
      const head = (await f.slice(0, 512).text()).trim().toLowerCase();
      if (/^<!doctype html|<html|<\?xml/.test(head)) ext = 'html';
    }
    const targets = targetsFor(ext);
    if (!targets.length) { showError('Unsupported file type' + (ext ? ` (.${ext})` : '') + '.'); acts.innerHTML = ''; return; }
    if (RASTER.includes(ext)) {
      let bmp;
      try { bmp = await getBitmap(f); }
      catch (e) { showError('Could not read this image: ' + (e.message || e)); acts.innerHTML = ''; curr = null; return; }
      const px = bmp.width * bmp.height, maxPx = MAX_RASTER_MP * 1e6;
      if (px > maxPx) {
        bmp.close(); bmpCache = null;
        showError(`Image is ${bmp.width}×${bmp.height} (${(px / 1e6).toFixed(0)} MP) — the limit for this tool is ${MAX_RASTER_MP} MP. Try a smaller or lower-resolution image.`);
        acts.innerHTML = ''; curr = null; return;
      }
    }
    acts.innerHTML = targets.map(t => `<button class="format-btn" data-fmt="${t.fmt}">${t.label}<span class="fmt-size">…</span></button>`).join('');
    targets.forEach(async t => {
      const btn = acts.querySelector(`.format-btn[data-fmt="${t.fmt}"]`); if (!btn) return;
      try {
        const blob = await produce(t.fmt, f);
        sizes[t.fmt] = blob;
        const span = btn.querySelector('.fmt-size');
        if (span) span.textContent = ' · ' + formatBytes(blob.size);
        btn.classList.remove('calcing');
      } catch (e) {
        const span = btn.querySelector('.fmt-size');
        if (span) span.textContent = ' · n/a';
        btn.disabled = true; btn.classList.add('failed');
        console.error('Preview failed for', t.fmt, e);
      }
    });
  }

  wireDropzone(document.getElementById('cvDropzone'), document.getElementById('cvFileInput'), document.getElementById('cvBrowseBtn'), files => setFile(files[0]));
  const cvMaxEl = document.getElementById('cvMaxSize');
  if (cvMaxEl) cvMaxEl.textContent = `Max file size: ${MAX_CONVERT_MB} MB`;
  document.getElementById('cvClearBtn').addEventListener('click', () => setFile(null));

  acts.addEventListener('click', async e => {
    const btn = e.target.closest('.format-btn'); if (!btn || btn.disabled || !curr) return;
    const fmt = btn.dataset.fmt, base = curr.name.replace(/\.[^.]+$/, '');
    btn.disabled = true; btn.classList.add('calcing');
    try {
      const blob = sizes[fmt] || await produce(fmt, curr);
      triggerDownload(blob, `${base}.${EXT[fmt] || fmt}`);
    } catch (er) { alert('Conversion error: ' + er.message); }
    finally { btn.disabled = false; btn.classList.remove('calcing'); }
  });
})(); } catch (e) { console.error('Convert files failed to init', e); }
