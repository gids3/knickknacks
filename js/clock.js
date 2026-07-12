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

  big.addEventListener('click', (e) => {
    e.stopPropagation();
    if (tabClock.classList.contains('simple-mode')) {
      tabClock.classList.remove('simple-mode');
    } else {
      tabClock.classList.add('simple-mode');
    }
    enlarged = null;
    tk();
  });

  tabClock.addEventListener('click', (e) => {
    if (tabClock.classList.contains('simple-mode') && e.target !== big && !e.target.closest('.world-chip') && !e.target.closest('.time-controls')) {
      tabClock.classList.remove('simple-mode');
      enlarged = null;
      tk();
    }
  });

  worldEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.world-chip');
    if (!chip) return;
    enlarged = z[parseInt(chip.dataset.idx, 10)];
    tabClock.classList.add('simple-mode');
    tk();
  });
})(); } catch (e) { console.error('Clock failed to init', e); }
