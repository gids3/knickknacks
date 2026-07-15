import { ensureAudioContext, playBeep } from './audio.js';
import { createFsTipController } from './util.js';

/* --- TIMER --- */
try { (function() {
  let rem = 0, intv, running = false, alarmInterval = null, permissionRequested = false;
  const btn = document.getElementById('timerToggle'), tH = document.getElementById('tH'), tM = document.getElementById('tM'), tS = document.getElementById('tS');
  const tabTimer = document.getElementById('tab-timer');
  const timerInputs = document.getElementById('timerInputs');
  const timerFsBtn = document.getElementById('timerFsBtn');

  const tipCtrl = createFsTipController(document.getElementById('timerFsTip'));

  timerInputs.addEventListener('click', (e) => {
    e.stopPropagation();
    if (running) { tabTimer.classList.toggle('simple-mode'); tipCtrl.hide(); }
  });
  tabTimer.addEventListener('click', (e) => {
    if (tabTimer.classList.contains('simple-mode') && !timerInputs.contains(e.target) && !e.target.closest('.time-controls') && !e.target.closest('.controls-row')) {
      tabTimer.classList.remove('simple-mode');
    }
  });

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
          if (timerFsBtn) timerFsBtn.disabled = true;
          tipCtrl.hide();
          return; 
      } 
      rem--; 
      tH.value = String(Math.floor(rem/3600)).padStart(2,'0'); 
      tM.value = String(Math.floor((rem%3600)/60)).padStart(2,'0'); 
      tS.value = String(rem%60).padStart(2,'0');
  }

  function pauseTimer() {
      clearInterval(intv);
      btn.textContent = 'Resume';
      running = false;
      setInputsReadonly(false);
      if (timerFsBtn) timerFsBtn.disabled = true;
      tipCtrl.hide();
  }

  function resumeTimer() {
      if (rem === 0) rem = parseInt(tH.value||0)*3600 + parseInt(tM.value||0)*60 + parseInt(tS.value||0);
      if (rem <= 0) return;
      running = true;
      btn.textContent = 'Pause';
      setInputsReadonly(true);
      intv = setInterval(tk, 1000);
      if (timerFsBtn) timerFsBtn.disabled = false;
      tipCtrl.show();
  }

  function startTimer() {
      if (!permissionRequested && 'Notification' in window) { Notification.requestPermission(); permissionRequested = true; }
      ensureAudioContext();
      if (alarmInterval) { stopAlarm(); return; }
      if (running) { pauseTimer(); return; }
      resumeTimer();
  }

  btn.addEventListener('click', startTimer);
  document.getElementById('timerReset').addEventListener('click', () => { 
      clearInterval(intv); if(alarmInterval) clearInterval(alarmInterval); alarmInterval = null;
      running = false; rem = 0; btn.textContent = 'Start'; setInputsReadonly(false);
      tH.value = '00'; tM.value = '00'; tS.value = '00';
      if (timerFsBtn) timerFsBtn.disabled = true;
      tipCtrl.hide();
  });
})(); } catch (e) { console.error('Timer failed to init', e); }
