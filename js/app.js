// Patakha: Diwali Crackers Simulator. App controller: stage loop, input, tray, sheets.

import { CRACKERS, byId, ICONS, DISTANT, PALETTES } from './crackers.js';
import { Audio } from './audio.js';
import { Haptics, Torch, Sparks, NATIVE } from './fx.js';
import { Scene, THEMES } from './scene.js';
import { VISUALS, burst } from './visuals.js';
import { Mic } from './mic.js';
import { Store, PRODUCTS, ls, fmtLeft } from './store.js';

const $ = (s) => document.querySelector(s);
const settings = Object.assign({ vol: 0.9, vib: true, vibK: 1, torch: false, ambient: true, shake: true, sel: 'anar', muted: false, theme: 'city', micSens: 0.8 }, ls.get('settings', {}));
const save = () => ls.set('settings', settings);
if (!byId[settings.sel]) settings.sel = 'anar';

// ------------------------------------------------------------------ stage
const stageEl = $('#stage'), trayEl = $('#tray'), flashesEl = $('#flashes');
const scene = new Scene($('#sky'), $('#props'));
const sparks = new Sparks($('#fx'));
let actives = [];
let liveFlashes = 0;

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const st = {
  scene, sparks,
  /** Light up the whole scene from (x, y): sky glow + local bloom. */
  flash(x, y, strength, ms, colour = '#fff1d6') {
    if (liveFlashes > 5 || strength <= 0.02) return;
    const [r, g, b] = hexRgb(colour);
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.background = `radial-gradient(circle at ${x + 0.1 * scene.w}px ${y + 0.1 * scene.h}px, rgba(${r},${g},${b},0.95) 0%, rgba(${r},${g},${b},0.38) ${12 + strength * 10}%, rgba(${r},${g},${b},0.08) 45%, transparent 75%)`;
    flashesEl.appendChild(el); liveFlashes++;
    const a = el.animate([{ opacity: Math.min(1, strength) }, { opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.1,.7,.3,1)' });
    a.onfinish = () => { el.remove(); liveFlashes--; };
  },
  shake(s) {
    if (!settings.shake) return;
    const k = 7 * s * scene.u, f = [];
    for (let i = 0; i <= 8; i++) { const d = (1 - i / 8) * k; f.push({ transform: `translate(${(Math.random() - 0.5) * 2 * d}px, ${(Math.random() - 0.5) * 2 * d}px)` }); }
    stageEl.animate(f, { duration: 260 + 180 * s, easing: 'ease-out' });
  },
};

function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  scene.resize(w, h, dpr, trayEl.getBoundingClientRect().height || 100);
  sparks.resize(w, h, dpr);
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ lighting
const tally = { tonight: 0, total: ls.get('total', 0) };
function count() {
  tally.tonight++; tally.total++;
  ls.set('total', tally.total);
  $('#litCount').textContent = tally.tonight;
}

let torchTimers = [];
async function light(def, x, y, { quiet = false } = {}) {
  Audio.unlock();
  if (Store.locked(def.id)) { if (!quiet) openUnlock(def); return null; }
  if (actives.length >= (quiet ? 9 : 8)) { if (!quiet) toast('Let these finish first'); return null; }
  const pos = def.kind === 'phuljhadi' ? { x, y } : scene.ground(x, y);
  const v = await Audio.variant(def);
  const h = Audio.play(v.buffer, { pan: (pos.x / scene.w - 0.5) * 1.2 });
  const vis = new VISUALS[def.kind](st, v.plan, pos.x, pos.y, h.when);
  vis.def = def; vis.sound = h;
  actives.push(vis);
  Haptics.add(v.envelope, def.feel, h.when);
  if (Torch.active) {
    for (const f of VISUALS[def.kind].torch(v.plan)) torchTimers.push(setTimeout(() => Torch.flash(f.ms), Math.max(0, h.when - performance.now() + f.t * 1000)));
    if (torchTimers.length > 400) torchTimers = torchTimers.slice(-200);
  }
  count();
  hint(null);
  Audio.warm(def);
  return vis;
}

// ------------------------------------------------------------------ input on the terrace
const grabs = new Map(); // pointerId -> sparkler visual
let lastMove = performance.now();
stageEl.addEventListener('pointerdown', async (e) => {
  if (!$('#welcome').hidden) return;
  const x = e.clientX, y = e.clientY, id = e.pointerId;
  Audio.unlock();
  autoTorch();
  const di = scene.diyaAt(x, y);
  if (di >= 0) {
    const d = scene.diyas[di];
    if (d.lit) { d.lit = false; d.out = performance.now(); } else { d.lit = true; Audio.strike(); }
    Haptics.tap(8);
    return;
  }
  // pick up a sparkler that's already burning
  const u = scene.u;
  for (const v of actives) {
    if (v.def.kind !== 'phuljhadi' || v.t > v.p.end) continue;
    const tp = v.tip();
    if (Math.hypot(v.hx - x, v.hy - y) < 46 * u || Math.hypot(tp.x - x, tp.y - y) < 40 * u) {
      v.held = true; grabs.set(id, v); stageEl.setPointerCapture(id); return;
    }
  }
  const def = byId[settings.sel];
  if (def.kind !== 'phuljhadi') { light(def, x, y); return; }
  // sparkler: follows the finger; the pointer may move while its sound renders
  const pend = { pending: true, x, y, up: false };
  grabs.set(id, pend); stageEl.setPointerCapture(id);
  const vis = await light(def, x, y);
  if (vis) vis.moveTo(pend.x, pend.y, 0);
  if (vis && !pend.up) { vis.held = true; grabs.set(id, vis); } else grabs.delete(id);
});
stageEl.addEventListener('pointermove', (e) => {
  const g = grabs.get(e.pointerId);
  if (!g) return;
  const now = performance.now(), dt = Math.max(0.001, (now - lastMove) / 1000); lastMove = now;
  if (g.pending) { g.x = e.clientX; g.y = e.clientY; } else g.moveTo(e.clientX, e.clientY, dt);
});
const release = (e) => {
  const g = grabs.get(e.pointerId);
  if (!g) return;
  if (g.pending) g.up = true; else { g.held = false; grabs.delete(e.pointerId); }
};
stageEl.addEventListener('pointerup', release);
stageEl.addEventListener('pointercancel', release);

// ------------------------------------------------------------------ the loop
let last = performance.now(), blowAcc = 0, lastBlow = 0, allOutTold = false;
let nextAmbient = performance.now() + 4000;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (Mic.on) {
    // our own crackers reach the mic through the speaker: discount them
    const echo = Audio.outLevel(), b = Math.max(0, Mic.blow(dt) - (echo > 0.01 ? echo * 6 : 0));
    scene.wind = scene.wind * 0.6 + b * 0.4;
    $('#micLevel').style.width = Math.round(b * 100) + '%';
    $('#micPill').classList.toggle('hot', b > 0);
    // any breath counts; a harder blow puts the diyas out faster
    if (b > 0) blowAcc += dt * (0.7 + b * 2); else blowAcc = Math.max(0, blowAcc - dt * 2);
    if (blowAcc > 0.1 && now - lastBlow > 230 - 170 * b && scene.blowOne()) { lastBlow = now; Haptics.tap(6); }
    if (!scene.litCount && !allOutTold) { allOutTold = true; toast('All diyas are out. Tap them to light them again.'); }
    if (scene.litCount) allOutTold = false;
  } else scene.wind *= 0.9;

  for (const v of actives) v.update(dt);
  actives = actives.filter((v) => !v.done);
  scene.beginFrame(now);
  scene.drawFloorMarks(dt);
  for (const v of actives) v.draw(scene.pc);
  scene.drawDebris(dt);
  sparks.update(dt);
  sparks.draw(dt);
  if (settings.ambient && Audio.ctx && now > nextAmbient) { nextAmbient = now + 5000 + Math.random() * 9000; ambient(); }
  requestAnimationFrame(frame);
}

/** A neighbour's rocket bursts far away over the rooftops; its bang arrives later. */
async function ambient() {
  if (document.hidden || actives.length > 3) return;
  const v = await Audio.variant(DISTANT, { fresh: true });
  const x = scene.w * (0.08 + Math.random() * 0.84), y = scene.horizon * (0.35 + Math.random() * 0.4);
  const colours = Object.keys(PALETTES).filter((c) => c !== 'saffron');
  const b = { ...v.plan, colour: v.plan.type === 'willow' || v.plan.type === 'crackle' ? 'gold' : colours[Math.floor(Math.random() * colours.length)] };
  burst(st, x, y, b, { scale: 0.36, alpha: 0.5 });
  ambientTimers.push(setTimeout(() => ambientSounds.push(Audio.play(v.buffer, { pan: (x / scene.w - 0.5) * 1.4, gain: 0.3 })), v.plan.delay * 1000));
  if (ambientSounds.length > 8) ambientSounds.splice(0, 4);
}
let ambientTimers = [], ambientSounds = [];

// ------------------------------------------------------------------ mute, clear, auto show
function setMuted(m) {
  settings.muted = m; save();
  Audio.setMuted(m);
  const b = $('#btnMute');
  b.setAttribute('aria-pressed', String(m));
  b.setAttribute('aria-label', m ? 'Sound is off: tap to turn it on' : 'Mute all sound');
  b.querySelector('use').setAttribute('href', m ? '#i-mute' : '#i-sound');
}
$('#btnMute').addEventListener('click', () => { Audio.unlock(); setMuted(!settings.muted); toast(settings.muted ? 'Sound off. Vibration and lights still work.' : 'Sound on'); });

/** Stop everything at once: sounds, vibration, flashlight, sparks, debris and the auto show. */
function clearAll() {
  stopShow();
  for (const v of actives) v.sound?.stop(0.06);
  actives = []; grabs.clear();
  torchTimers.forEach(clearTimeout); torchTimers = [];
  ambientTimers.forEach(clearTimeout); ambientTimers = [];
  ambientSounds.forEach((h) => h.stop(0.06)); ambientSounds = [];
  nextAmbient = performance.now() + 8000;
  Haptics.stop(); sparks.clear(); scene.clearMarks();
  flashesEl.innerHTML = ''; liveFlashes = 0;
}
$('#btnClear').addEventListener('click', () => { clearAll(); toast('All clear'); });

let show = null;
const SHOW_WEIGHT = { rocket: 4, skyshot: 2, anar: 2, chakri: 2, ladi: 1, bomb: 1 };
function startShow() {
  Audio.unlock();
  const pool = CRACKERS.filter((c) => SHOW_WEIGHT[c.kind] && !Store.locked(c.id));
  const total = pool.reduce((a, c) => a + SHOW_WEIGHT[c.kind], 0);
  const pick = () => { let r = Math.random() * total; for (const c of pool) if ((r -= SHOW_WEIGHT[c.kind]) <= 0) return c; return pool[0]; };
  const t0 = performance.now(), DUR = 45000;
  show = { timers: [] };
  const spot = () => [scene.w * (0.12 + Math.random() * 0.76), scene.placeTop + Math.random() * (scene.placeBottom - scene.placeTop)];
  const step = () => {
    if (!show) return;
    if (performance.now() - t0 > DUR) { // finale: a volley of rockets
      const rocket = byId.rocket;
      for (let i = 0; i < 5; i++) show.timers.push(setTimeout(() => light(rocket, scene.w * (0.15 + i * 0.17), scene.placeBottom - 4, { quiet: true }), i * 260));
      show.timers.push(setTimeout(() => { stopShow(); toast('Show over. Shubh Deepavali!'); }, 6000));
      return;
    }
    light(pick(), ...spot(), { quiet: true });
    show.timers.push(setTimeout(step, 1100 + Math.random() * 1700));
  };
  step();
  $('#btnShow').setAttribute('aria-pressed', 'true');
  toast('Auto show: sit back for 45 seconds');
}
function stopShow() {
  if (!show) return;
  show.timers.forEach(clearTimeout); show = null;
  $('#btnShow').setAttribute('aria-pressed', 'false');
}
$('#btnShow').addEventListener('click', () => { if (show) { stopShow(); toast('Show stopped'); } else startShow(); });

// ------------------------------------------------------------------ greeting card
const snap = document.createElement('canvas');
function takeSnapshot() {
  const W = 1080, H = 1350; snap.width = W; snap.height = H;
  const c = snap.getContext('2d'), sw = scene.sky.width, sh = scene.sky.height;
  const k = Math.max(W / sw, H / sh), cw = W / k, ch = H / k, sx = (sw - cw) / 2, sy = Math.max(0, (sh - ch) * 0.3);
  c.fillStyle = '#05030b'; c.fillRect(0, 0, W, H);
  c.drawImage(scene.sky, sx, sy, cw, ch, 0, 0, W, H);
  c.drawImage(scene.props, sx, sy, cw, ch, 0, 0, W, H);
  c.globalCompositeOperation = 'lighter'; c.drawImage(sparks.cv, sx, sy, cw, ch, 0, 0, W, H); c.globalCompositeOperation = 'source-over';
}
function drawCard() {
  const cv = $('#cardCanvas'), c = cv.getContext('2d'), W = cv.width, H = cv.height, name = $('#cardName').value.trim();
  c.drawImage(snap, 0, 0);
  let g = c.createLinearGradient(0, 0, 0, H * 0.45);
  g.addColorStop(0, 'rgba(5,3,11,0.7)'); g.addColorStop(1, 'rgba(5,3,11,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H * 0.45);
  g = c.createLinearGradient(0, H * 0.7, 0, H);
  g.addColorStop(0, 'rgba(5,3,11,0)'); g.addColorStop(1, 'rgba(5,3,11,0.85)');
  c.fillStyle = g; c.fillRect(0, H * 0.7, W, H * 0.3);
  c.textAlign = 'center'; c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 24;
  c.fillStyle = '#ffb627'; c.font = '128px "Yatra One", "Noto Sans Devanagari", sans-serif';
  c.fillText('शुभ दीपावली', W / 2, 200);
  c.fillStyle = '#fff4e2'; c.font = '700 64px "Chakra Petch", sans-serif';
  if ('letterSpacing' in c) c.letterSpacing = '12px';
  c.fillText('HAPPY DIWALI', W / 2, 296);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  if (name) { c.font = '500 50px Barlow, sans-serif'; c.fillStyle = '#ffe2b0'; c.fillText('with love from ' + name, W / 2, H - 150); }
  c.shadowBlur = 0; c.font = '28px "Share Tech Mono", monospace'; c.fillStyle = 'rgba(220,205,230,0.75)';
  c.fillText('Made with Patakha · ARTIN Studios', W / 2, H - 64);
}
async function openCard() {
  Audio.unlock();
  // light up the sky first if it's quiet, so every card has fireworks
  if (sparks.count < 250) {
    const cols = ['violet', 'gold', 'green', 'red', 'blue'];
    for (let i = 0; i < 3; i++) burst(st, scene.w * (0.25 + i * 0.25), scene.horizon * (0.3 + Math.random() * 0.25), { type: i === 1 ? 'willow' : 'peony', colour: cols[Math.floor(Math.random() * cols.length)], size: 0.7 });
    await new Promise((r) => setTimeout(r, 650));
  }
  takeSnapshot();
  await Promise.all(['128px "Yatra One"', '700 64px "Chakra Petch"', '500 50px Barlow', '28px "Share Tech Mono"'].map((f) => document.fonts.load(f, 'शुभ दीपावली HAPPY').catch(() => {})));
  drawCard();
  openSheet('#card');
}
$('#btnCard').addEventListener('click', openCard);
$('#cardName').addEventListener('input', drawCard);
$('#btnCardShare').addEventListener('click', () => {
  $('#cardCanvas').toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'patakha-diwali.png', { type: 'image/png' });
    try {
      if (NATIVE?.shareImage) {
        const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
        NATIVE.shareImage(b64);
      } else if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Happy Diwali', text: 'शुभ दीपावली! 🪔' });
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('Card saved to your downloads');
      }
    } catch (e) { if (e?.name !== 'AbortError') toast('Could not share the card'); }
  }, 'image/png');
});

