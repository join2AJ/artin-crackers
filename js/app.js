// Patakha: Diwali Crackers Simulator. App controller: stage loop, input, tray, sheets.

import { CRACKERS, byId, ICONS, DISTANT, PALETTES, MANUAL, CATS } from './crackers.js';
import { Lighter, LIGHTERS } from './lighter.js';
import { Audio } from './audio.js';
import { Haptics, Torch, Sparks, NATIVE } from './fx.js';
import { Scene, THEMES } from './scene.js';
import { VISUALS, burst } from './visuals.js';
import { Mic } from './mic.js';
import { Store, PRODUCTS, ls, fmtLeft } from './store.js';

const $ = (s) => document.querySelector(s);
const settings = Object.assign({ vol: 0.9, vib: true, vibK: 1, torch: false, ambient: true, shake: true, sel: 'anar', muted: false, theme: 'city', micSens: 0.8, realLight: true, lighter: 'agarbatti', shakeLight: false, cardStyle: 'classic' }, ls.get('settings', {}));
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

// ------------------------------------------------------------------ lighting & green impact
// Every virtual cracker is one real cracker not burst: we add up what it would have cost the air.
const ZERO = () => ({ count: 0, co2: 0, smoke: 0, pm: 0 });
const saved = ls.get('impact', null);
const impact = { tonight: ZERO(), total: Object.assign(ZERO(), saved || { count: ls.get('total', 0) }) };
const fmtG = (g) => (g >= 1000 ? (g / 1000).toFixed(g >= 10000 ? 0 : 1) + ' kg' : Math.round(g) + ' g');
function count(def) {
  const e = MANUAL[def.id]?.eco || {};
  for (const k of [impact.tonight, impact.total]) { k.count++; k.co2 += e.co2 || 0; k.smoke += e.smoke || 0; k.pm = Math.max(k.pm, e.pm || 0); }
  ls.set('impact', impact.total);
  $('#litCount').textContent = impact.tonight.count;
  $('#co2Count').textContent = fmtG(impact.tonight.co2);
}

let torchTimers = [];
/** Puts a cracker on the terrace. Lit at once, or left unlit for the lighter (`unlit`). */
async function light(def, x, y, { quiet = false, unlit = false } = {}) {
  Audio.unlock();
  if (Store.locked(def.id)) { if (!quiet) openUnlock(def); return null; }
  if (actives.length >= (quiet ? 9 : 10)) { if (!quiet) toast('Let these finish first'); return null; }
  const pos = def.kind === 'phuljhadi' ? { x, y } : scene.ground(x, y);
  const v = await Audio.variant(def);
  const vis = new VISUALS[def.kind](st, v.plan, pos.x, pos.y, Infinity);
  vis.def = def; vis.variant = v;
  actives.push(vis);
  if (unlit) vis.lit = false; else ignite(vis);
  Audio.warm(def);
  return vis;
}
/** The fuse catches: sound, vibration, flashlight and visuals all start together. */
function ignite(vis) {
  const def = vis.def, v = vis.variant;
  const h = Audio.play(v.buffer, { pan: (vis.x / scene.w - 0.5) * 1.2 });
  vis.when = h.when; vis.lit = true; vis.sound = h;
  Haptics.add(v.envelope, def.feel, h.when);
  if (Torch.active) {
    for (const f of VISUALS[def.kind].torch(v.plan)) torchTimers.push(setTimeout(() => Torch.flash(f.ms), Math.max(0, h.when - performance.now() + f.t * 1000)));
    if (torchTimers.length > 400) torchTimers = torchTimers.slice(-200);
  }
  count(def);
  hint(null);
}

