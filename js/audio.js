// Audio Context & Notifications for Timer/Alarm
let audioCtx, isMuted = false;
document.querySelectorAll('.muteToggle').forEach(btn => {
    btn.addEventListener('click', () => {
        isMuted = !isMuted;
        document.querySelectorAll('.muteToggle').forEach(b => b.classList.toggle('muted', isMuted));
        document.querySelectorAll('.icon-unmuted').forEach(el => el.hidden = isMuted);
        document.querySelectorAll('.icon-muted').forEach(el => el.hidden = !isMuted);
    });
});

export function ensureAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

export function playBeep() {
    if (isMuted) return;
    const ctx = ensureAudioContext();

    const playOsc = (freq, time, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + time);
        osc.start(ctx.currentTime + time); osc.stop(ctx.currentTime + time + dur);
    };
    playOsc(880, 0, 0.2); playOsc(880, 0.3, 0.2); playOsc(1100, 0.6, 0.4);
}