// ------------------------------------------------------------------ themes
function renderThemes() {
  const box = $('#themes'); box.innerHTML = '';
  for (const [id, t] of Object.entries(THEMES)) {
    const b = document.createElement('button');
    b.className = 'theme cut'; b.setAttribute('aria-pressed', String(settings.theme === id));
    b.innerHTML = `<i style="background:linear-gradient(${t.sky[0]},${t.sky[2]} 60%,${t.wall[0]} 62%,${t.floor[1]})"></i><b>${t.name}</b><span lang="hi">${t.hi}</span>`;
    b.addEventListener('click', () => { settings.theme = id; save(); scene.setTheme(id); renderThemes(); Audio.tick(); });
    box.appendChild(b);
  }
}

// ------------------------------------------------------------------ tray
function renderTray() {
  trayEl.innerHTML = '';
  for (const c of CRACKERS) {
    const b = document.createElement('button');
    b.className = 'cr'; b.dataset.id = c.id;
    b.setAttribute('aria-label', `${c.name}: ${c.blurb}`);
    b.innerHTML = `<svg class="art" viewBox="0 0 48 48" aria-hidden="true">${ICONS[c.id]}</svg><span class="nm">${c.name}</span><span class="hi" lang="hi">${c.hi}</span>`;
    b.addEventListener('click', () => select(c.id, true));
    trayEl.appendChild(b);
  }
  refreshTray();
}
function refreshTray() {
  for (const b of trayEl.children) {
    const id = b.dataset.id, locked = Store.locked(id), left = Store.tempLeft('c:' + id);
    b.setAttribute('aria-pressed', String(id === settings.sel));
    b.classList.toggle('locked', locked);
    b.querySelector('.lock')?.remove(); b.querySelector('.timer')?.remove();
    if (locked) b.insertAdjacentHTML('beforeend', '<svg class="lock" aria-label="Locked"><use href="#i-lock"/></svg>');
    else if (left && !Store.premium) b.insertAdjacentHTML('beforeend', `<span class="timer">${fmtLeft(left)}</span>`);
  }
}
function select(id, user = false) {
  const def = byId[id];
  if (user) { Audio.unlock(); Audio.tick(); Haptics.tap(6); }
  if (Store.locked(id)) { openUnlock(def); return; }
  settings.sel = id; save();
  refreshTray();
  hint(def.kind === 'phuljhadi' ? 'Touch and drag to draw with the sparkler' : `Tap the terrace to light the ${def.name}`, true);
  Audio.warm(def);
}

