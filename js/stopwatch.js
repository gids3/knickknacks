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
