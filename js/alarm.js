import { ensureAudioContext, playBeep } from './audio.js';
import { createFsTipController } from './util.js';

/* --- ALARM --- */
try { (function() {
    const h = document.getElementById('aH'), m = document.getElementById('aM'), ampm = document.getElementById('aAmPm'), btn = document.getElementById('alarmToggle');
    let intv, active = false, ringing = false, ringIntv, permissionRequested = false;
    const tabAlarm = document.getElementById('tab-alarm');
    const alarmInputs = document.getElementById('alarmInputs');

    const tipCtrl = createFsTipController(document.getElementById('alarmFsTip'));

    alarmInputs.addEventListener('click', (e) => {
        e.stopPropagation();
        if (active) { tabAlarm.classList.toggle('simple-mode'); tipCtrl.hide(); }
    });
    tabAlarm.addEventListener('click', (e) => {
        if (tabAlarm.classList.contains('simple-mode') && !alarmInputs.contains(e.target) && !e.target.closest('.time-controls') && !e.target.closest('.controls-row')) {
            tabAlarm.classList.remove('simple-mode');
        }
    });

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
        ensureAudioContext();

        if (ringing) {
            clearInterval(ringIntv); ringing = false; active = false;
            btn.textContent = 'Set Alarm'; setInputsReadonly(false);
            tipCtrl.hide();
        } else if (active) {
            clearInterval(intv); active = false;
            btn.textContent = 'Set Alarm'; setInputsReadonly(false);
            tipCtrl.hide();
        } else {
            active = true; btn.textContent = 'Cancel Alarm'; setInputsReadonly(true);
            intv = setInterval(checkAlarm, 1000);
            tipCtrl.show();
        }
    });
})(); } catch (e) { console.error('Alarm failed to init', e); }