let hintTimer = 0;
function hint(text, show = false) {
  const el = $('#hint');
  if (text) el.textContent = text;
  clearTimeout(hintTimer);
  if (show) { el.classList.remove('fade'); hintTimer = setTimeout(() => el.classList.add('fade'), 3200); }
  else if (tally.tonight > 0) hintTimer = setTimeout(() => el.classList.add('fade'), 600);
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ------------------------------------------------------------------ sheets
const sheets = ['#welcome', '#settings', '#unlock', '#card'];
function openSheet(sel) { $(sel).hidden = false; }
function closeSheet(sel) { $(sel).hidden = true; }
document.querySelectorAll('.sheet-wrap').forEach((w) => {
  w.addEventListener('click', (e) => { if (e.target === w && w.id !== 'welcome') w.hidden = true; });
  w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { w.hidden = true; }));
});
/** Android back button: close the top sheet; returns false when there is nothing to close. */
window.artinBack = () => {
  for (const s of sheets.slice().reverse()) if (s !== '#welcome' && !$(s).hidden) { closeSheet(s); return true; }
  return false;
};

// settings
function openSettings() {
  $('#optVol').value = settings.vol; $('#optVib').checked = settings.vib; $('#optVibK').value = settings.vibK;
  $('#optTorch').checked = Torch.active; $('#optAmbient').checked = settings.ambient; $('#optShake').checked = settings.shake;
  $('#optVib').disabled = !Haptics.supported; $('#optMic').value = settings.micSens;
  renderThemes();
  $('#torchNote').textContent = NATIVE ? '' : Torch.possible
    ? 'Flashlight bursts use the camera flash (Chrome on Android). Your browser will ask for camera permission. The camera image is never used.'
    : 'Flashlight bursts need a phone with a flash, in Chrome on Android, or the Patakha app.';
  renderShop();
  openSheet('#settings');
}
$('#btnSettings').addEventListener('click', () => { Audio.unlock(); openSettings(); });
$('#optVol').addEventListener('input', (e) => { settings.vol = +e.target.value; Audio.setVolume(settings.vol); save(); });
$('#optVib').addEventListener('change', (e) => { settings.vib = e.target.checked; Haptics.enabled = settings.vib; if (!settings.vib) Haptics.stop(); else Haptics.tap(20); save(); });
$('#optVibK').addEventListener('change', (e) => { settings.vibK = +e.target.value; Haptics.intensity = settings.vibK; Haptics.tap(30); save(); });
$('#optTorch').addEventListener('change', (e) => setTorch(e.target.checked));
$('#optAmbient').addEventListener('change', (e) => { settings.ambient = e.target.checked; save(); });
$('#optShake').addEventListener('change', (e) => { settings.shake = e.target.checked; save(); });
$('#optMic').addEventListener('input', (e) => { settings.micSens = +e.target.value; Mic.sensitivity = settings.micSens; save(); });