// ------------------------------------------------------------------ input on the terrace
// Real lighting: a quick tap places the cracker, then press and drag to hold the
// lighter (agarbatti, candle or phuljhadi) to its fuse. Quick mode: a tap lights at once.
const lighter = new Lighter();
const grabs = new Map(); // pointerId -> sparkler visual
const press = new Map(); // pointerId -> lighter press
let lastMove = performance.now(), toldLighter = false;
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
    if (v.def.kind !== 'phuljhadi' || v.lit === false || v.t > v.p.end) continue;
    const tp = v.tip();
    if (Math.hypot(v.hx - x, v.hy - y) < 46 * u || Math.hypot(tp.x - x, tp.y - y) < 40 * u) {
      v.held = true; grabs.set(id, v); stageEl.setPointerCapture(id); return;
    }
  }
  const def = byId[settings.sel];
  if (def.kind === 'phuljhadi') {
    // sparkler: follows the finger; the pointer may move while its sound renders
    const pend = { pending: true, x, y, up: false };
    grabs.set(id, pend); stageEl.setPointerCapture(id);
    const vis = await light(def, x, y);
    if (vis) vis.moveTo(pend.x, pend.y, 0);
    if (vis && !pend.up) { vis.held = true; grabs.set(id, vis); } else grabs.delete(id);
    return;
  }
  if (!settings.realLight) { light(def, x, y); return; }
  press.set(id, { x0: x, y0: y, t0: performance.now(), moved: false, lit: false });
  lighter.x = x; lighter.y = y; lighter.pid = id; lighter.active = true;
  stageEl.setPointerCapture(id);
});
stageEl.addEventListener('pointermove', (e) => {
  const pr = press.get(e.pointerId);
  if (pr) {
    lighter.x = e.clientX; lighter.y = e.clientY;
    if (Math.hypot(e.clientX - pr.x0, e.clientY - pr.y0) > 10) pr.moved = true;
    return;
  }
  const g = grabs.get(e.pointerId);
  if (!g) return;
  const now = performance.now(), dt = Math.max(0.001, (now - lastMove) / 1000); lastMove = now;
  if (g.pending) { g.x = e.clientX; g.y = e.clientY; } else g.moveTo(e.clientX, e.clientY, dt);
});
const release = (e) => {
  const pr = press.get(e.pointerId);
  if (pr) {
    press.delete(e.pointerId);
    if (lighter.pid === e.pointerId) lighter.active = false;
    if (!pr.moved && !pr.lit && performance.now() - pr.t0 < 350 && e.type === 'pointerup') place(pr.x0, pr.y0);
    return;
  }
  const g = grabs.get(e.pointerId);
  if (!g) return;
  if (g.pending) g.up = true; else { g.held = false; grabs.delete(e.pointerId); }
};
stageEl.addEventListener('pointerup', release);
stageEl.addEventListener('pointercancel', release);

/** Real lighting: set the selected cracker down, unlit. */
async function place(x, y) {
  const spot = scene.ground(x, y), u = scene.u;
  if (actives.some((v) => v.lit === false && Math.hypot(v.x - spot.x, v.y - spot.y) < 26 * u)) {
    toast(`Press and drag to hold the ${LIGHTERS[lighter.kind].name.toLowerCase()} to its fuse`); return;
  }
  const vis = await light(byId[settings.sel], x, y, { unlit: true });
  if (vis) { Haptics.tap(6); if (!toldLighter) { toldLighter = true; hint(`Now press and drag the ${LIGHTERS[lighter.kind].name.toLowerCase()} to the fuse`, true); } }
}

