(function () {
  'use strict';
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
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
  const fileBasedTabs = ['merge', 'reorder', 'convert'];
  const validTabs = Array.from(tabButtons).map(b => b.dataset.tab);
  const DEFAULT_TAB = 'units';

  // Renders a tab as active without touching the URL — used by both the hashchange
  // listener and the initial load, so the hash is always the single source of truth.
  function activateTab(tabName, focusInput) {
    if (!validTabs.includes(tabName)) tabName = DEFAULT_TAB;
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach(p => p.hidden = p.id !== 'tab-' + tabName);
    siteNote.hidden = !fileBasedTabs.includes(tabName);
    if (tabName === DEFAULT_TAB && focusInput) document.getElementById('num-in').focus();
    return tabName;
  }

  // Clicking a tab updates the hash (bookmarkable + back/forward friendly). If the
  // hash is already correct (e.g. re-clicking the current tab), hashchange won't
  // fire on its own, so activate directly in that case. Some sandboxed embeds (e.g.
  // an about:srcdoc preview iframe) disallow URL/History changes entirely — fall
  // back to just switching the panel so the tabs still work there.
  tabButtons.forEach(btn => btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    if (location.hash.slice(1) === tabName) { activateTab(tabName, true); return; }
    try { location.hash = tabName; }
    catch (e) { activateTab(tabName, true); }
  }));

  window.addEventListener('hashchange', () => activateTab(location.hash.slice(1), true));

  // Initial route: honor whatever hash the page was loaded/bookmarked with, defaulting
  // to Units. replaceState (not setting location.hash) avoids adding an extra history
  // entry, but some sandboxed embeds throw on any History API call — ignore that safely.
  const startTab = activateTab(location.hash.slice(1), false);
  if (location.hash.slice(1) !== startTab) {
    try { history.replaceState(null, '', '#' + startTab); } catch (e) { /* URL update unavailable in this embed; tab still activated above */ }
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }
  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function getExt(filename) { return filename.toLowerCase().split('.').pop() || ''; }
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function wireDropzone(drop, input, btn, cb) {
    drop.addEventListener('click', () => input.click());
    btn.addEventListener('click', e => { e.stopPropagation(); input.click(); });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragover'); cb(e.dataTransfer.files); });
    input.addEventListener('change', e => { cb(e.target.files); input.value = ''; });
  }

  // Audio Context & Notifications for Timer/Alarm
  let audioCtx, isMuted = false;
  document.querySelectorAll('.muteToggle').forEach(btn => {
      btn.addEventListener('click', () => {
          isMuted = !isMuted;
          document.querySelectorAll('.icon-unmuted').forEach(el => el.hidden = isMuted);
          document.querySelectorAll('.icon-muted').forEach(el => el.hidden = !isMuted);
      });
  });
  
  function playBeep() {
      if (isMuted) return;
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      
      const playOsc = (freq, time, dur) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + time);
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime + time);
          osc.start(audioCtx.currentTime + time); osc.stop(audioCtx.currentTime + time + dur);
      };
      playOsc(880, 0, 0.2); playOsc(880, 0.3, 0.2); playOsc(1100, 0.6, 0.4);
  }

  // Fullscreen Logic
  document.querySelectorAll('.fs-btn').forEach(btn => btn.addEventListener('click', e => {
    const p = e.target.closest('.panel');
    if (!document.fullscreenElement) {
        p.closest('.tab-panel').requestFullscreen && p.closest('.tab-panel').requestFullscreen();
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
        } else {
            p.classList.remove('fs-active');
            if(btn) btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
        }
    });
  });

  /* --- UNITS CONVERTER --- */
  try { (function() {
    const catNames = { length: 'length', mass: 'weight', temp: 'temperature', time: 'time', currency: 'currency', volume: 'volume' };
    const unitDB = {
        meter: { cat: 'length', factor: 1, names: ['m', 'meter', 'meters', 'metre', 'metres'], display: 'meters' },
        kilometer: { cat: 'length', factor: 1000, names: ['km', 'kilometer', 'kilometers', 'k'], display: 'kilometers' },
        centimeter: { cat: 'length', factor: 0.01, names: ['cm', 'centimeter', 'centimeters'], display: 'centimeters' },
        millimeter: { cat: 'length', factor: 0.001, names: ['mm', 'millimeter', 'millimeters'], display: 'millimeters' },
        mile: { cat: 'length', factor: 1609.344, names: ['mi', 'mile', 'miles'], display: 'miles' },
        yard: { cat: 'length', factor: 0.9144, names: ['yd', 'yard', 'yards'], display: 'yards' },
        foot: { cat: 'length', factor: 0.3048, names: ['ft', 'foot', 'feet'], display: 'feet' },
        inch: { cat: 'length', factor: 0.0254, names: ['in', 'inch', 'inches'], display: 'inches' },
        lightyear: { cat: 'length', factor: 9460730472580800, names: ['ly', 'lightyear', 'lightyears', 'light year', 'light years'], display: 'lightyears' },
        gram: { cat: 'mass', factor: 1, names: ['g', 'gram', 'grams'], display: 'grams' },
        kilogram: { cat: 'mass', factor: 1000, names: ['kg', 'kilogram', 'kilograms', 'kilo', 'kilos'], display: 'kilograms' },
        pound: { cat: 'mass', factor: 453.59237, names: ['lb', 'lbs', 'pound', 'pounds'], display: 'pounds' },
        ounce: { cat: 'mass', factor: 28.34952, names: ['oz', 'ounce', 'ounces'], display: 'ounces' },
        liter: { cat: 'volume', factor: 1, names: ['l', 'liter', 'liters', 'litre', 'litres'], display: 'liters' },
        milliliter: { cat: 'volume', factor: 0.001, names: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'], display: 'milliliters' },
        gallon: { cat: 'volume', factor: 3.78541, names: ['gal', 'gallon', 'gallons'], display: 'gallons' },
        celsius: { cat: 'temp', names: ['c', 'celsius'], display: '°C' },
        fahrenheit: { cat: 'temp', names: ['f', 'fahrenheit'], display: '°F' },
        kelvin: { cat: 'temp', names: ['k', 'kelvin'], display: 'K' },
        second: { cat: 'time', factor: 1, names: ['s', 'sec', 'second', 'seconds'], display: 'seconds' },
        minute: { cat: 'time', factor: 60, names: ['min', 'minute', 'minutes'], display: 'minutes' },
        hour: { cat: 'time', factor: 3600, names: ['h', 'hr', 'hour', 'hours'], display: 'hours' },
        day: { cat: 'time', factor: 86400, names: ['d', 'day', 'days'], display: 'days' },
        usd: { cat: 'currency', factor: 1, names: ['usd', '$', 'dollar', 'dollars', 'us', 'american', 'america', 'united states'], display: 'USD' },
        eur: { cat: 'currency', factor: 1.09, names: ['eur', '€', 'euro', 'euros', 'eu', 'european', 'europe'], display: 'EUR' },
        gbp: { cat: 'currency', factor: 1.34, names: ['gbp', '£', 'pound', 'pounds', 'uk', 'british', 'britain', 'england', 'english'], display: 'GBP' }
    };

    const numIn = document.getElementById('num-in');
    const numMeasure = document.getElementById('num-measure');
    const resultDisplay = document.getElementById('result-display');
    const historyContainer = document.getElementById('history-container');

    const srcState = { input: document.getElementById('src-in'), ghost: document.getElementById('src-ghost'), measure: document.getElementById('src-measure'), query: '', matches: [], selectedIdx: 0, acceptedUnit: null };
    const destState = { input: document.getElementById('dest-in'), ghost: document.getElementById('dest-ghost'), measure: document.getElementById('dest-measure'), query: '', matches: [], selectedIdx: 0, acceptedUnit: null };

    updateMeasure(numIn, numMeasure, null); updateUI(srcState); updateUI(destState);

    function findMatches(query) {
        if (!query) return [];
        let results = [];
        for (const [unitId, data] of Object.entries(unitDB)) {
            for (const name of data.names) if (name.startsWith(query.toLowerCase())) results.push({ unitId, matchStr: name, cat: data.cat });
        }
        return results.sort((a, b) => (a.matchStr.length - b.matchStr.length) || a.matchStr.localeCompare(b.matchStr));
    }

    function updateMeasure(inputEl, measureEl, fullText) { measureEl.textContent = fullText || inputEl.value || (inputEl.id === 'num-in' ? '0' : 'unit'); }

    function updateUI(state) {
        let typed = state.query || '', remainder = '', placeholderText = 'unit'; 
        if (state.matches.length > 0 && typed) { remainder = state.matches[state.selectedIdx].matchStr.substring(typed.length); } 
        else if (!typed && state === destState && srcState.acceptedUnit) { remainder = getDefaultDestAbbrev(srcState.acceptedUnit, unitDB[srcState.acceptedUnit].cat); }
        state.ghost.innerHTML = (!typed && !remainder) ? `<span style="color: var(--border)">${placeholderText}</span>` : `<span style="color: var(--text)">${typed}</span><span style="color: var(--ghost)">${remainder}</span>`;
        updateMeasure(state.input, state.measure, (typed + remainder) || placeholderText);
    }

    function acceptCompletion(state, autoAdvanceTo) {
        let accepted = null;
        if (state.matches.length > 0) { accepted = state.matches[state.selectedIdx]; state.acceptedUnit = accepted.unitId; state.input.value = accepted.matchStr; state.query = accepted.matchStr; } 
        else if (state === destState && !state.query && srcState.acceptedUnit) {
            const matches = findMatches(getDefaultDestAbbrev(srcState.acceptedUnit, unitDB[srcState.acceptedUnit].cat));
            if (matches.length > 0) { accepted = matches[0]; state.acceptedUnit = accepted.unitId; state.input.value = accepted.matchStr; state.query = accepted.matchStr; }
        } else if (state.acceptedUnit) { accepted = { unitId: state.acceptedUnit, cat: unitDB[state.acceptedUnit].cat }; }
        state.matches = []; updateUI(state); if (autoAdvanceTo) autoAdvanceTo.focus();
        return accepted;
    }

    function getDefaultDestAbbrev(srcUnitId, cat) {
        if (cat === 'mass') return (srcUnitId === 'pound' || srcUnitId === 'ounce' || srcUnitId === 'stone') ? 'kg' : 'lb';
        if (cat === 'length') return (srcUnitId === 'foot' || srcUnitId === 'inch' || srcUnitId === 'mile' || srcUnitId === 'yard') ? 'm' : 'ft';
        if (cat === 'temp') return srcUnitId === 'celsius' ? 'f' : 'c';
        if (cat === 'time') return (srcUnitId === 'minute' || srcUnitId === 'millisecond') ? 'h' : 'min';
        if (cat === 'currency') return srcUnitId === 'usd' ? 'eur' : 'usd';
        if (cat === 'volume') return (srcUnitId === 'gallon' || srcUnitId === 'cup') ? 'l' : 'gal';
        return 'm';
    }

    function handleUnitInputEvent(e, state) {
        let val = state.input.value;
        if (state === srcState) {
            const lowerVal = val.toLowerCase();
            if (lowerVal.endsWith('to') || lowerVal.endsWith(' to')) {
                const prefix = val.slice(0, -(lowerVal.endsWith(' to') ? 3 : 2)).trim();
                if (prefix.length > 0 && findMatches(prefix).length > 0) {
                    state.input.value = prefix; state.query = prefix; state.matches = findMatches(prefix); state.selectedIdx = 0; 
                    const accepted = acceptCompletion(state, destState.input);
                    if (accepted) { if (destState.acceptedUnit && unitDB[destState.acceptedUnit].cat !== accepted.cat) { destState.input.value = ''; destState.query = ''; destState.acceptedUnit = null; } }
                    calculate(); return; 
                }
            }
        }
        state.query = val; state.acceptedUnit = null; state.matches = findMatches(state.query); state.selectedIdx = 0; updateUI(state); calculate();
    }

    function handleUnitKeydown(e, state, nextEl, prevEl, isDest) {
        if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') {
            if (isDest && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); acceptCompletion(state, nextEl); calculate(); commitToHistory(); return; }
            e.preventDefault(); const accepted = acceptCompletion(state, nextEl);
            if (!isDest && accepted) { if (destState.acceptedUnit && unitDB[destState.acceptedUnit].cat !== accepted.cat) { destState.input.value = ''; destState.query = ''; destState.acceptedUnit = null; } }
            calculate();
        } else if (e.key === 'ArrowDown') { e.preventDefault(); if (state.matches.length > 0) { state.selectedIdx = (state.selectedIdx + 1) % state.matches.length; updateUI(state); calculate(); }
        } else if (e.key === 'ArrowUp') { e.preventDefault(); if (state.matches.length > 0) { state.selectedIdx = (state.selectedIdx - 1 + state.matches.length) % state.matches.length; updateUI(state); calculate(); }
        } else if (e.key === 'Backspace' && state.input.value === '') { e.preventDefault(); if (prevEl) prevEl.focus(); }
    }

    function doMath(val, srcUnitId, destUnitId) {
        const src = unitDB[srcUnitId], dest = unitDB[destUnitId];
        if (src.cat === 'temp') {
            let c = val;
            if (srcUnitId === 'fahrenheit') c = (val - 32) * 5/9; else if (srcUnitId === 'kelvin') c = val - 273.15;
            if (destUnitId === 'celsius') return c; if (destUnitId === 'fahrenheit') return (c * 9/5) + 32; if (destUnitId === 'kelvin') return c + 273.15;
        } 
        return val * (src.factor / dest.factor);
    }

    function calculate() {
        resultDisplay.classList.remove('error', 'preview', 'show', 'bounce');
        const val = parseFloat(numIn.value);
        let srcUnitId = srcState.acceptedUnit; if (!srcUnitId && srcState.matches.length > 0) srcUnitId = srcState.matches[srcState.selectedIdx].unitId;
        if (isNaN(val) || !srcUnitId) return;
        let destUnitId = destState.acceptedUnit, isPreview = (!srcState.acceptedUnit || !destState.acceptedUnit);
        if (!destUnitId) {
            if (destState.matches.length > 0) { destUnitId = destState.matches[destState.selectedIdx].unitId; isPreview = true; } 
            else if (destState.query === '') { destUnitId = findMatches(getDefaultDestAbbrev(srcUnitId, unitDB[srcUnitId].cat))[0]?.unitId; isPreview = true; } 
            else return; 
        }
        if (!destUnitId || unitDB[srcUnitId].cat !== unitDB[destUnitId].cat) return;
        const outVal = doMath(val, srcUnitId, destUnitId), formatted = (outVal < 0.000001 || outVal > 999999999) ? outVal.toExponential(4) : parseFloat(outVal.toPrecision(8)).toString();
        resultDisplay.textContent = `${formatted} ${unitDB[destUnitId].display}`;
        if (isPreview) resultDisplay.classList.add('preview'); resultDisplay.classList.add('show');
    }

    function commitToHistory() {
        const val = parseFloat(numIn.value);
        if (isNaN(val) || !srcState.acceptedUnit || !destState.acceptedUnit) return;
        const src = unitDB[srcState.acceptedUnit], dest = unitDB[destState.acceptedUnit];
        if (src.cat !== dest.cat) { resultDisplay.classList.remove('preview'); resultDisplay.textContent = `Hmm, mismatched categories.`; resultDisplay.classList.add('error', 'show', 'bounce'); return; }
        const outVal = doMath(val, srcState.acceptedUnit, destState.acceptedUnit), formatted = (outVal < 0.000001 || outVal > 999999999) ? outVal.toExponential(4) : parseFloat(outVal.toPrecision(8)).toString();
        const item = document.createElement('div'); item.className = 'history-item';
        item.innerHTML = `<span class="src-part">${numIn.value} ${srcState.input.value}</span><span class="equals">=</span><span class="dest-part">${formatted} ${destState.input.value}</span>`;
        historyContainer.prepend(item);
        numIn.value = ''; srcState.input.value = ''; destState.input.value = ''; srcState.query = ''; destState.query = ''; srcState.acceptedUnit = null; destState.acceptedUnit = null;
        updateUI(srcState); updateUI(destState); updateMeasure(numIn, numMeasure, null); numIn.focus();
        resultDisplay.classList.remove('preview'); resultDisplay.classList.add('bounce'); setTimeout(() => { resultDisplay.classList.remove('bounce'); calculate(); }, 400);
    }

    numIn.addEventListener('input', () => {
        let match = numIn.value.match(/^([-0-9.]+)([a-zA-Z$€£¥₹]+)$/);
        if (match) { numIn.value = match[1]; srcState.input.value = match[2]; srcState.query = match[2]; srcState.matches = findMatches(srcState.query); srcState.input.focus(); updateUI(srcState); }
        updateMeasure(numIn, numMeasure, null); calculate();
    });
    numIn.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (numIn.value) srcState.input.focus(); } });
    srcState.input.addEventListener('input', (e) => handleUnitInputEvent(e, srcState));
    srcState.input.addEventListener('keydown', (e) => handleUnitKeydown(e, srcState, destState.input, numIn, false));
    destState.input.addEventListener('input', (e) => handleUnitInputEvent(e, destState));
    destState.input.addEventListener('keydown', (e) => handleUnitKeydown(e, destState, null, srcState.input, true));
  })(); } catch (e) { console.error('Units converter failed to init', e); }


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

  /* --- CONVERT FILES --- */
  try { (function() {
    let curr = null; const info = document.getElementById('cvFileInfo'), acts = document.getElementById('cvActions'), err = document.getElementById('cvError');
    const IMGS = ['png','jpg','jpeg','webp','bmp','svg','heic','heif','gif'], DOCS = ['pdf','txt','md'];
    function setFile(f) {
      curr = f; if(!f) { info.hidden = true; acts.innerHTML = ''; err.hidden = true; return; }
      info.hidden = false; document.getElementById('cvFileName').textContent = f.name; document.getElementById('cvFileMeta').textContent = formatBytes(f.size);
      const ext = getExt(f.name);
      if (IMGS.includes(ext)) acts.innerHTML = `<button class="format-btn" data-fmt="png">PNG</button><button class="format-btn" data-fmt="jpeg">JPEG</button><button class="format-btn" data-fmt="webp">WEBP</button><button class="format-btn blurred" disabled>GIF</button><button class="format-btn blurred" disabled>HEIC</button>`;
      else if (DOCS.includes(ext)) acts.innerHTML = ext === 'pdf' ? `<button class="format-btn" data-fmt="md">MD</button><button class="format-btn" data-fmt="txt">TXT</button>` : `<button class="format-btn" data-fmt="pdf">PDF</button>`;
      else { err.hidden = false; err.textContent = "Unsupported file type."; }
    }
    wireDropzone(document.getElementById('cvDropzone'), document.getElementById('cvFileInput'), document.getElementById('cvBrowseBtn'), files => setFile(files[0]));
    document.getElementById('cvClearBtn').addEventListener('click', () => setFile(null));
    acts.addEventListener('click', async e => {
      const btn = e.target.closest('.format-btn'); if(!btn || btn.disabled || !curr) return;
      const fmt = btn.dataset.fmt, base = curr.name.replace(/\.[^.]+$/, ''), orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
      try {
        if (['png','jpeg','webp'].includes(fmt)) {
          let b = curr; if (['heic','heif'].includes(getExt(curr.name))) b = [].concat(await heic2any({ blob: curr, toType: 'image/png' }))[0];
          const img = await createImageBitmap(b), c = document.createElement('canvas'), ctx = c.getContext('2d');
          c.width = img.width; c.height = img.height; if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height); }
          ctx.drawImage(img, 0, 0); img.close();
          triggerDownload(await new Promise(r => c.toBlob(r, `image/${fmt}`, 0.92)), `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`);
        } else if (['md','txt'].includes(fmt)) {
          if (typeof pdfjsLib === 'undefined') throw new Error('PDF library failed to load. Check your connection and try again.');
          const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await curr.arrayBuffer()) }).promise, pages = [];
          for (let i=1; i<=doc.numPages; i++) {
            let pTxt = ''; (await (await doc.getPage(i)).getTextContent()).items.forEach(it => pTxt += (pTxt && !pTxt.endsWith(' ') ? ' ' : '') + it.str);
            pages.push(fmt === 'md' ? `## Page ${i}\n\n${pTxt}` : `Page ${i}\n${'-'.repeat(20)}\n${pTxt}`);
          }
          triggerDownload(new Blob([pages.join('\n\n')], { type: 'text/plain' }), `${base}.${fmt}`);
        } else if (fmt === 'pdf') {
          const txt = await curr.text();
          const outDoc = await PDFLib.PDFDocument.create();
          const page = outDoc.addPage();
          const font = await outDoc.embedFont(PDFLib.StandardFonts.Helvetica);
          page.drawText(txt, { x: 40, y: page.getHeight() - 40, size: 12, font: font, maxWidth: page.getWidth() - 80, lineHeight: 16 });
          triggerDownload(new Blob([await outDoc.save()], { type: 'application/pdf' }), `${base}.pdf`);
        }
      } catch(er) { alert('Conversion error: ' + er.message); } finally { btn.disabled = false; btn.textContent = orig; }
    });
  })(); } catch (e) { console.error('Convert files failed to init', e); }

  /* --- CLOCK --- */
  try { (function() {
    const big = document.getElementById('clockBig');
    const zoneEl = document.getElementById('clockZone');
    const worldEl = document.getElementById('clockWorld');
    const tabClock = document.getElementById('tab-clock');
    const z = [{l:'New York',t:'America/New_York'},{l:'London',t:'Europe/London'},{l:'Delhi',t:'Asia/Kolkata'},{l:'Tokyo',t:'Asia/Tokyo'}];

    let localZoneLabel = '';
    try { localZoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' '); } catch(e){}

    let enlarged = null; // null = showing local time big; otherwise a zone object from z

    function tk() {
      const d = new Date();

      if (enlarged) {
        const parts = d.toLocaleTimeString('en-US', {timeZone: enlarged.t, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true}).split(' ');
        big.innerHTML = parts[0] + '<span class="ampm">' + (parts[1]||'') + '</span>';
        zoneEl.textContent = enlarged.l;
      } else {
        const h = d.getHours();
        big.innerHTML = String(h%12||12).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0')+'<span class="ampm">'+(h>=12?'PM':'AM')+'</span>';
        zoneEl.textContent = localZoneLabel;
      }

      document.getElementById('clockDate').textContent = d.toLocaleDateString('en-US', {weekday:'long',month:'long',day:'numeric',year:'numeric'});
      worldEl.innerHTML = z.map((x,i) => `<div class="world-chip" data-idx="${i}" title="Click to enlarge"><span class="world-time">${d.toLocaleTimeString('en-US',{timeZone:x.t,hour:'2-digit',minute:'2-digit',hour12:true})}</span><span class="world-label">${x.l}</span></div>`).join('');
    }
    tk(); setInterval(tk, 1000);

    big.addEventListener('click', () => {
      if (tabClock.classList.contains('simple-mode')) {
        tabClock.classList.remove('simple-mode');
      } else {
        tabClock.classList.add('simple-mode');
      }
      enlarged = null;
      tk();
    });

    worldEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.world-chip');
      if (!chip) return;
      enlarged = z[parseInt(chip.dataset.idx, 10)];
      tabClock.classList.add('simple-mode');
      tk();
    });
  })(); } catch (e) { console.error('Clock failed to init', e); }

  /* --- TIMER --- */
  try { (function() {
    let rem = 0, intv, running = false, alarmInterval = null, permissionRequested = false;
    const btn = document.getElementById('timerToggle'), tH = document.getElementById('tH'), tM = document.getElementById('tM'), tS = document.getElementById('tS');

    [tH, tM, tS].forEach(inp => {
        inp.addEventListener('blur', () => { if(!inp.value) inp.value = '00'; else inp.value = String(parseInt(inp.value)).padStart(2, '0'); });
        inp.addEventListener('input', () => { if(inp.value.length > 2) inp.value = inp.value.slice(-2); });
        inp.addEventListener('keydown', e => { if(e.key === 'Enter') startTimer(); });
    });

    function setInputsReadonly(isRO) { tH.disabled = isRO; tM.disabled = isRO; tS.disabled = isRO; }
    
    function stopAlarm() {
        clearInterval(alarmInterval); alarmInterval = null; btn.textContent = 'Start'; running = false;
        tH.value = '00'; tM.value = '00'; tS.value = '00';
    }

    function tk() { 
        if(rem <= 0) { 
            clearInterval(intv); setInputsReadonly(false);
            btn.textContent = 'Stop Alarm'; 
            tH.value = '00'; tM.value = '00'; tS.value = '00';
            playBeep(); alarmInterval = setInterval(playBeep, 1200);
            if ('Notification' in window && Notification.permission === 'granted') new Notification("Timer finished!");
            return; 
        } 
        rem--; 
        tH.value = String(Math.floor(rem/3600)).padStart(2,'0'); 
        tM.value = String(Math.floor((rem%3600)/60)).padStart(2,'0'); 
        tS.value = String(rem%60).padStart(2,'0');
    }

    function startTimer() {
        if (!permissionRequested && 'Notification' in window) { Notification.requestPermission(); permissionRequested = true; }
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        if (alarmInterval) { stopAlarm(); return; }

        if(running) { 
            clearInterval(intv); btn.textContent = 'Resume'; running = false; setInputsReadonly(false);
        } else {
            if(rem === 0) rem = parseInt(tH.value||0)*3600 + parseInt(tM.value||0)*60 + parseInt(tS.value||0);
            if(rem > 0) { 
                running = true; btn.textContent = 'Pause'; setInputsReadonly(true);
                intv = setInterval(tk, 1000); 
            }
        }
    }

    btn.addEventListener('click', startTimer);
    document.getElementById('timerReset').addEventListener('click', () => { 
        clearInterval(intv); if(alarmInterval) clearInterval(alarmInterval); alarmInterval = null;
        running = false; rem = 0; btn.textContent = 'Start'; setInputsReadonly(false);
        tH.value = '00'; tM.value = '00'; tS.value = '00';
    });
  })(); } catch (e) { console.error('Timer failed to init', e); }

  /* --- ALARM --- */
  try { (function() {
      const h = document.getElementById('aH'), m = document.getElementById('aM'), ampm = document.getElementById('aAmPm'), btn = document.getElementById('alarmToggle');
      let intv, active = false, ringing = false, ringIntv, permissionRequested = false;

      [h, m].forEach(inp => {
          inp.addEventListener('blur', () => { if(!inp.value) inp.value = '00'; else inp.value = String(parseInt(inp.value)).padStart(2, '0'); });
          inp.addEventListener('input', () => { if(inp.value.length > 2) inp.value = inp.value.slice(-2); });
      });

      function setInputsReadonly(isRO) { h.disabled = isRO; m.disabled = isRO; ampm.disabled = isRO; }

      function checkAlarm() {
          const now = new Date();
          let targetH = parseInt(h.value) % 12; if (ampm.value === 'PM') targetH += 12;
          if (now.getHours() === targetH && now.getMinutes() === parseInt(m.value) && now.getSeconds() === 0) {
              clearInterval(intv); ringing = true; btn.textContent = 'Stop Alarm';
              playBeep(); ringIntv = setInterval(playBeep, 1200);
              if ('Notification' in window && Notification.permission === 'granted') new Notification("Alarm Ringing!");
          }
      }

      btn.addEventListener('click', () => {
          if (!permissionRequested && 'Notification' in window) { Notification.requestPermission(); permissionRequested = true; }
          if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx.state === 'suspended') audioCtx.resume();

          if (ringing) {
              clearInterval(ringIntv); ringing = false; active = false;
              btn.textContent = 'Set Alarm'; setInputsReadonly(false);
          } else if (active) {
              clearInterval(intv); active = false;
              btn.textContent = 'Set Alarm'; setInputsReadonly(false);
          } else {
              active = true; btn.textContent = 'Cancel Alarm'; setInputsReadonly(true);
              intv = setInterval(checkAlarm, 1000);
          }
      });
  })(); } catch (e) { console.error('Alarm failed to init', e); }

  /* --- STOPWATCH --- */
  try { (function() {
    let st=0, el=0, intv, run=false, laps=[];
    const big = document.getElementById('swBig'), bTog = document.getElementById('swToggle'), lst = document.getElementById('swLaps');
    function fmt(ms) { const d=new Date(ms); return String(d.getUTCMinutes()).padStart(2,'0')+':'+String(d.getUTCSeconds()).padStart(2,'0')+'.'+String(Math.floor(d.getUTCMilliseconds()/10)).padStart(2,'0'); }
    function tk() { el = Date.now()-st; big.textContent = fmt(el); }
    bTog.addEventListener('click', () => {
      if(run) { clearInterval(intv); run=false; bTog.textContent='Resume'; }
      else { st = Date.now()-el; intv=setInterval(tk, 47); run=true; bTog.textContent='Stop'; }
    });
    document.getElementById('swLap').addEventListener('click', () => { if(run){ laps.unshift(el); lst.innerHTML = laps.map((l,i) => `<div><span>Lap ${laps.length-i}</span><span>${fmt(l)}</span></div>`).join(''); } });
    document.getElementById('swReset').addEventListener('click', () => { clearInterval(intv); run=false; el=0; laps=[]; bTog.textContent='Start'; big.textContent='00:00.00'; lst.innerHTML=''; });
    big.addEventListener('click', () => document.getElementById('tab-stopwatch').classList.toggle('simple-mode'));
  })(); } catch (e) { console.error('Stopwatch failed to init', e); }

})();