// torch
async function setTorch(on) {
  if (on) {
    try { await Torch.enable(); Torch.flash(160); settings.torch = true; } catch (err) { settings.torch = false; toast(err.message || 'Flashlight not available'); }
  } else { Torch.disable(); settings.torch = false; }
  save();
  $('#btnTorch').setAttribute('aria-pressed', String(Torch.active));
  $('#optTorch').checked = Torch.active;
}
let torchTried = false;
function autoTorch() { if (settings.torch && !Torch.active && !torchTried) { torchTried = true; setTorch(true); } }
$('#btnTorch').addEventListener('click', () => { Audio.unlock(); setTorch(!Torch.active); });

// diyas + microphone
$('#btnDiya').addEventListener('click', async () => {
  const ctx = Audio.unlock();
  if (Mic.on) { Mic.stop(); $('#micPill').hidden = true; $('#btnDiya').setAttribute('aria-pressed', 'false'); return; }
  try {
    await Mic.start(ctx);
    if (!scene.litCount) { scene.diyas.forEach((d) => { d.lit = true; }); Audio.strike(); }
    $('#micPill').hidden = false; $('#btnDiya').setAttribute('aria-pressed', 'true');
  } catch {
    toast('Microphone unavailable. Tap a diya to put it out instead.');
  }
});