/** While the lighter is held, any fuse it touches for long enough catches fire. */
function touchFuses(now, dt) {
  const pr = press.get(lighter.pid);
  lighter.shown = !!(lighter.active && pr && (pr.moved || now - pr.t0 > 150));
  if (!lighter.shown) return;
  const u = scene.u, tp = lighter.tip(u);
  for (const v of actives) {
    if (v.lit !== false) continue;
    const fp = v.fusePoint();
    if (Math.hypot(fp.x - tp.x, fp.y - tp.y) < 16 * u) {
      v.touch = (v.touch || 0) + dt;
      for (let i = 0; i < 2; i++) sparks.add({ x: fp.x, y: fp.y, vx: (Math.random() - 0.5) * 80 * u, vy: -Math.random() * 80 * u, life: 0.15, colour: '#ffd27a', size: 1.2 * u, drag: 2, grav: 100 * u });
      if (v.touch >= lighter.catchTime) { ignite(v); pr.lit = true; Haptics.tap(10); }
    } else v.touch = 0;
  }
}

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

  touchFuses(now, dt);
  for (const v of actives) if (v.lit !== false) v.update(dt);
  actives = actives.filter((v) => !v.done);
  scene.beginFrame(now);
  scene.drawFloorMarks(dt);
  for (const v of actives) v.draw(scene.pc);
  scene.drawDebris(dt);
  lighter.draw(scene.pc, now, scene.u, st, lighter.shown);
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
const CARD_STYLES = { classic: 'Classic', rangoli: 'Rangoli', diya: 'Diya', green: 'Green Diwali', minimal: 'Minimal' };
function petalRing(c, cx, cy, R, n, col, wide) {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    c.save(); c.translate(cx, cy); c.rotate((i / n) * Math.PI * 2);
    c.beginPath(); c.moveTo(R * 0.35, 0); c.quadraticCurveTo(R * 0.7, -wide, R, 0); c.quadraticCurveTo(R * 0.7, wide, R * 0.35, 0); c.fill(); c.restore();
  }
}
function cardDiya(c, x, y, s) {
  c.fillStyle = '#b4532a'; c.beginPath(); c.moveTo(x - 30 * s, y); c.quadraticCurveTo(x, y + 30 * s, x + 30 * s, y); c.closePath(); c.fill();
  c.fillStyle = '#d97a45'; c.beginPath(); c.ellipse(x, y, 30 * s, 7 * s, 0, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(x, y - 22 * s, 0, x, y - 22 * s, 40 * s);
  g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.3, 'rgba(255,190,80,0.8)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - 22 * s, 40 * s, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fffbe6'; c.beginPath(); c.moveTo(x - 7 * s, y - 4 * s); c.quadraticCurveTo(x - 8 * s, y - 22 * s, x, y - 40 * s); c.quadraticCurveTo(x + 8 * s, y - 22 * s, x + 7 * s, y - 4 * s); c.fill();
}
function drawCard() {
  const cv = $('#cardCanvas'), c = cv.getContext('2d'), W = cv.width, H = cv.height, name = $('#cardName').value.trim(), style = settings.cardStyle;
  c.save();
  c.drawImage(snap, 0, 0);
  const shade = (y0, y1, a0, a1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(5,3,11,${a0})`); g.addColorStop(1, `rgba(5,3,11,${a1})`); c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0); };
  const spaced = (txt, x, y, sp) => { if ('letterSpacing' in c) c.letterSpacing = sp + 'px'; c.fillText(txt, x, y); if ('letterSpacing' in c) c.letterSpacing = '0px'; };
  c.textAlign = 'center'; c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 24;
  let nameY = H - 150;
  if (style === 'minimal') {
    c.fillStyle = 'rgba(5,3,11,0.55)'; c.fillRect(0, 0, W, H);
    c.shadowBlur = 0; c.strokeStyle = '#ffb627'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 120, H / 2 + 30); c.lineTo(W / 2 + 120, H / 2 + 30); c.stroke();
    c.fillStyle = '#fff4e2'; c.font = '104px "Yatra One", sans-serif'; c.fillText('शुभ दीपावली', W / 2, H / 2 - 30);
    c.font = '600 40px "Chakra Petch", sans-serif'; c.fillStyle = '#ffb627'; spaced('HAPPY DIWALI', W / 2, H / 2 + 100, 16);
    nameY = H / 2 + 190;
  } else {
    shade(0, H * 0.45, 0.7, 0); shade(H * 0.62, H, 0, 0.88);
    c.fillStyle = '#ffb627'; c.font = '128px "Yatra One", "Noto Sans Devanagari", sans-serif';
    c.fillText(style === 'green' ? 'हरित दीपावली' : 'शुभ दीपावली', W / 2, 200);
    c.fillStyle = '#fff4e2'; c.font = '700 64px "Chakra Petch", sans-serif';
    spaced(style === 'green' ? 'A GREEN DIWALI' : 'HAPPY DIWALI', W / 2, 296, 12);
  }
  c.shadowBlur = 0;
  if (style === 'rangoli') {
    c.strokeStyle = '#ffb627'; c.lineWidth = 6; c.strokeRect(28, 28, W - 56, H - 56); c.lineWidth = 2; c.strokeRect(46, 46, W - 92, H - 92);
    for (const [x, y] of [[46, 46], [W - 46, 46], [46, H - 46], [W - 46, H - 46]]) {
      petalRing(c, x, y, 120, 12, '#ff4f8b', 16); petalRing(c, x, y, 84, 10, '#ffcc33', 12); petalRing(c, x, y, 52, 8, '#2ecc71', 10);
      c.fillStyle = '#ff9933'; c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.fill();
    }
  } else if (style === 'diya') {
    const g = c.createRadialGradient(W / 2, H, 0, W / 2, H, H * 0.7); g.addColorStop(0, 'rgba(255,150,50,0.35)'); g.addColorStop(1, 'rgba(255,150,50,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) cardDiya(c, W * (0.14 + i * 0.18), H - 250 + Math.abs(i - 2) * 22, 1.5 - Math.abs(i - 2) * 0.15);
    c.font = 'italic 500 38px Barlow, sans-serif'; c.fillStyle = '#ffe2b0'; c.fillText('May your home be filled with light', W / 2, 370);
    nameY = H - 110;
  } else if (style === 'green') {
    const t = impact.total;
    c.fillStyle = 'rgba(10,30,18,0.78)'; c.fillRect(110, H - 470, W - 220, 250);
    c.strokeStyle = '#53d88a'; c.lineWidth = 2; c.strokeRect(110, H - 470, W - 220, 250);
    c.fillStyle = '#53d88a'; c.font = '600 34px "Chakra Petch", sans-serif'; spaced('MY SMOKE-FREE DIWALI', W / 2, H - 412, 6);
    c.fillStyle = '#ffffff'; c.font = '500 40px Barlow, sans-serif';
    c.fillText(`${Math.max(1, t.count)} crackers, zero smoke`, W / 2, H - 352);
    c.fillText(`${fmtG(t.co2)} CO₂ · ${Math.round(t.smoke)} cigarettes' smoke saved`, W / 2, H - 296);
    c.fillStyle = 'rgba(220,240,225,0.75)'; c.font = '28px Barlow, sans-serif'; c.fillText('Celebrate with light, not smoke', W / 2, H - 248);
  }
  if (name) { c.shadowBlur = 16; c.font = '500 50px Barlow, sans-serif'; c.fillStyle = '#ffe2b0'; c.fillText('with love from ' + name, W / 2, nameY); }
  c.shadowBlur = 0; c.font = '28px "Share Tech Mono", monospace'; c.fillStyle = 'rgba(220,205,230,0.75)';
  c.fillText('Made with Patakha · ARTIN Studios', W / 2, H - 64);
  c.restore();
}
function renderCardStyles() {
  const box = $('#cardStyles'); box.innerHTML = '';
  for (const [id, label] of Object.entries(CARD_STYLES)) {
    const b = document.createElement('button');
    b.textContent = label; b.setAttribute('aria-pressed', String(settings.cardStyle === id));
    b.addEventListener('click', () => { settings.cardStyle = id; save(); renderCardStyles(); drawCard(); });
    box.appendChild(b);
  }
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
  if (!CARD_STYLES[settings.cardStyle]) settings.cardStyle = 'classic';
  renderCardStyles();
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
function setTheme(id) {
  settings.theme = id; save(); scene.setTheme(id); Audio.tick();
  renderThemes();
  $('#optReal').checked = settings.realLight; $('#optShakeLight').checked = settings.shakeLight;
}
function renderThemes() {
  for (const box of [$('#themes'), $('#themeStrip')]) {
    box.innerHTML = '';
    for (const [id, t] of Object.entries(THEMES)) {
      const b = document.createElement('button');
      b.className = 'theme cut'; b.setAttribute('aria-pressed', String(settings.theme === id));
      b.innerHTML = `<i style="background:linear-gradient(${t.sky[0]},${t.sky[2]} 60%,${t.wall[0]} 62%,${t.floor[1]})"></i><b>${t.name}</b><span lang="hi">${t.hi}</span>`;
      b.addEventListener('click', () => { setTheme(id); if (box.id === 'themeStrip' && window.innerHeight < 500) setTimeout(() => { $('#themeBar').hidden = true; }, 350); });
      box.appendChild(b);
    }
  }
}
$('#btnTheme').addEventListener('click', () => { const bar = $('#themeBar'); bar.hidden = !bar.hidden; if (!bar.hidden) { renderThemes(); bar.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }); } });
$('#themeBarClose').addEventListener('click', () => { $('#themeBar').hidden = true; });