(async function () {
  'use strict';
  const { default: SpeedTest } = await import('https://cdn.jsdelivr.net/npm/@cloudflare/speedtest/+esm');

  const path = document.getElementById('speedGaugePath'),
        pEl = document.getElementById('speedPing'),
        dEl = document.getElementById('speedDown'),
        uEl = document.getElementById('speedUp'),
        speedPhase = document.getElementById('speedPhase'),
        progCont = document.getElementById('speedProgressCont'),
        progFill = document.getElementById('speedProgress'),
        runBtn = document.getElementById('speedRunBtn'),
        noteEl = document.getElementById('speedNote');

  // Arc gauge fill state
  let gTarg = 0, gCur = 0, gVel = 0;
  // Smoothed on-screen numbers, so incoming samples ease in instead of jumping/flashing
  let downTarg = 0, downCur = 0, downVel = 0;
  let upTarg = 0, upCur = 0, upVel = 0;
  let finished = true; // true whenever no test is actively running

  function ease(cur, targ, vel) {
    vel = (vel + (targ - cur) * 0.14) * 0.72;
    return [cur + vel, vel];
  }

  function anim() {
    [gCur, gVel] = ease(gCur, gTarg, gVel);
    const max = Math.max(10, gTarg * 1.2), pct = Math.max(0, Math.min(1, gCur / max));
    path.style.strokeDashoffset = 235.6 * (1 - (isNaN(pct) ? 0 : pct));

    if (!finished) {
      [downCur, downVel] = ease(downCur, downTarg, downVel);
      [upCur, upVel] = ease(upCur, upTarg, upVel);
      dEl.textContent = (downTarg > 0.05 || downCur > 0.05) ? Math.max(0, downCur).toFixed(1) : '—';
      uEl.textContent = (upTarg > 0.05 || upCur > 0.05) ? Math.max(0, upCur).toFixed(1) : '—';
    }
    requestAnimationFrame(anim);
  }
  requestAnimationFrame(anim);

  function resetDisplay() {
    gTarg = gCur = gVel = 0;
    downTarg = downCur = downVel = 0;
    upTarg = upCur = upVel = 0;
    pEl.textContent = '—'; dEl.textContent = '—'; uEl.textContent = '—';
  }

  function setFinal(download, upload, latency) {
    downTarg = downCur = download;
    upTarg = upCur = upload;
    gTarg = gCur = Math.max(download, upload);
    dEl.textContent = download.toFixed(1);
    uEl.textContent = isNaN(upload) ? 'N/A' : upload.toFixed(1);
    pEl.textContent = Math.round(latency) + ' ms';
  }

  async function fallbackSpeedTest(btnEl, pIntv) {
    pEl.textContent = '...';
    try {
      let t0 = performance.now();
      await fetch('https://cloudflare.com/cdn-cgi/trace', { mode: 'no-cors', cache: 'no-store' });
      let ping = performance.now() - t0; pEl.textContent = Math.round(ping) + ' ms';
      speedPhase.textContent = 'Testing Download...';
      t0 = performance.now();
      const resp = await fetch('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js?_cb=' + Date.now());
      const blob = await resp.blob();
      let mbps = (blob.size * 8 / 1000000) / ((performance.now() - t0) / 1000);

      // Rough upload estimate: time a same-size POST back to a CORS-friendly echo
      // endpoint. If that's blocked too (common in sandboxed embeds), fall back to
      // labeling it unavailable rather than showing a bare, unexplained "N/A".
      let upMbps = NaN;
      try {
        const payload = new Blob([new Uint8Array(2_000_000)]);
        const tUp0 = performance.now();
        await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body: payload, cache: 'no-store' });
        upMbps = (payload.size * 8 / 1000000) / ((performance.now() - tUp0) / 1000);
      } catch (upErr) { /* leave upMbps as NaN — reported as unavailable below */ }

      finished = true;
      clearInterval(pIntv);
      downTarg = downCur = mbps; gTarg = gCur = mbps;
      dEl.textContent = mbps.toFixed(1);
      if (!isNaN(upMbps) && upMbps > 0) { uEl.textContent = upMbps.toFixed(1); upTarg = upCur = upMbps; }
      else { uEl.textContent = 'N/A'; noteEl.hidden = false; noteEl.textContent = 'Limited test — upload speed isn\u2019t measurable in this environment.'; }
      progFill.style.width = '100%'; speedPhase.textContent = 'Test Complete';
    } catch(e) {
      finished = true;
      clearInterval(pIntv);
      noteEl.hidden = false; noteEl.textContent = 'Test unavailable. Check network restrictions.';
      progCont.style.display = 'none'; speedPhase.textContent = 'Ready to test';
    }
    btnEl.disabled = false; btnEl.textContent = 'Run again';
  }

  runBtn.addEventListener('click', function() {
    this.disabled = true; this.textContent = 'Testing…';
    finished = false;
    resetDisplay();
    noteEl.hidden = true;
    speedPhase.textContent = 'Testing Ping...';

    progCont.style.display = 'block'; progFill.style.width = '0%';
    let fakeProgress = 0;
    // Cap the fake progress short of 100% — only a real completion should fill the bar all the way,
    // so the bar and the "Test Complete" label always agree.
    const pIntv = setInterval(() => { fakeProgress += 1; progFill.style.width = Math.min(96, (fakeProgress / 220) * 100) + '%'; }, 100);

    try {
      const test = new SpeedTest();
      test.onResultsChange = () => {
          if (finished) return; // ignore any late events that arrive after we've already finalized
          const s = test.results.getSummary();
          if (s.latency) pEl.textContent = Math.round(s.latency) + ' ms';
          if (s.upload && s.upload > 0) {
              speedPhase.textContent = 'Testing Upload...';
              upTarg = s.upload / 1e6; downTarg = s.download / 1e6; gTarg = upTarg;
          } else if (s.download && s.download > 0) {
              speedPhase.textContent = 'Testing Download...';
              downTarg = s.download / 1e6; gTarg = downTarg;
          } else {
              speedPhase.textContent = 'Testing Ping...';
          }
      };
      test.onFinish = () => {
          const s = test.results.getSummary();
          // Guard against a premature/partial finish event — only declare completion once every metric is in.
          if (s.download == null || s.upload == null || s.latency == null) return;
          finished = true;
          clearInterval(pIntv);
          progFill.style.width = '100%';
          speedPhase.textContent = 'Test Complete';
          setFinal(s.download / 1e6, s.upload / 1e6, s.latency);
          this.disabled = false; this.textContent = 'Run again';
      };
      test.onError = () => fallbackSpeedTest(this, pIntv);
    } catch (e) { fallbackSpeedTest(this, pIntv); }
  });
})();