// ------------------------------------------------------------------ store
let unlockFor = null;
function openUnlock(def) {
  unlockFor = def;
  $('#unTitle').textContent = def.name;
  $('#unArt').innerHTML = `<div style="display:grid;justify-items:center"><svg viewBox="0 0 48 48">${ICONS[def.id]}</svg><span class="hi" lang="hi">${def.hi}</span></div>`;
  $('#unBlurb').textContent = def.blurb + '.';
  Store.loadRewarded();
  renderUnlock();
  openSheet('#unlock');
}
function renderUnlock() {
  if (!unlockFor) return;
  const w = $('#btnWatch'), span = w.querySelector('span'), ready = Store.rewardedReady();
  w.disabled = !ready && Store.adError == null;
  span.textContent = ready ? 'Watch a short video · free for 24 h' : Store.adError != null ? `Retry video (code ${Store.adError})` : 'Loading video…';
  const buy = $('#btnBuyAll'), avail = Store.available('all_crackers');
  buy.textContent = avail ? `All crackers forever · ${Store.price('all_crackers')}` : 'All crackers · Soon';
  buy.disabled = !avail;
  $('#unNote').textContent = avail ? '' : 'Purchases open once Patakha is live on Google Play.';
}
$('#btnWatch').addEventListener('click', () => {
  if (!Store.rewardedReady()) { Store.loadRewarded(); renderUnlock(); return; }
  const def = unlockFor;
  Store.unlockWithAd(def.id, (earned) => {
    if (earned) { closeSheet('#unlock'); toast(`${def.name} unlocked for 24 hours`); select(def.id); }
    else toast('Watch the whole video to unlock');
  });
});
$('#btnBuyAll').addEventListener('click', () => Store.buy('all_crackers'));
$('#btnRestore').addEventListener('click', () => { Store.restore(); toast('Checking your purchases…'); });
$('#btnPrivacyOpts').addEventListener('click', () => Store.showPrivacyOptions());