// ------------------------------------------------------------------ lighter
function setLighter(kind) {
  settings.lighter = kind; lighter.kind = kind; save();
  $('#btnLighter').setAttribute('aria-label', 'Lighter: ' + LIGHTERS[kind].name);
}
$('#btnLighter').addEventListener('click', () => {
  const ks = Object.keys(LIGHTERS), next = ks[(ks.indexOf(settings.lighter) + 1) % ks.length];
  setLighter(next); Audio.tick();
  if (!settings.realLight) { settings.realLight = true; save(); }
  toast(`Lighter: ${LIGHTERS[next].name} · ${LIGHTERS[next].hi}`);
});

// ------------------------------------------------------------------ shake to light
let lastShake = 0;
window.addEventListener('devicemotion', (e) => {
  if (!settings.shakeLight || !$('#welcome').hidden) return;
  const a = e.acceleration?.x != null ? e.acceleration : e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  const g = e.acceleration?.x != null ? 0 : 9.8, m = Math.abs(Math.hypot(a.x, a.y, a.z) - g), now = performance.now();
  if (m > 16 && now - lastShake > 900) {
    lastShake = now;
    const def = byId[settings.sel];
    if (def.kind !== 'phuljhadi') light(def, scene.w * (0.2 + Math.random() * 0.6), scene.placeTop + Math.random() * (scene.placeBottom - scene.placeTop));
  }
});

