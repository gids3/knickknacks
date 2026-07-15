import { createFsTipController } from './util.js';

/* --- STOPWATCH --- */
try { (function() {
  let st=0, el=0, intv, run=false, laps=[];
  const big = document.getElementById('swBig'), bTog = document.getElementById('swToggle'), lst = document.getElementById('swLaps');
  const tabSW = document.getElementById('tab-stopwatch');
  const tipCtrl = createFsTipController(document.getElementById('swFsTip'));

  function fmt(ms) { const d=new Date(ms); return String(d.getUTCMinutes()).padStart(2,'0')+':'+String(d.getUTCSeconds()).padStart(2,'0')+'.'+String(Math.floor(d.getUTCMilliseconds()/10)).padStart(2,'0'); }
  function tk() { el = Date.now()-st; big.textContent = fmt(el); }
  bTog.addEventListener('click', () => {
    if(run) { clearInterval(intv); run=false; bTog.textContent='Resume'; tipCtrl.hide(); }
    else { st = Date.now()-el; intv=setInterval(tk, 47); run=true; bTog.textContent='Stop'; tipCtrl.show(); }
  });
  document.getElementById('swLap').addEventListener('click', () => { if(run){ laps.unshift(el); lst.innerHTML = laps.map((l,i) => `<div><span>Lap ${laps.length-i}</span><span>${fmt(l)}</span></div>`).join(''); } });
  document.getElementById('swReset').addEventListener('click', () => { clearInterval(intv); run=false; el=0; laps=[]; bTog.textContent='Start'; big.textContent='00:00.00'; lst.innerHTML=''; tipCtrl.hide(); });
  big.addEventListener('click', (e) => {
    e.stopPropagation();
    if (run) { tabSW.classList.toggle('simple-mode'); tipCtrl.hide(); }
  });
  tabSW.addEventListener('click', (e) => {
    if (tabSW.classList.contains('simple-mode') && e.target !== big && !e.target.closest('.time-controls')) {
      tabSW.classList.remove('simple-mode');
    }
  });
})(); } catch (e) { console.error('Stopwatch failed to init', e); }