function renderShop() {
  $('#shop').hidden = !Store.enabled;
  if (!Store.enabled) return;
  const box = $('#products'); box.innerHTML = '';
  let anyAvail = false;
  for (const [id, p] of Object.entries(PRODUCTS)) {
    const owned = Store.owned.has(id), avail = Store.available(id); anyAvail ||= avail;
    const el = document.createElement('div');
    el.className = 'product' + (p.best ? ' best' : '') + (owned ? ' owned' : '');
    el.innerHTML = `<div><b>${p.name}</b>${p.best ? '<span class="tag-best">BEST</span>' : ''}<p>${p.blurb}</p></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn-ghost cut';
    btn.textContent = owned ? 'Owned' : avail ? Store.price(id) : 'Soon';
    btn.disabled = owned || !avail;
    btn.addEventListener('click', () => Store.buy(id));
    el.appendChild(btn); box.appendChild(el);
  }
  $('#shopNote').textContent = anyAvail ? '' : 'Purchases open once Patakha is live on Google Play.';
  $('#btnPrivacyOpts').hidden = !Store.privacyOptionsRequired();
  const s = Store.native && Store.adStatus();
  $('#adStatus').hidden = !s;
  if (s) $('#adStatus').textContent = 'Ads · ' + Object.entries(s).map(([k, v]) => `${k}: ${v}`).join(' · ');
}
Store.on(() => {
  refreshTray(); renderUnlock();
  if (!$('#settings').hidden) renderShop();
  if (Store.adsRemoved) Store.setBanner(false);
});
setInterval(refreshTray, 60e3);

// ------------------------------------------------------------------ keyboard (desktop)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { window.artinBack(); return; }
  if (!$('#welcome').hidden || e.target.closest?.('input')) return;
  if (e.key === 'm') $('#btnMute').click();
  if (e.key === 'c') $('#btnClear').click();
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= CRACKERS.length) select(CRACKERS[n - 1].id, true);
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    light(byId[settings.sel], scene.w * (0.3 + Math.random() * 0.4), (scene.placeTop + scene.placeBottom) / 2);
  }
});

// ------------------------------------------------------------------ lifecycle
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Haptics.stop(); Audio.ctx?.suspend(); } else Audio.ctx?.resume();
});

async function prewarm() {
  const order = [byId[settings.sel], ...CRACKERS.filter((c) => c.free && c.id !== settings.sel)];
  for (const d of order) { await Audio.variant(d); await new Promise((r) => setTimeout(r, 30)); }
  await Audio.variant(DISTANT);
}

function start() {
  Haptics.enabled = settings.vib; Haptics.intensity = settings.vibK; Audio.setVolume(settings.vol);
  Mic.sensitivity = settings.micSens; setMuted(settings.muted); scene.setTheme(settings.theme);
  renderTray(); resize(); select(settings.sel);
  requestAnimationFrame((t) => { last = t; frame(t); });
  prewarm();
  fetch('version.json').then((r) => r.json()).then((v) => { $('#verLine').textContent = `v${v.version} · build ${v.versionCode}`; }).catch(() => {});
  if (NATIVE && settings.torch) setTorch(true);

  const splash = $('#splash');
  setTimeout(() => {
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 300);
    if (!ls.get('welcomed', false)) openSheet('#welcome');
    else Store.setBanner(true);
  }, 720);
}
$('#btnStart').addEventListener('click', () => {
  Audio.unlock(); ls.set('welcomed', true); closeSheet('#welcome'); Store.setBanner(true);
  hint(null, true);
});

if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
start();