// ------------------------------------------------------------------ green impact
let impKey = 'tonight';
function renderImpact() {
  const t = impact[impKey], pm = t.pm;
  const phones = Math.round(t.co2 / 8), treeDays = t.co2 / 58;
  $('#impStats').innerHTML = [
    [t.count, 'crackers burst, with zero smoke'],
    [fmtG(t.co2), `CO₂ kept out of the air (≈ ${phones} phone charges)`],
    [Math.round(t.smoke), "cigarettes' worth of smoke nobody had to breathe"],
    [treeDays >= 1 ? treeDays.toFixed(1) : treeDays.toFixed(2), "days of a tree's work absorbing that CO₂"],
  ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  const notes = [];
  if (pm) {
    notes.push(`<p>Air quality: the dirtiest of your crackers would have pushed PM2.5 next to you to about <b>${pm.toLocaleString('en-IN')} µg/m³</b>. That is <b>${Math.round(pm / 250)}×</b> the level where India's AQI turns <b>Severe</b> (250 µg/m³), and <b>${Math.round(pm / 60)}×</b> India's safe limit (60 µg/m³ over 24 hours). The spike is short, but it goes straight into the lungs of whoever is standing closest, often children.</p>`);
    notes.push('<div class="aqi" aria-hidden="true"><i style="background:#3fbf5f"></i><i style="background:#9acd32"></i><i style="background:#f2d335"></i><i style="background:#f29a2e"></i><i style="background:#e8452e"></i><i style="background:#8b1a3a"></i></div>');
  }
  if (t.count) notes.push(`<p>You also spared your street ${t.count > 20 ? 'a long night' : 'some'} of bangs that frighten babies, older people, patients and animals. India limits cracker noise to 125 dB(AI) measured 4 m away, and big bombs often go past it.</p>`);
  else notes.push('<p>Burst a few crackers and come back to see the difference you are making.</p>');
  $('#impNotes').innerHTML = notes.join('');
  document.querySelectorAll('#impSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === impKey)));
}
$('#btnImpact').addEventListener('click', () => { renderImpact(); openSheet('#impact'); });
document.querySelectorAll('#impSeg button').forEach((b) => b.addEventListener('click', () => { impKey = b.dataset.k; renderImpact(); }));

// ------------------------------------------------------------------ about Diwali
const DIWALI = ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05', '2030-10-26'];
function renderCountdown() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = DIWALI.map((d) => new Date(d + 'T00:00:00')).find((d) => d >= today);
  const el = $('#diwaliCountdown');
  if (!next) { el.hidden = true; return; }
  const days = Math.round((next - today) / 86400e3), when = next.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  el.innerHTML = days === 0 ? '<b>Today</b> is Diwali! शुभ दीपावली' : `<b>${days}</b> ${days === 1 ? 'day' : 'days'} to Diwali · ${when}`;
}
$('#btnAbout').addEventListener('click', () => { renderCountdown(); openSheet('#about'); });

// ------------------------------------------------------------------ cracker box and field manual
function renderBox() {
  const list = $('#boxList'); list.innerHTML = '';
  for (const [cat, label] of Object.entries(CATS)) {
    const sec = document.createElement('section'); sec.className = 'box-cat';
    sec.innerHTML = `<h4>${label}</h4><div class="box-grid"></div>`;
    const grid = sec.querySelector('.box-grid');
    for (const c of CRACKERS.filter((x) => MANUAL[x.id].cat === cat)) {
      const b = document.createElement('button');
      b.className = 'bx'; b.setAttribute('aria-pressed', String(c.id === settings.sel));
      b.innerHTML = `<svg class="art" viewBox="0 0 48 48" aria-hidden="true">${ICONS[c.id]}</svg><div><b>${c.name}</b><span class="hi" lang="hi">${c.hi}</span></div>${Store.locked(c.id) ? '<svg class="lock"><use href="#i-lock"/></svg>' : ''}`;
      const info = document.createElement('span'); info.className = 'info'; info.setAttribute('role', 'button'); info.setAttribute('aria-label', `About ${c.name}`);
      info.innerHTML = '<svg><use href="#i-info"/></svg>';
      info.addEventListener('click', (e) => { e.stopPropagation(); openManual(c.id); });
      b.appendChild(info);
      b.addEventListener('click', () => { closeSheet('#box'); select(c.id, true); });
      grid.appendChild(b);
    }
    list.appendChild(sec);
  }
}
let manualFor = null;
function openManual(id) {
  const c = byId[id], m = MANUAL[id], e = m.eco;
  manualFor = id;
  $('#manTitle').textContent = c.name;
  $('#manBody').innerHTML = `<div class="man-art"><svg viewBox="0 0 48 48">${ICONS[id]}</svg><div><div class="hi" lang="hi">${c.hi}</div><div class="muted">${c.blurb}</div></div></div>
    <div class="man-body"><h4>How it works</h4><p>${m.how}</p><h4>Stay safe</h4><p>${m.safety}</p>
    <h4>One real ${c.name.toLowerCase()}</h4></div>
    <div class="stats"><div class="stat"><b>${e.smoke}</b><span>cigarettes' worth of smoke${e.src === 'study' ? ' (measured)' : ' (estimate)'}</span></div>
    <div class="stat"><b>${e.co2} g</b><span>CO₂ (estimate)</span></div>
    ${e.pm ? `<div class="stat"><b>${e.pm.toLocaleString('en-IN')}</b><span>µg/m³ peak PM2.5 nearby (measured)</span></div>` : ''}
    <div class="stat"><b>~${e.db} dB</b><span>loudness up close (estimate)</span></div></div>`;
  $('#btnManPick').querySelector('span').textContent = Store.locked(id) ? 'Unlock this cracker' : 'Use this cracker';
  openSheet('#manual');
}
$('#btnManPick').addEventListener('click', () => { closeSheet('#manual'); closeSheet('#box'); select(manualFor, true); });

// ------------------------------------------------------------------ tray
function renderTray() {
  trayEl.innerHTML = '';
  const box = document.createElement('button');
  box.className = 'cr box-btn'; box.setAttribute('aria-label', 'Open the cracker box');
  box.innerHTML = '<svg aria-hidden="true"><use href="#i-grid"/></svg><span class="nm">All</span><span class="hi" lang="hi">डिब्बा</span>';
  box.addEventListener('click', () => { Audio.unlock(); renderBox(); openSheet('#box'); });
  trayEl.appendChild(box);
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
    if (!b.dataset.id) continue;
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
  else if (impact.tonight.count > 0) hintTimer = setTimeout(() => el.classList.add('fade'), 600);
}

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ------------------------------------------------------------------ sheets
const sheets = ['#welcome', '#settings', '#box', '#unlock', '#impact', '#about', '#card', '#manual'];
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
$('#optReal').addEventListener('change', (e) => { settings.realLight = e.target.checked; save(); });
$('#optShakeLight').addEventListener('change', (e) => { settings.shakeLight = e.target.checked; save(); });
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
  Mic.sensitivity = settings.micSens; setMuted(settings.muted); setLighter(LIGHTERS[settings.lighter] ? settings.lighter : 'agarbatti');
  if (!THEMES[settings.theme]) settings.theme = 'city';
  scene.setTheme(settings.theme);
  $('#litCount').textContent = '0'; $('#co2Count').textContent = '0 g';
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
// test hook for the automated screenshots: ?debug
if (new URLSearchParams(location.search).has('debug')) window.__patakha = { actives: () => actives, scene, lighter };
start();
