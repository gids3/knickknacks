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

  const defaultDestinations = {
      mass: { srcToDest: { pound: 'kg', ounce: 'kg', stone: 'kg' }, default: 'lb' },
      length: { srcToDest: { foot: 'm', inch: 'm', mile: 'm', yard: 'm' }, default: 'ft' },
      temp: { srcToDest: { celsius: 'f' }, default: 'c' },
      time: { srcToDest: { minute: 'h', millisecond: 'h' }, default: 'min' },
      currency: { srcToDest: { usd: 'eur' }, default: 'usd' },
      volume: { srcToDest: { gallon: 'l', cup: 'l' }, default: 'gal' },
  };
  function getDefaultDestAbbrev(srcUnitId, cat) {
      const cfg = defaultDestinations[cat];
      return cfg ? (cfg.srcToDest[srcUnitId] || cfg.default) : 'm';
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

  // fallow-ignore-next-line complexity
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
