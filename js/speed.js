(async function () {
  const { default: SpeedTest } = await import('https://cdn.jsdelivr.net/npm/@cloudflare/speedtest/+esm');

  const canvas = document.getElementById('speedCanvas');
  const ctx = canvas.getContext('2d');
  const pEl = document.getElementById('speedPing');
  const dEl = document.getElementById('speedDown');
  const uEl = document.getElementById('speedUp');
  const speedPhase = document.getElementById('speedPhase');
  const runBtn = document.getElementById('speedRunBtn');
  const noteEl = document.getElementById('speedNote');

  const COL_DOWN = '#2374AB', COL_UP = '#2AA67A', COL_PING = '#D98E32';
  pEl.style.color = COL_PING;
  dEl.style.color = COL_DOWN;
  uEl.style.color = COL_UP;
  const PHASE_DURATION_MS = 10000; // fixed duration for both download and upload
  let colBorder, colMuted;
  function cacheColors() {
    const s = getComputedStyle(document.documentElement);
    colBorder = s.getPropertyValue('--border').trim();
    colMuted = s.getPropertyValue('--muted').trim();
  }
  cacheColors();
  new MutationObserver(cacheColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  let downData = [], upData = [];
  let testStart = 0, upStart = 0;
  let downTarg = 0, downCur = 0, downVel = 0;
  let upTarg = 0, upCur = 0, upVel = 0;
  let testRunning = false;
  let finishing = false;
  let phase = 'ping';
  let cachedSize = null;

  function ease(cur, targ, vel) {
    vel = (vel + (targ - cur) * 0.14) * 0.72;
    return [cur + vel, vel];
  }

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    if (cachedSize && cachedSize.w === rect.width && cachedSize.h === rect.height) return cachedSize;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cachedSize = { w: rect.width, h: rect.height };
    return cachedSize;
  }

  // fallow-ignore-next-line complexity
  function niceStep(range, target) {
    if (range <= 0) return 1;
    const rough = range / target;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const n = rough / mag;
    return (n <= 1.5 ? 1 : n <= 3 ? 2 : n <= 7 ? 5 : 10) * mag;
  }

  function draw() {
    const sz = sizeCanvas();
    if (!sz) return;
    const { w, h } = sz;
    const pad = { top: 12, right: 16, bottom: 28, left: 46 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, h);

    // Fixed 10s axis: both phases are time-boxed to PHASE_DURATION_MS,
    // so download and upload always plot over the same 0-10s range and
    // their lines end together on the right edge.
    const maxT = 10;

    let maxSpeed = 10;
    for (const p of downData) if (p.v > maxSpeed) maxSpeed = p.v;
    for (const p of upData) if (p.v > maxSpeed) maxSpeed = p.v;
    maxSpeed = Math.max(maxSpeed * 1.2, 10);

    const yStep = niceStep(maxSpeed, 4);
    const xStep = niceStep(maxT, 5);

    ctx.font = '11px "Pliant", sans-serif';
    ctx.fillStyle = colMuted;

    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= maxSpeed; v += yStep) {
      const y = pad.top + ph - (v / maxSpeed) * ph;
      ctx.strokeStyle = colBorder; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pw, y); ctx.stroke();
      ctx.fillText(v === Math.round(v) ? '' + v : v.toFixed(1), pad.left - 6, y);
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let t = 0; t <= maxT; t += xStep) {
      const x = pad.left + (t / maxT) * pw;
      ctx.strokeStyle = colBorder; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + ph); ctx.stroke();
      ctx.fillText(t + 's', x, pad.top + ph + 6);
    }

    function plotLine(data, color) {
      if (data.length === 0) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = pad.left + (data[i].t / maxT) * pw;
        const y = pad.top + ph - (data[i].v / maxSpeed) * ph;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      const last = data[data.length - 1];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pad.left + (last.t / maxT) * pw, pad.top + ph - (last.v / maxSpeed) * ph, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    plotLine(downData, COL_DOWN);
    plotLine(upData, COL_UP);
  }

  function tick() {
    if (!testRunning) return;

    [downCur, downVel] = ease(downCur, downTarg, downVel);
    [upCur, upVel] = ease(upCur, upTarg, upVel);

    // Clamped to 10s so both phases share the same x-range and end together.
    const t = Math.min((performance.now() - testStart) / 1000, 10);
    const upT = upStart ? Math.min((performance.now() - upStart) / 1000, 10) : 0;

    if (finishing) {
      upData.push({ t: upT, v: Math.max(0, upCur) });
    } else if (phase === 'down') {
      downData.push({ t, v: Math.max(0, downCur) });
    } else if (phase === 'up') {
      upData.push({ t: upT, v: Math.max(0, upCur) });
    }

    dEl.textContent = (downCur > 0.05 || downTarg > 0.05) ? Math.max(0, downCur).toFixed(1) + ' Mbps' : '\u2014';
    uEl.textContent = (upCur > 0.05 || upTarg > 0.05) ? Math.max(0, upCur).toFixed(1) + ' Mbps' : '\u2014';

    draw();

    if (finishing) {
      const dClose = Math.abs(downCur - downTarg) < 0.2;
      const uClose = upTarg <= 0 || Math.abs(upCur - upTarg) < 0.2;
      if (dClose && uClose) {
        downCur = downTarg; upCur = upTarg;
        dEl.textContent = downTarg > 0 ? downTarg.toFixed(1) + ' Mbps' : '\u2014';
        uEl.textContent = upTarg > 0 ? upTarg.toFixed(1) + ' Mbps' : '\u2014';
        testRunning = false; finishing = false;
        speedPhase.textContent = 'Test Complete';
        runBtn.disabled = false; runBtn.textContent = 'Run again';
        draw();
        return;
      }
    }

    requestAnimationFrame(tick);
  }

  function resetAll() {
    downData = []; upData = [];
    downTarg = downCur = downVel = 0;
    upTarg = upCur = upVel = 0;
    finishing = false;
    upStart = 0; phase = 'ping';
    testStart = performance.now();
    pEl.textContent = '\u2014'; dEl.textContent = '\u2014'; uEl.textContent = '\u2014';
    draw();
  }

  // Runs parallel GET/POST loops against Cloudflare's speed endpoints for
  // exactly `durationMs`, reporting a running throughput estimate as it goes.
  // Connections are fanned out (`concurrency`) so the link is saturated the
  // way multi-connection testers (Ookla) do it — a single sequential stream
  // leaves headroom on the pipe and under-reports real throughput.
  async function runTimedTransferTest(durationMs, chunkBytes, direction, onSpeedUpdate, concurrency = 6) {
    let totalBytes = 0;
    let stopped = false;
    const start = performance.now();
    let lastReportBytes = 0;
    let lastReportTime = start;

    const worker = async () => {
      while (!stopped) {
        const remaining = durationMs - (performance.now() - start);
        if (remaining <= 0) break;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.min(remaining, 5000));
        try {
          if (direction === 'down') {
            const resp = await fetch(`https://speed.cloudflare.com/__down?bytes=${chunkBytes}`, {
              cache: 'no-store',
              signal: controller.signal
            });
            const blob = await resp.blob();
            totalBytes += blob.size;
          } else {
            await fetch('https://speed.cloudflare.com/__up', {
              method: 'POST',
              body: new Blob([new Uint8Array(chunkBytes)]),
              cache: 'no-store',
              signal: controller.signal
            });
            totalBytes += chunkBytes;
          }
        } catch (e) {
          if (e.name !== 'AbortError') break;
        } finally {
          clearTimeout(timeout);
        }
      }
    };

    const workers = Array.from({ length: concurrency }, worker);

    while (!stopped && performance.now() - start < durationMs) {
      await new Promise(r => setTimeout(r, 250));
      const now = performance.now();
      const elapsed = (now - lastReportTime) / 1000;
      if (elapsed >= 0.5) {
        onSpeedUpdate(((totalBytes - lastReportBytes) * 8 / 1e6) / elapsed);
        lastReportBytes = totalBytes;
        lastReportTime = now;
      }
    }

    stopped = true;
    await Promise.all(workers);
    const elapsed = (performance.now() - start) / 1000;
    return elapsed > 0 ? (totalBytes * 8 / 1e6) / elapsed : 0;
  }

  const runDownloadTest = (durationMs, onSpeedUpdate) =>
    runTimedTransferTest(durationMs, 10_000_000, 'down', onSpeedUpdate, 6);
  const runUploadTest = (durationMs, onSpeedUpdate) =>
    runTimedTransferTest(durationMs, 1_000_000, 'up', onSpeedUpdate, 4);

  async function measurePingFallback() {
    try {
      const t0 = performance.now();
      await fetch('https://cloudflare.com/cdn-cgi/trace', { mode: 'no-cors', cache: 'no-store' });
      pEl.textContent = Math.round(performance.now() - t0) + ' ms';
    } catch (e) {
      pEl.textContent = '\u2014';
    }
  }

  async function measureLatency() {
    pEl.textContent = '...';
    await new Promise((resolve) => {
      try {
        const test = new SpeedTest({ measurements: [{ type: 'latency', numPackets: 20 }] });
        test.onFinish = (results) => {
          const latency = results.getSummary().latency;
          pEl.textContent = latency != null ? Math.round(latency) + ' ms' : '\u2014';
          resolve();
        };
        test.onError = () => { measurePingFallback().then(resolve); };
      } catch (e) {
        measurePingFallback().then(resolve);
      }
    });
  }

  // Orchestrates the full run: ping, then exactly PHASE_DURATION_MS of
  // download, then exactly PHASE_DURATION_MS of upload.
  async function runFullTest() {
    speedPhase.textContent = 'Testing Ping...';
    await measureLatency();

    phase = 'down';
    testStart = performance.now();
    speedPhase.textContent = 'Testing Download...';
    const downMbps = await runDownloadTest(PHASE_DURATION_MS, (speed) => { downTarg = speed; });
    downTarg = downMbps > 0 ? downMbps : 0;
    if (!downData.length || downData[downData.length - 1].t < 10) {
      downData.push({ t: 10, v: downTarg });
    }

    phase = 'up';
    upStart = performance.now();
    speedPhase.textContent = 'Testing Upload...';
    const upMbps = await runUploadTest(PHASE_DURATION_MS, (speed) => { upTarg = speed; });
    upTarg = upMbps > 0 ? upMbps : 0;

    finishing = true;
    if (downTarg <= 0 && upTarg <= 0) {
      noteEl.hidden = false;
      noteEl.textContent = 'Test unavailable. Check network restrictions.';
    } else if (upTarg <= 0) {
      noteEl.hidden = false;
      noteEl.textContent = 'Limited test \u2014 upload speed isn\u2019t measurable in this environment.';
    }
  }

  runBtn.addEventListener('click', function () {
    this.disabled = true; this.textContent = 'Testing\u2026';
    testRunning = true;
    resetAll();
    noteEl.hidden = true;
    speedPhase.textContent = 'Testing Ping...';
    requestAnimationFrame(tick);
    runFullTest();
  });

  window.addEventListener('resize', () => { cachedSize = null; draw(); });
  document.addEventListener('fullscreenchange', () => { cachedSize = null; draw(); });

  // Show the empty axes (gridlines + 0-10s labels) before any test runs, and
  // redraw whenever the panel scrolls into view (e.g. re-selecting the tab).
  requestAnimationFrame(() => draw());
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { cachedSize = null; draw(); }
    }).observe(canvas);
  }
})();
