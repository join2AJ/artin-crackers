// Patakha: Diwali Crackers. The 3D game: map select, first-person controls,
// placing and lighting crackers, and the sheets (green impact, cards, shop…).

import * as THREE from './vendor/three.module.min.js';
import { CRACKERS, byId, ICONS, DISTANT, PALETTES, MANUAL, CATS } from './crackers.js';
import { Audio } from './audio.js';
import { Haptics, Torch, NATIVE } from './fx.js';
import { Mic } from './mic.js';
import { Store, PRODUCTS, ls, fmtLeft } from './store.js';
import { World, QUALITY } from './w3d/world.js';
import { MAPS } from './w3d/maps.js';
import { KINDS, TORCH } from './w3d/crackers3d.js';
import { Player, Lighter, LIGHTERS } from './w3d/player.js';

const $ = (s) => document.querySelector(s);
const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
const settings = Object.assign({ variants: {}, vol: 0.9, vib: true, vibK: 1, torch: false, ambient: true, shake: true, sel: 'anar', muted: false, micSens: 0.8, lighter: 'agarbatti', shakeLight: false, cardStyle: 'green', cardMsg: 'green',
  map: 'gali', quality: weak ? 'low' : 'medium', look: 0.85, invert: false, bob: false, fps: false, mode: 'place', easyAim: true }, ls.get('settings', {}));
const save = () => ls.set('settings', settings);
if (!byId[settings.sel]) settings.sel = 'anar';
if (!MAPS[settings.map]) settings.map = 'gali';
if (!QUALITY[settings.quality]) settings.quality = 'medium';

// ------------------------------------------------------------------ world
const world = new World($('#game'), settings.quality);
const player = new Player(world);
const lighter = new Lighter(world);
lighter.attach();
let actives = []; // crackers in the world: unlit, burning and spent shells
let playing = false, held = null, lighting = null, torchOn = false;
let torchTimers = [];
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

function resize() {
  world.resize();
  $('#rotate').hidden = !(window.innerHeight > window.innerWidth * 1.05 && playing && !NATIVE);
}
window.addEventListener('resize', resize);

/** Screen position of a world point (null when behind the camera). */
function toScreen(p) {
  const v = tmp2.copy(p).project(world.camera);
  if (v.z > 1) return null;
  return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
}

// ------------------------------------------------------------------ lighting & green impact
// Every virtual cracker is one real cracker not burst: we add up what it would have cost the air.
const ZERO = () => ({ count: 0, co2: 0, smoke: 0, pm: 0, loud: 0 });
const saved = ls.get('impact', null);
const impact = { tonight: ZERO(), total: Object.assign(ZERO(), saved || { count: ls.get('total', 0) }) };
const fmtG = (g) => (g >= 1000 ? (g / 1000).toFixed(g >= 10000 ? 0 : 1) + ' kg' : Math.round(g) + ' g');
// Green badges, earned on all-time totals.
const BADGES = [
  { id: 'seed', icon: '🌱', name: 'Seedling', need: 'First smoke-free cracker', ok: (t) => t.count >= 1 },
  { id: 'friend', icon: '🍃', name: 'Clean-Air Friend', need: '100 g CO₂ saved', co2: 100 },
  { id: 'tree', icon: '🌳', name: 'Tree Buddy', need: '500 g CO₂ saved', co2: 500 },
  { id: 'lungs', icon: '🫁', name: 'Lung Saver', need: "500 cigarettes' smoke saved", ok: (t) => t.smoke >= 500 },
  { id: 'paws', icon: '🐾', name: 'Pet Protector', need: '25 loud crackers, zero noise', ok: (t) => t.loud >= 25 },
  { id: 'earth', icon: '🌏', name: 'Earth Guardian', need: '1 kg CO₂ saved', co2: 1000 },
  { id: 'champ', icon: '🦚', name: 'Green Champion', need: '2.5 kg CO₂ saved', co2: 2500 },
  { id: 'hero', icon: '🏆', name: 'Air Hero', need: '5 kg CO₂ saved', co2: 5000 },
];
const earned = (b, t) => (b.co2 ? t.co2 >= b.co2 : b.ok(t));
const CO2_STEPS = [0, ...BADGES.filter((b) => b.co2).map((b) => b.co2)];
function nextStep(g) {
  for (let i = 1; i < CO2_STEPS.length; i++) if (g < CO2_STEPS[i]) return { from: CO2_STEPS[i - 1], to: CO2_STEPS[i], badge: BADGES.find((b) => b.co2 === CO2_STEPS[i]) };
  return null;
}
function updateEcoMeter() {
  const t = impact.total, n = nextStep(t.co2), k = n ? (t.co2 - n.from) / (n.to - n.from) : 1;
  $('#ecoArc').setAttribute('stroke-dashoffset', String(94.25 * (1 - k)));
  $('#litCount').textContent = impact.tonight.count;
  $('#co2Count').textContent = fmtG(impact.tonight.co2);
}
/** A little "+60 g CO₂" that floats up from the cracker. */
function popSaving(x, y, g) {
  if (!g) return;
  const el = document.createElement('div');
  el.className = 'plus'; el.innerHTML = `<svg><use href="#i-leaf"/></svg> +${fmtG(g)} CO₂`;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  document.body.appendChild(el);
  el.animate([{ opacity: 0, transform: 'translate(-50%, 6px)' }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'translate(-50%, -48px)' }], { duration: 1800, easing: 'ease-out' }).onfinish = () => el.remove();
  const m = $('#btnImpact'); m.classList.remove('pulse'); void m.offsetWidth; m.classList.add('pulse');
}
let msTimer = 0;
function celebrate(b) {
  const el = $('#milestone');
  el.querySelector('i').textContent = b.icon; el.querySelector('b').textContent = b.name;
  el.querySelector('span').textContent = `Badge earned: ${b.need}. Thank you for a cleaner Diwali!`;
  el.classList.add('show'); Haptics.tap(30);
  clearTimeout(msTimer); msTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function count(def, sp) {
  const e = MANUAL[def.base || def.id]?.eco || {}, before = BADGES.filter((b) => earned(b, impact.total)).length;
  for (const k of [impact.tonight, impact.total]) { k.count++; k.co2 += e.co2 || 0; k.smoke += e.smoke || 0; k.pm = Math.max(k.pm, e.pm || 0); if ((e.db || 0) >= 110) k.loud++; }
  ls.set('impact', impact.total);
  updateEcoMeter();
  if (sp) popSaving(sp.x, sp.y - 26, e.co2);
  const now = BADGES.filter((b) => earned(b, impact.total));
  if (now.length > before) setTimeout(() => celebrate(now[now.length - 1]), 900);
}
// Variants: each one gets its own sound cache key (e.g. 'anar:silver').
const vdefs = {};
function withVariant(def) {
  if (!def.variants) return def;
  const v = settings.variants?.[def.id] && def.variants.some((x) => x.id === settings.variants[def.id]) ? settings.variants[def.id] : def.variants[0].id;
  const key = def.id + ':' + v;
  return (vdefs[key] ||= { ...def, id: key, base: def.id, variant: v, plan: (r) => def.plan(r, v) });
}

// ------------------------------------------------------------------ placing and lighting
const MAX_LIVE = 14;
async function place() {
  const def = byId[settings.sel];
  Audio.unlock();
  if (Store.locked(def.id)) { openUnlock(def); return; }
  if (actives.filter((c) => !c.spent).length >= MAX_LIVE) { toast('Light these first'); return; }
  const aim = world.aimGround(3.5);
  const o = world.collide(aim.x, aim.z, 0.25);
  aim.x = o.x; aim.z = o.z;
  const vd = withVariant(def), v = await Audio.variant(vd);
  const c = new KINDS[def.kind](world, vd, v, aim, player.yaw);
  if (def.kind === 'phuljhadi') c.plant();
  actives.push(c);
  Audio.warm(vd); Audio.tick(); Haptics.tap(8);
  hint(def.kind === 'ladi' ? 'Aim at the end of the string and press Light' : `Aim at the ${def.name} and press Light`, true);
}
/** Takes a phuljhadi or pencil in your hand. */
async function hold() {
  const def = byId[settings.sel];
  Audio.unlock();
  if (def.kind !== 'phuljhadi') { toast(`Never hold a ${def.name}! Place it on the ground, then light it.`); Haptics.tap(20); return; }
  if (Store.locked(def.id)) { openUnlock(def); return; }
  dropHeld();
  const vd = withVariant(def), v = await Audio.variant(vd);
  const c = new KINDS.phuljhadi(world, vd, v, new THREE.Vector3(), 0);
  c.g.removeFromParent(); world.hand.add(c.g);
  c.g.position.set(-0.2, -0.32, -0.55); c.g.rotation.set(-0.7, 0, -0.15);
  c.body.held = true;
  held = { kind: 'cracker', c };
  actives.push(c);
  Audio.warm(vd); Audio.tick();
  hint('Press Light to light your ' + def.name, true);
}
/** Lights a cracker's fuse: sound, vibration, flashlight and the burn all start together. */
function ignite(c) {
  const v = c.v, h = Audio.play(v.buffer, { gain: 0 });
  c.sound = h; c.ignite(h.when);
  placeSound(c);
  const d = c.g.getWorldPosition(tmp).distanceTo(world.camera.position);
  Haptics.add(v.envelope, c.def.feel * Math.max(0.15, 1 - d / 30), h.when);
  if (Torch.active && settings.torch) {
    for (const f of (TORCH[c.def.kind] || (() => []))(v.plan)) torchTimers.push(setTimeout(() => Torch.flash(f.ms), Math.max(0, h.when - performance.now() + f.t * 1000)));
    if (torchTimers.length > 400) torchTimers = torchTimers.slice(-200);
  }
  count(c.def, toScreen(c.fuseTip(tmp)));
  hint(null);
}
/** Positional sound: pan and distance follow the player. */
function placeSound(c) {
  if (!c.sound?.place) return;
  const cam = world.camera, p = c.g.getWorldPosition(tmp), d = p.distanceTo(cam.position);
  const right = player.right(tmp2), dx = p.x - cam.position.x, dz = p.z - cam.position.z, len = Math.hypot(dx, dz) || 1;
  const pan = c.body.held ? -0.2 : ((dx * right.x + dz * right.z) / len) * Math.min(1, len / 2) * 0.85;
  c.sound.place(pan, Math.min(1, 1.6 / (1 + d * 0.18)));
}
function startLighting(target) {
  if (lighting) return;
  if (!lighter.out) setLighter(true);
  lighting = { target, t: 0 };
  Audio.tick();
}
function stepLighting(dt) {
  if (!lighting) { lighter.reachTo(null); return; }
  const tg = lighting.target;
  const p = tg.kind === 'diya' ? tg.d.flame : tg.c.fuseTip(tmp);
  lighter.reachTo(p);
  lighting.t += dt;
  const tip = lighter.tip(tmp2);
  if (lighting.t > 0.2 && Math.random() < 0.6) world.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5), vy: Math.random() * 0.8, vz: (Math.random() - 0.5), life: 0.2, size: 0.025, c: '#ffb347', drag: 2, grav: 3 });
  if (lighting.t > 0.25 + lighter.catchTime || (lighting.t > 0.15 && tip.distanceTo(p) < 0.04)) {
    if (tg.kind === 'diya') { tg.d.lit = true; Audio.strike(); Haptics.tap(8); }
    else if (!tg.c.lit && !tg.c.done) ignite(tg.c);
    lighting = null;
  }
}
function dropHeld() {
  if (!held) return;
  if (held.kind === 'prop') { held.b.held = false; held.b.v.set(0, 0, 0); }
  else if (!held.c.lit) held.c.remove();
  held = null;
}
function throwHeld() {
  if (held?.kind !== 'prop') return;
  const b = held.b, f = player.forward(tmp);
  b.held = false; b.v.copy(f).multiplyScalar(7).add(player.vel); b.v.y += 2.2;
  b.w.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
  held = null; Haptics.tap(10);
}

// ------------------------------------------------------------------ what you are looking at
let target = null;
function findTarget() {
  const cam = world.camera, o = cam.position, d = player.forward(tmp);
  let best = null, bt = Infinity;
  const test = (p, r, reach, t) => {
    const v = tmp2.copy(p).sub(o), along = v.dot(d);
    if (along < 0.1 || along > reach) return;
    const perp = v.addScaledVector(d, -along).length();
    if (perp < r && along < bt) { bt = along; best = t; }
  };
  for (const c of actives) {
    if (c.done || c.lit || c.body.held || c.spent) continue;
    test(c.fuseTip(tmp2.clone()), c.radius + 0.25, 4.2, { kind: 'cracker', c });
    test(c.g.position, c.radius + 0.2, 4.2, { kind: 'cracker', c });
  }
  if (held?.kind === 'cracker' && !held.c.lit) best = { kind: 'cracker', c: held.c };
  for (const b of world.bodies) if (b.kind === 'prop' && !b.held) test(b.p, b.r + 0.2, 3, { kind: 'prop', b });
  for (const dd of world.diyas) if (!dd.lit) test(dd.flame, 0.22, 3, { kind: 'diya', d: dd });
  // easy aim: no exact aim needed, the nearest unlit cracker in front of you (or right beside you) counts
  if (!best && settings.easyAim) {
    let bd = Infinity;
    const fx = Math.sin(-player.yaw), fz = -Math.cos(player.yaw);
    for (const c of actives) {
      if (c.done || c.lit || c.body.held || c.spent) continue;
      const dx = c.g.position.x - player.pos.x, dz = c.g.position.z - player.pos.z, dist = Math.hypot(dx, dz);
      const front = dist > 0.01 ? (dx * fx + dz * fz) / dist : 1;
      if ((dist < 4.5 && front > 0.75) || dist < 1.6) if (dist < bd) { bd = dist; best = { kind: 'cracker', c }; }
    }
  }
  return best;
}
/** The action button's job right now: { id, label, enabled }. */
function currentAction() {
  const m = settings.mode, def = byId[settings.sel];
  if (lighting) return { id: 'wait', label: 'Lighting…', on: false };
  if (held?.kind === 'prop') return { id: 'throw', label: 'Throw', on: true };
  if (target?.kind === 'cracker') {
    if (m === 'pick' && !target.c.body.held) return { id: 'pickc', label: 'Pick up', on: true };
    return { id: 'light', label: 'Light', on: true };
  }
  if (target?.kind === 'diya') return { id: 'diya', label: 'Light diya', on: true };
  if (m === 'pick') return target?.kind === 'prop' ? { id: 'pickp', label: 'Pick up', on: true } : { id: 'none', label: 'Pick', on: false };
  if (m === 'hold') return held?.kind === 'cracker' && held.c.lit ? { id: 'drop', label: 'Drop', on: true } : { id: 'hold', label: 'Hold', on: def.kind === 'phuljhadi' };
  return { id: 'place', label: 'Place', on: true };
}
let lastAct = '';
function updateHud() {
  target = findTarget();
  const a = currentAction(), key = a.id + a.label + a.on;
  if (key !== lastAct) {
    lastAct = key;
    const b = $('#btnAct');
    b.querySelector('b').textContent = a.label; b.setAttribute('aria-label', a.label);
    b.classList.toggle('off', !a.on); b.classList.toggle('fire', a.id === 'light' || a.id === 'diya');
  }
  const el = $('#target');
  const txt = target?.kind === 'cracker' ? `${target.c.name}${target.c.def.variant ? ' · ' + (byId[target.c.def.base]?.variants?.find((x) => x.id === target.c.def.variant)?.name || '') : ''}`
    : target?.kind === 'prop' ? ({ ball: 'Football', bucket: 'Water bucket', can: 'Can', box: 'Cardboard box', matka: 'Matka' }[target.b.type] || 'Prop')
      : target?.kind === 'diya' ? 'Diya (out)' : '';
  if (el.textContent !== txt) el.textContent = txt;
  el.hidden = !txt;
  $('#cross').classList.toggle('on', !!target);
}
function act() {
  Audio.unlock();
  const a = currentAction();
  if (!a.on) { if (a.id === 'hold') hold(); else if (a.id === 'none') toast('Look at a ball, can or bucket to pick it up'); return; }
  if (a.id === 'place') place();
  else if (a.id === 'hold') hold();
  else if (a.id === 'light') startLighting(target);
  else if (a.id === 'diya') startLighting(target);
  else if (a.id === 'throw') throwHeld();
  else if (a.id === 'drop') { const c = held.c; c.g.removeFromParent(); world.scene.add(c.g); c.g.position.copy(world.aimGround(1.2)); c.g.rotation.set(0, player.yaw, 0); c.plant(); c.body.held = false; held = null; }
  else if (a.id === 'pickc') { target.c.remove(); actives = actives.filter((x) => x !== target.c); toast('Back in the box'); Haptics.tap(6); }
  else if (a.id === 'pickp') { dropHeld(); held = { kind: 'prop', b: target.b }; target.b.held = true; Haptics.tap(6); }
}
$('#btnAct').addEventListener('pointerdown', (e) => { e.preventDefault(); act(); });
function setMode(m) {
  settings.mode = m; save(); Audio.tick();
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
  if (m !== 'pick' && held?.kind === 'prop') dropHeld();
  lastAct = '';
}
document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));

// ------------------------------------------------------------------ lighter and flashlight
function setLighter(on) {
  lighter.show(on);
  $('#btnLighter').setAttribute('aria-pressed', String(on));
  if (!on) lighting = null;
}
$('#btnLighter').addEventListener('click', () => { Audio.unlock(); Audio.tick(); setLighter(!lighter.out); if (lighter.out) toast(`${LIGHTERS[lighter.kind].name} · ${LIGHTERS[lighter.kind].hi}. Aim at a fuse and press Light.`); });
function setFlashlight(on) {
  torchOn = on;
  world.flashlight.intensity = on ? 40 : 0;
  $('#btnTorch').setAttribute('aria-pressed', String(on));
}
$('#btnTorch').addEventListener('click', () => { Audio.unlock(); Audio.tick(); setFlashlight(!torchOn); });

// ------------------------------------------------------------------ touch controls
// Left side: a floating joystick to walk. Right side (and mouse anywhere): drag to look.
const touchEl = $('#touch'), joyEl = $('#joy'), knob = joyEl.querySelector('i');
let joy = null, lookP = null;
const JR = 52;
let lookDX = 0, lookDY = 0;
touchEl.addEventListener('pointerdown', (e) => {
  Audio.unlock();
  if (!playing) return;
  if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.42 && !joy) {
    // the stick stays where it is drawn: slide anywhere on the left half to push it
    joy = { id: e.pointerId, x: e.clientX, y: e.clientY };
    joyEl.classList.add('on');
  } else if (!lookP) lookP = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { touchEl.setPointerCapture(e.pointerId); } catch { /* synthetic or finished pointer */ }
});
touchEl.addEventListener('pointermove', (e) => {
  if (joy && e.pointerId === joy.id) {
    let dx = e.clientX - joy.x, dy = e.clientY - joy.y;
    const m = Math.hypot(dx, dy);
    if (m > JR) { dx *= JR / m; dy *= JR / m; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // a small dead zone, then a gentle curve so small pushes walk slowly
    const k = Math.max(0, (Math.min(m, JR) - 6) / (JR - 6)), ang = Math.atan2(dy, dx), sp = k * k * 0.6 + k * 0.4;
    player.move.x = Math.cos(ang) * sp; player.move.y = -Math.sin(ang) * sp;
  } else if (lookP && e.pointerId === lookP.id) {
    const k = 0.0042 * settings.look * (e.pointerType === 'mouse' ? 0.8 : 1);
    const dx = (e.clientX - lookP.x) * k, dy = (e.clientY - lookP.y) * k * (settings.invert ? -1 : 1);
    player.look(dx, dy);
    lookDX += Math.abs(dx); lookDY += Math.abs(dy);
    lookP.x = e.clientX; lookP.y = e.clientY;
  }
});
const endTouch = (e) => {
  if (joy && e.pointerId === joy.id) { joy = null; joyEl.classList.remove('on'); knob.style.transform = ''; player.move.x = player.move.y = 0; }
  if (lookP && e.pointerId === lookP.id) lookP = null;
};
touchEl.addEventListener('pointerup', endTouch);
touchEl.addEventListener('pointercancel', endTouch);

// ------------------------------------------------------------------ the loop
let last = performance.now(), blowAcc = 0, lastBlow = 0, allOutTold = false, wind = 0, nextAmbient = performance.now() + 5000, orbit = 0;
let fpsN = 0, fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (document.hidden) return;
  const paused = sheetOpen();
  if (playing && !paused) player.update(dt);
  else if (!playing) { // menu backdrop: a slow look around the map
    orbit += dt * 0.06;
    const s = world.b.spawn;
    player.pos.set(s.x, 0, s.z); player.yaw = (s.yaw || 0) + Math.sin(orbit) * 0.7; player.pitch = 0.12 + Math.sin(orbit * 0.7) * 0.06; player.apply();
  }
  if (Mic.on) {
    const echo = Audio.outLevel(), b = Math.max(0, Mic.blow(dt) - (echo > 0.01 ? echo * 6 : 0));
    wind = wind * 0.6 + b * 0.4;
    $('#micLevel').style.width = Math.round(b * 100) + '%';
    $('#micPill').classList.toggle('hot', b > 0);
    if (b > 0) blowAcc += dt * (0.7 + b * 2); else blowAcc = Math.max(0, blowAcc - dt * 2);
    if (blowAcc > 0.1 && now - lastBlow > 230 - 170 * b && world.blowOut(player.pos.clone().setY(0.5), 7)) { lastBlow = now; Haptics.tap(6); }
    if (!world.litDiyas && !allOutTold) { allOutTold = true; toast('All diyas are out. Look at one and press Light to light it again.'); }
    if (world.litDiyas) allOutTold = false;
  } else wind *= 0.9;
  for (const c of actives) c.update(dt, now);
  actives = actives.filter((c) => !c.done || c.spent);
  const shells = actives.filter((c) => c.spent);
  if (shells.length > 10) { shells[0].remove(); actives = actives.filter((c) => c !== shells[0]); }
  if (held?.kind === 'cracker' && held.c.done) held = null;
  if (held?.kind === 'prop') {
    const f = player.forward(tmp), b = held.b;
    b.p.set(player.pos.x + f.x * 0.75, Math.max(b.r, 1.15 + f.y * 0.5), player.pos.z + f.z * 0.75);
  }
  stepLighting(dt);
  lighter.update(dt, world.time);
  world.update(dt, playing ? player : null, wind);
  for (const c of actives) if (c.sound && !c.spent) placeSound(c);
  if (playing) { updateHud(); if (!paused) stepTutorial(dt); }
  if (settings.ambient && Audio.ctx && now > nextAmbient) { nextAmbient = now + 5000 + Math.random() * 9000; ambient(); }
  world.render();
  if (settings.fps) { fpsN++; if (now - fpsT > 500) { $('#fps').textContent = Math.round((fpsN * 1000) / (now - fpsT)) + ' fps'; fpsN = 0; fpsT = now; } }
}

/** A neighbour's rocket bursts far away over the rooftops; its bang arrives later. */
async function ambient() {
  if (document.hidden || actives.filter((c) => c.lit && !c.done).length > 3) return;
  const v = await Audio.variant(DISTANT, { fresh: true });
  const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 50;
  const pos = new THREE.Vector3(Math.cos(a) * r, 30 + Math.random() * 30, Math.sin(a) * r);
  const colours = Object.keys(PALETTES).filter((c) => c !== 'saffron');
  const colour = v.plan.type === 'willow' || v.plan.type === 'crackle' ? 'gold' : colours[Math.floor(Math.random() * colours.length)];
  world.burst(pos, { ...v.plan, colour, size: 0.6 }, PALETTES[colour], null, 1.7);
  const right = player.right(tmp), dx = pos.x - player.pos.x, dz = pos.z - player.pos.z, len = Math.hypot(dx, dz);
  ambientTimers.push(setTimeout(() => ambientSounds.push(Audio.play(v.buffer, { pan: ((dx * right.x + dz * right.z) / len) * 0.9, gain: 0.3 })), v.plan.delay * 1000));
  if (ambientSounds.length > 8) ambientSounds.splice(0, 4);
}
let ambientTimers = [], ambientSounds = [];

// ------------------------------------------------------------------ mute and clear
function setMuted(m) {
  settings.muted = m; save();
  Audio.setMuted(m);
  const b = $('#btnMute');
  b.setAttribute('aria-pressed', String(m));
  b.setAttribute('aria-label', m ? 'Sound is off: tap to turn it on' : 'Mute all sound');
  b.querySelector('use').setAttribute('href', m ? '#i-mute' : '#i-sound');
}
$('#btnMute').addEventListener('click', () => { Audio.unlock(); setMuted(!settings.muted); toast(settings.muted ? 'Sound off. Vibration and lights still work.' : 'Sound on'); });

/** Stop everything at once: sounds, vibration, flashlight, sparks and every cracker. */
function clearAll() {
  for (const c of actives) { c.sound?.stop(0.06); c.remove(); }
  actives = []; lighting = null;
  if (held?.kind === 'cracker') held = null; else dropHeld();
  torchTimers.forEach(clearTimeout); torchTimers = [];
  ambientTimers.forEach(clearTimeout); ambientTimers = [];
  ambientSounds.forEach((h) => h.stop(0.06)); ambientSounds = [];
  nextAmbient = performance.now() + 8000;
  Haptics.stop(); world.clearFx();
}
$('#btnClear').addEventListener('click', () => { clearAll(); toast('All clear'); });

// ------------------------------------------------------------------ greeting card
const snap = document.createElement('canvas');
function takeSnapshot() {
  const W = 1080, H = 1350; snap.width = W; snap.height = H;
  world.render(); // read the WebGL canvas in the same task as the render
  const src = world.renderer.domElement, sw = src.width, sh = src.height;
  const k = Math.max(W / sw, H / sh), cw = W / k, ch = H / k, sx = (sw - cw) / 2, sy = Math.max(0, (sh - ch) * 0.3);
  const c = snap.getContext('2d');
  c.fillStyle = '#05030b'; c.fillRect(0, 0, W, H);
  c.drawImage(src, sx, sy, cw, ch, 0, 0, W, H);
}
const CARD_STYLES = { green: 'Green Diwali', comic: 'Comic', classic: 'Classic', rangoli: 'Rangoli', lotus: 'Lotus', diya: 'Diya', minimal: 'Minimal' };
const CARD_MSGS = {
  diwali: { label: 'Happy Diwali', hi: 'शुभ दीपावली', en: 'HAPPY DIWALI', line: 'May your home be filled with light' },
  green: { label: 'Green Diwali', hi: 'हरित दीपावली', en: 'A GREEN DIWALI', line: 'Celebrate with light, not smoke' },
  lakshmi: { label: 'Lakshmi Puja', hi: 'शुभ लक्ष्मी पूजन', en: 'HAPPY LAKSHMI PUJA', line: 'Wishing you wealth, health and happiness' },
  newyear: { label: 'New Year', hi: 'नूतन वर्ष अभिनंदन', en: 'SAAL MUBARAK', line: 'A bright and prosperous new year to you' },
  dhanteras: { label: 'Dhanteras', hi: 'शुभ धनतेरस', en: 'HAPPY DHANTERAS', line: 'May good fortune shine on your home' },
};
const INKC = '#07120d';
function petalRing(c, cx, cy, R, n, col, wide, edge) {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    c.save(); c.translate(cx, cy); c.rotate((i / n) * Math.PI * 2);
    c.beginPath(); c.moveTo(R * 0.35, 0); c.quadraticCurveTo(R * 0.7, -wide, R, 0); c.quadraticCurveTo(R * 0.7, wide, R * 0.35, 0); c.fill();
    if (edge) { c.strokeStyle = edge; c.lineWidth = 3; c.stroke(); }
    c.restore();
  }
}
function cardDiya(c, x, y, s) {
  c.lineWidth = 4 * s; c.strokeStyle = INKC;
  c.fillStyle = '#d0682f'; c.beginPath(); c.moveTo(x - 30 * s, y); c.quadraticCurveTo(x, y + 30 * s, x + 30 * s, y); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ec8a4c'; c.beginPath(); c.ellipse(x, y, 30 * s, 7 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  const g = c.createRadialGradient(x, y - 22 * s, 0, x, y - 22 * s, 46 * s);
  g.addColorStop(0, 'rgba(255,240,190,0.9)'); g.addColorStop(0.3, 'rgba(255,190,80,0.5)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y - 22 * s, 46 * s, 0, Math.PI * 2); c.fill();
  const flame = (w, h, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x - w * s, y - 4 * s); c.quadraticCurveTo(x - (w + 1) * s, y - h * 0.55 * s, x, y - h * s); c.quadraticCurveTo(x + (w + 1) * s, y - h * 0.55 * s, x + w * s, y - 4 * s); c.closePath(); c.fill(); };
  flame(9, 44, '#ff7a1a'); c.lineWidth = 3 * s; c.stroke(); flame(6, 36, '#ffc94a'); flame(3, 24, '#fffbe8');
}
/** Comic lettering: thick ink outline under the fill. */
function inkText(c, txt, x, y, fill, w = 10) { c.lineJoin = 'round'; c.strokeStyle = INKC; c.lineWidth = w; c.strokeText(txt, x, y); c.fillStyle = fill; c.fillText(txt, x, y); }
function lotus(c, cx, cy, R) {
  const petal = (a, len, wid) => { c.save(); c.translate(cx, cy); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-wid, -len * 0.4, -wid * 0.6, -len * 0.85, 0, -len); c.bezierCurveTo(wid * 0.6, -len * 0.85, wid, -len * 0.4, 0, 0); c.fill(); c.stroke(); c.restore(); };
  c.strokeStyle = '#ffd36b'; c.lineWidth = 4;
  c.fillStyle = 'rgba(255,120,160,0.35)'; for (const a of [-1.2, -0.6, 0.6, 1.2]) petal(a, R * 0.9, R * 0.32);
  c.fillStyle = 'rgba(255,170,200,0.55)'; for (const a of [-0.3, 0.3]) petal(a, R, R * 0.34);
  c.fillStyle = 'rgba(255,220,235,0.75)'; petal(0, R * 1.08, R * 0.3);
  c.beginPath(); c.moveTo(cx - R * 1.3, cy + 6); c.quadraticCurveTo(cx, cy + R * 0.28, cx + R * 1.3, cy + 6); c.stroke();
}
function drawCard() {
  const cv = $('#cardCanvas'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const name = $('#cardName').value.trim(), to = $('#cardTo').value.trim(), style = settings.cardStyle;
  const m = CARD_MSGS[settings.cardMsg] || CARD_MSGS.diwali;
  c.save();
  c.drawImage(snap, 0, 0);
  const shade = (y0, y1, a0, a1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(2,14,9,${a0})`); g.addColorStop(1, `rgba(2,14,9,${a1})`); c.fillStyle = g; c.fillRect(0, y0, W, y1 - y0); };
  const spaced = (txt, x, y, sp) => { if ('letterSpacing' in c) c.letterSpacing = sp + 'px'; c.fillText(txt, x, y); if ('letterSpacing' in c) c.letterSpacing = '0px'; };
  const fit = (txt, font, max) => { let size = parseInt(font.match(/(\d+)px/)[1], 10); c.font = font; while (c.measureText(txt).width > max && size > 20) { size -= 4; c.font = font.replace(/\d+px/, size + 'px'); } };
  c.textAlign = 'center';
  let nameY = H - 150, toY = 92, footer = 'rgba(220,235,225,0.8)';
  if (style === 'comic') {
    // halftone dots, ink panel border, starburst title and a speech bubble
    c.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 0; y < H; y += 18) for (let x = (y / 18) % 2 ? 9 : 0; x < W; x += 18) { c.beginPath(); c.arc(x, y, 2 + 3 * (y / H), 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fffdf5'; c.fillRect(0, 0, W, 26); c.fillRect(0, H - 26, W, 26); c.fillRect(0, 0, 26, H); c.fillRect(W - 26, 0, 26, H);
    c.strokeStyle = INKC; c.lineWidth = 10; c.strokeRect(26, 26, W - 52, H - 52);
    const bx = W / 2, by = 240;
    c.save(); c.translate(bx, by); c.rotate(-0.05); c.beginPath();
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, rr = i % 2 ? 300 : 400; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.42); }
    c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 9; c.strokeStyle = INKC; c.stroke();
    c.fillStyle = '#ff5c3a'; c.beginPath(); for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, rr = i % 2 ? 230 : 290; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.4); } c.closePath(); c.fill(); c.lineWidth = 5; c.stroke();
    fit(m.en + '!', '700 86px "Chakra Petch", sans-serif', 500); inkText(c, m.en + '!', 0, 28, '#ffffff', 14);
    c.restore();
    c.font = '96px "Yatra One", sans-serif'; inkText(c, m.hi, W / 2, 470, '#ffd23f', 14);
    const sy = H - 330;
    c.fillStyle = '#ffffff'; c.strokeStyle = INKC; c.lineWidth = 7;
    c.beginPath(); c.ellipse(W / 2, sy, 420, 110, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(W / 2 - 160, sy + 92); c.lineTo(W / 2 - 250, sy + 190); c.lineTo(W / 2 - 80, sy + 104); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; c.fillRect(W / 2 - 170, sy + 78, 100, 30);
    c.fillStyle = INKC; fit(m.line + '!', '700 44px Barlow, sans-serif', 740); c.fillText(m.line + '!', W / 2, sy + 16);
    nameY = H - 100; toY = 600; footer = INKC;
  } else if (style === 'minimal') {
    c.fillStyle = 'rgba(2,14,9,0.6)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffc857'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 120, H / 2 + 30); c.lineTo(W / 2 + 120, H / 2 + 30); c.stroke();
    c.fillStyle = '#fff4e2'; fit(m.hi, '104px "Yatra One", sans-serif', W - 140); c.fillText(m.hi, W / 2, H / 2 - 30);
    c.font = '600 40px "Chakra Petch", sans-serif'; c.fillStyle = '#ffc857'; spaced(m.en, W / 2, H / 2 + 100, 16);
    c.font = 'italic 34px Barlow, sans-serif'; c.fillStyle = '#d6e6e0'; c.fillText(m.line, W / 2, H / 2 + 160);
    nameY = H / 2 + 250; toY = H / 2 - 190;
  } else if (style === 'lotus') {
    const g = c.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, H * 0.7);
    g.addColorStop(0, 'rgba(2,20,13,0.55)'); g.addColorStop(1, 'rgba(2,14,9,0.92)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffd36b'; c.lineWidth = 3; c.setLineDash([2, 12]); c.lineCap = 'round';
    c.beginPath(); c.arc(W / 2, H * 0.47, 430, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.lineWidth = 2; c.beginPath(); c.arc(W / 2, H * 0.47, 400, 0, Math.PI * 2); c.stroke();
    lotus(c, W / 2, H * 0.62, 190);
    c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 20;
    c.fillStyle = '#ffd36b'; fit(m.hi, '112px "Yatra One", sans-serif', 760); c.fillText(m.hi, W / 2, H * 0.36);
    c.fillStyle = '#fff4e2'; c.font = '600 46px "Chakra Petch", sans-serif'; spaced(m.en, W / 2, H * 0.36 + 80, 12);
    c.font = 'italic 34px Barlow, sans-serif'; c.fillStyle = '#d6e6e0'; c.fillText(m.line, W / 2, H * 0.36 + 136);
    c.shadowBlur = 0; nameY = H - 130; toY = 120;
  } else {
    c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 24;
    shade(0, H * 0.45, 0.7, 0); shade(H * 0.62, H, 0, 0.88);
    const hm = style === 'green' && settings.cardMsg === 'diwali' ? CARD_MSGS.green : m;
    c.fillStyle = '#ffc857'; fit(hm.hi, '128px "Yatra One", "Noto Sans Devanagari", sans-serif', W - 120); c.fillText(hm.hi, W / 2, 220);
    c.fillStyle = '#fff4e2'; fit(hm.en, '700 64px "Chakra Petch", sans-serif', W - 140); spaced(hm.en, W / 2, 312, 12);
    c.shadowBlur = 0;
  }
  if (style === 'rangoli') {
    c.strokeStyle = '#ffc857'; c.lineWidth = 6; c.strokeRect(28, 28, W - 56, H - 56); c.lineWidth = 2; c.strokeRect(46, 46, W - 92, H - 92);
    for (const [x, y] of [[46, 46], [W - 46, 46], [46, H - 46], [W - 46, H - 46]]) {
      petalRing(c, x, y, 120, 12, '#ff4f8b', 16, INKC); petalRing(c, x, y, 84, 10, '#ffcc33', 12, INKC); petalRing(c, x, y, 52, 8, '#2ecc71', 10, INKC);
      c.fillStyle = '#ff9933'; c.beginPath(); c.arc(x, y, 18, 0, Math.PI * 2); c.fill(); c.strokeStyle = INKC; c.lineWidth = 3; c.stroke();
    }
    c.font = 'italic 500 38px Barlow, sans-serif'; c.fillStyle = '#ffe2b0'; c.fillText(m.line, W / 2, 380);
    toY = 110;
  } else if (style === 'diya') {
    const g = c.createRadialGradient(W / 2, H, 0, W / 2, H, H * 0.7); g.addColorStop(0, 'rgba(255,150,50,0.35)'); g.addColorStop(1, 'rgba(255,150,50,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) cardDiya(c, W * (0.14 + i * 0.18), H - 250 + Math.abs(i - 2) * 22, 1.5 - Math.abs(i - 2) * 0.15);
    c.font = 'italic 500 38px Barlow, sans-serif'; c.fillStyle = '#ffe2b0'; c.fillText(m.line, W / 2, 380);
    nameY = H - 110;
  } else if (style === 'classic') {
    c.font = 'italic 500 38px Barlow, sans-serif'; c.fillStyle = '#ffe2b0'; c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 16; c.fillText(m.line, W / 2, 380); c.shadowBlur = 0;
  } else if (style === 'green') {
    const t = impact.total, got = BADGES.filter((x) => earned(x, t));
    const g = c.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(4,30,22,0)'); g.addColorStop(0.35, 'rgba(4,30,22,0.82)'); g.addColorStop(1, 'rgba(3,18,14,0.96)');
    c.fillStyle = g; c.fillRect(0, H * 0.45, W, H * 0.55);
    const top = H - 640;
    c.fillStyle = '#2ee59d'; c.font = '600 32px "Chakra Petch", sans-serif'; spaced('THIS DIWALI I SAVED', W / 2, top, 8);
    c.shadowColor = 'rgba(46,229,157,0.6)'; c.shadowBlur = 30;
    c.fillStyle = '#ffffff'; c.font = '700 150px "Chakra Petch", sans-serif'; c.fillText(fmtG(Math.max(t.co2, 0)), W / 2, top + 150);
    c.shadowBlur = 0;
    c.fillStyle = '#c9f5e2'; c.font = '600 40px "Chakra Petch", sans-serif'; spaced('OF CO₂ · ZERO SMOKE', W / 2, top + 210, 6);
    const cells = [['🚬', `${Math.round(t.smoke)}`, "cigarettes' smoke"], ['🚗', `${(t.co2 / 120).toFixed(1)} km`, 'of car CO₂'], ['🎆', `${t.count}`, 'crackers, no pollution']];
    cells.forEach(([icon, v, l], i) => {
      const cx = W / 2 + (i - 1) * 300, cy = top + 300;
      c.fillStyle = 'rgba(46,229,157,0.14)'; c.fillRect(cx - 135, cy - 50, 270, 140);
      c.strokeStyle = '#2ee59d'; c.lineWidth = 3; c.strokeRect(cx - 135, cy - 50, 270, 140);
      c.font = '40px sans-serif'; c.fillText(icon, cx, cy);
      c.fillStyle = '#ffffff'; c.font = '600 40px "Share Tech Mono", monospace'; c.fillText(v, cx, cy + 50);
      c.fillStyle = '#a9d9c6'; c.font = '26px Barlow, sans-serif'; c.fillText(l, cx, cy + 80);
    });
    if (got.length) { c.font = '52px sans-serif'; c.fillText(got.map((x) => x.icon).join(' '), W / 2, top + 470); }
    c.fillStyle = '#ffc857'; c.font = 'italic 500 36px Barlow, sans-serif'; c.fillText('Join me: celebrate with light, not smoke 🪔', W / 2, top + 530);
    nameY = H - 115;
  }
  if (to) {
    c.font = 'italic 500 42px Barlow, sans-serif';
    if (style === 'comic') inkText(c, `Dear ${to},`, W / 2, toY, '#ffffff', 9);
    else { c.fillStyle = '#ffe2b0'; c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 14; c.fillText(`Dear ${to},`, W / 2, toY); c.shadowBlur = 0; }
  }
  if (name) {
    c.font = '500 50px Barlow, sans-serif';
    if (style === 'comic') inkText(c, 'with love from ' + name, W / 2, nameY, '#ffd23f', 10);
    else { c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 16; c.fillStyle = '#ffe2b0'; c.fillText('with love from ' + name, W / 2, nameY); c.shadowBlur = 0; }
  }
  c.font = '28px "Share Tech Mono", monospace'; c.fillStyle = footer;
  c.fillText('Made with Patakha · ARTIN Studios', W / 2, H - (style === 'comic' ? 40 : 64));
  c.restore();
}
function renderCardStyles() {
  const box = $('#cardStyles'); box.innerHTML = '';
  for (const [id, label] of Object.entries(CARD_STYLES)) {
    const b = document.createElement('button');
    b.textContent = label; b.setAttribute('aria-pressed', String(settings.cardStyle === id));
    b.addEventListener('click', () => { settings.cardStyle = id; if (id === 'green') settings.cardMsg = 'green'; save(); renderCardStyles(); drawCard(); });
    box.appendChild(b);
  }
  const mb = $('#cardMsgs'); mb.innerHTML = '';
  for (const [id, mm] of Object.entries(CARD_MSGS)) {
    const b = document.createElement('button');
    b.textContent = mm.label; b.setAttribute('aria-pressed', String(settings.cardMsg === id));
    b.addEventListener('click', () => { settings.cardMsg = id; save(); renderCardStyles(); drawCard(); });
    mb.appendChild(b);
  }
}
async function openCard() {
  Audio.unlock();
  // light up the sky first if it's quiet, so every card has fireworks
  if (world.sparks.n < 300) {
    const cols = ['violet', 'gold', 'green', 'red', 'blue'], f = player.forward(new THREE.Vector3()).setY(0).normalize(), r = player.right(new THREE.Vector3());
    for (let i = 0; i < 3; i++) {
      const p = player.pos.clone().addScaledVector(f, 30).addScaledVector(r, (i - 1) * 14); p.y = player.pitch > 0.3 ? 30 : 16 + Math.random() * 6;
      const col = cols[Math.floor(Math.random() * cols.length)];
      world.burst(p, { type: i === 1 ? 'willow' : 'peony', colour: col, size: 0.75 }, PALETTES[col], null, 1.3);
    }
    await new Promise((r) => setTimeout(r, 650));
  }
  takeSnapshot();
  await Promise.all(['128px "Yatra One"', '700 86px "Chakra Petch"', '700 44px Barlow', 'italic 500 38px Barlow', '700 64px "Chakra Petch"', '500 50px Barlow', '28px "Share Tech Mono"'].map((f) => document.fonts.load(f, 'शुभ दीपावली HAPPY').catch(() => {})));
  if (!CARD_STYLES[settings.cardStyle]) settings.cardStyle = 'green';
  renderCardStyles();
  drawCard();
  openSheet('#card');
}
$('#btnCard').addEventListener('click', openCard);
$('#cardName').addEventListener('input', drawCard);
$('#cardTo').addEventListener('input', drawCard);
$('#btnCardShare').addEventListener('click', () => {
  $('#cardCanvas').toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'patakha-diwali.png', { type: 'image/png' });
    try {
      if (NATIVE?.shareImage) {
        const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
        NATIVE.shareImage(b64);
      } else if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Green Diwali', text: `शुभ दीपावली! 🪔 This Diwali I saved ${fmtG(impact.total.co2)} of CO₂ and the smoke of ${Math.round(impact.total.smoke)} cigarettes by bursting crackers on Patakha instead. Join me for a smoke-free Diwali 🌱` });
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('Card saved to your downloads');
      }
    } catch (e) { if (e?.name !== 'AbortError') toast('Could not share the card'); }
  }, 'image/png');
});



// ------------------------------------------------------------------ first-run tutorial
// Like a game's first level: walk, look, place, light, step back. Each step waits for you to do it.
let tut = null;
const TUT = [
  { text: 'Slide on the joystick to walk.', side: 'left', done: (t) => t.moved > 1.2 || actives.length > 0 },
  { text: 'Slide here to look around.', side: 'right', done: () => lookDX + lookDY > 0.45 || actives.length > 0 },
  { text: 'Press PLACE to set an Anar down in front of you.', point: '#btnAct', done: () => actives.some((c) => !c.spent && !c.lit) },
  { text: 'Press LIGHT. Your agarbatti lights the fuse.', point: '#btnAct', done: () => actives.some((c) => c.lit) },
  { text: 'Step back and enjoy! Never stand over a lit cracker.', side: 'left', done: (t) => t.time > 5 },
];
function startTutorial() {
  closeSheet('#settings');
  settings.sel = 'anar'; settings.mode = 'place'; save(); refreshTray(); setMode('place');
  tut = { step: -1, moved: 0, time: 0, last: player.pos.clone() };
  $('#tut').hidden = false;
  nextTutStep();
}
function nextTutStep() {
  tut.step++; tut.time = 0; lookDX = lookDY = 0;
  const st = TUT[tut.step];
  if (!st) { endTutorial(true); return; }
  Audio.tick(); Haptics.tap(8);
  $('#tutText').textContent = st.text;
  const shade = $('#tutShade'), ring = $('#tutRing'), hand = $('#tutHand');
  shade.className = 'tut-shade' + (st.side ? ' ' + st.side : '');
  ring.hidden = !st.point; hand.classList.remove('slide', 'tap');
  if (st.point) {
    const r = $(st.point).getBoundingClientRect();
    Object.assign(ring.style, { left: r.left - 8 + 'px', top: r.top - 8 + 'px', width: r.width + 16 + 'px', height: r.height + 16 + 'px' });
    Object.assign(hand.style, { left: r.left + r.width * 0.45 + 'px', top: r.top + r.height * 0.55 + 'px' });
    hand.classList.add('tap');
  } else if (st.side) {
    const j = joyEl.getBoundingClientRect();
    Object.assign(hand.style, st.side === 'left' ? { left: j.left + j.width * 0.45 + 'px', top: j.top + j.height * 0.4 + 'px' } : { left: window.innerWidth * 0.68 + 'px', top: window.innerHeight * 0.45 + 'px' });
    hand.classList.add('slide');
  }
  hand.style.display = tut.step === TUT.length - 1 ? 'none' : '';
}
function stepTutorial(dt) {
  if (!tut) return;
  tut.time += dt;
  tut.moved += player.pos.distanceTo(tut.last); tut.last.copy(player.pos);
  if (TUT[tut.step].done(tut)) nextTutStep();
}
function endTutorial(finished) {
  tut = null; $('#tut').hidden = true;
  ls.set('tutorial', true);
  if (!finished) return;
  const items = [['🎆', 'First cracker lit', 'Zero smoke'], ['🌱', 'Seedling', 'Green badge']];
  if (Store.grant('rainbow')) items.unshift(['🌈', 'Rainbow Anar', 'Free for 24 hours']);
  $('#rewItems').innerHTML = items.map(([i, b, sm]) => `<div class="rew-item"><i aria-hidden="true">${i}</i><b>${b}</b><small>${sm}</small></div>`).join('');
  $('#reward').hidden = false; Haptics.tap(30);
}
$('#tutSkip').addEventListener('click', () => { Audio.tick(); endTutorial(false); hint('Press Place to set a cracker down', true); });
$('#rewGo').addEventListener('click', () => { Audio.tick(); $('#reward').hidden = true; refreshTray(); hint('Open the Shop for more crackers', true); });

// ------------------------------------------------------------------ first launch: privacy
function needConsent(then) {
  if (ls.get('consented', false)) { then(); return; }
  $('#consent').hidden = false;
  $('#consentGo').onclick = () => { Audio.unlock(); Audio.tick(); ls.set('consented', true); $('#consent').hidden = true; then(); };
}

// ------------------------------------------------------------------ home: map select
const thumbs = {};
function renderMaps() {
  const box = $('#maps'); box.innerHTML = '';
  for (const [id, m] of Object.entries(MAPS)) {
    const b = document.createElement('button');
    b.className = 'map cut'; b.dataset.id = id; b.setAttribute('aria-pressed', String(id === settings.map));
    b.innerHTML = `<span class="thumb">${thumbs[id] ? `<img src="${thumbs[id]}" alt="" />` : ''}</span><b>${m.name}</b><span class="hi" lang="hi">${m.hi}</span>`;
    b.addEventListener('click', () => pickMap(id));
    box.appendChild(b);
  }
}
function pickMap(id) {
  Audio.unlock(); Audio.tick();
  if (id !== settings.map || world.mapId !== id) { settings.map = id; save(); loadMap(id); }
  renderMaps();
}
function loadMap(id) {
  clearAll();
  world.load(id);
  player.spawn(world.b.spawn);
}
/** Paints a small picture of every map for the picker (once, at start). */
function makeThumbs() {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
  const c = cv.getContext('2d');
  for (const id of Object.keys(MAPS)) {
    world.load(id);
    const s = world.b.spawn;
    player.pos.set(s.x, 0, s.z); player.yaw = s.yaw || 0; player.pitch = 0.1; player.apply();
    world.time = 3; world.update(0.016, null, 0);
    world.burst(new THREE.Vector3(s.x - 6, 22, s.z - 30), { type: 'peony', size: 0.7 }, PALETTES.gold, PALETTES.violet, 1.4);
    for (let i = 0; i < 8; i++) world.update(0.05, null, 0);
    world.render();
    const src = world.renderer.domElement, k = Math.max(320 / src.width, 180 / src.height);
    c.drawImage(src, (src.width - 320 / k) / 2, (src.height - 180 / k) / 2, 320 / k, 180 / k, 0, 0, 320, 180);
    thumbs[id] = cv.toDataURL('image/jpeg', 0.8);
  }
}
function showHome() {
  if (tut) endTutorial(false);
  playing = false; setLighter(false); lighting = null; dropHeld();
  $('#hud').hidden = true; $('#home').hidden = false; $('#rotate').hidden = true; $('#micPill').hidden = true;
  if (Mic.on) { Mic.stop(); $('#btnDiya').setAttribute('aria-pressed', 'false'); }
  player.move.x = player.move.y = 0; joy = null; knob.style.transform = '';
  renderMaps();
  if (ls.get('consented', false)) Store.setBanner(true); // the only place a banner ever shows
}
function startGame() {
  Audio.unlock(); Audio.tick(); Haptics.tap(10);
  if (world.mapId !== settings.map) loadMap(settings.map);
  player.spawn(world.b.spawn);
  $('#home').hidden = true; $('#hud').hidden = false; playing = true;
  NATIVE?.setLandscape?.(true);
  resize();
  Store.setBanner(false); // no ads while you play
  if (!ls.get('tutorial', false)) startTutorial();
  else hint('Press Place to set a cracker down', true);
}
$('#btnStart').addEventListener('click', startGame);
$('#btnMenu').addEventListener('click', () => { Audio.tick(); showHome(); });
$('#homeSettings').addEventListener('click', () => { Audio.unlock(); openSettings(); });
$('#homeImpact').addEventListener('click', () => { renderImpact(); openSheet('#impact'); });

// ------------------------------------------------------------------ green impact
let impKey = 'tonight';
function renderImpact() {
  const t = impact[impKey], pm = t.pm, n = nextStep(impact.total.co2);
  const k = n ? (impact.total.co2 - n.from) / (n.to - n.from) : 1;
  $('#impHero').innerHTML = `<div class="big-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3"/><circle cx="18" cy="18" r="15" fill="none" stroke="#2ee59d" stroke-width="3" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="${94.25 * (1 - k)}"/></svg><div><b>${fmtG(t.co2)}</b><span>CO₂ saved</span></div></div>
    <div><h4>${t.count ? (impKey === 'tonight' ? 'Tonight you kept the air clean' : 'Your Green Diwali so far') : 'Light a cracker to start saving'}</h4>
    <p>${t.count ? `${t.count} crackers, zero smoke. That's ${fmtG(t.co2)} of CO₂ and the smoke of <b>${Math.round(t.smoke)} cigarettes</b> that nobody had to breathe.` : 'Every cracker you light here is one real cracker that stays out of the air.'}
    ${n ? `<br/><span class="muted">Next badge: ${n.badge.icon} ${n.badge.name} at ${fmtG(n.to)}.</span>` : ''}</p></div>`;
  const km = t.co2 / 120, phones = t.co2 / 8, treeDays = t.co2 / 58;
  const fmt = (v) => (v >= 10 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(1));
  $('#impEquiv').innerHTML = [
    ['🚬', Math.round(t.smoke), "cigarettes' smoke nobody breathed"],
    ['🚗', fmt(km) + ' km', 'of car driving, in CO₂'],
    ['📱', fmt(phones), 'phone charges, in CO₂'],
    ['🌳', fmt(treeDays), "days of a tree's work"],
  ].map(([i, v, l]) => `<div><i aria-hidden="true">${i}</i><p style="margin:0"><b>${v}</b><span>${l}</span></p></div>`).join('');
  $('#impBadges').innerHTML = BADGES.map((b) => `<div class="badge${earned(b, impact.total) ? ' got' : ''}"><i aria-hidden="true">${b.icon}</i><b>${b.name}</b><span>${b.need}</span></div>`).join('');
  const notes = [];
  if (pm) {
    notes.push(`<p>Air quality: the smokiest of your crackers would have pushed PM2.5 next to you to about <b>${pm.toLocaleString('en-IN')} µg/m³</b>. That is <b>${Math.round(pm / 250)}×</b> the level where India's AQI turns <b>Severe</b> (250 µg/m³), and <b>${Math.round(pm / 60)}×</b> India's safe limit (60 µg/m³ over 24 hours). The spike is short, but it goes straight into the lungs of whoever is standing closest, often children.</p>`);
    notes.push('<div class="aqi" aria-hidden="true"><i style="background:#3fbf5f"></i><i style="background:#9acd32"></i><i style="background:#f2d335"></i><i style="background:#f29a2e"></i><i style="background:#e8452e"></i><i style="background:#8b1a3a"></i></div>');
  }
  if (t.loud) notes.push(`<p>You also spared your street <b>${t.loud} loud bang${t.loud === 1 ? '' : 's'}</b> that frighten babies, older people, patients and animals. India limits cracker noise to 125 dB(AI) measured 4 m away, and big bombs often go past it.</p>`);
  $('#impNotes').innerHTML = notes.join('');
  document.querySelectorAll('#impSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === impKey)));
}
$('#btnShareImpact').addEventListener('click', () => { closeSheet('#impact'); settings.cardStyle = 'green'; save(); openCard(); });
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

// ------------------------------------------------------------------ current cracker
function refreshTray() {
  const def = byId[settings.sel];
  $('#curArt').innerHTML = ICONS[def.id];
  $('#curName').textContent = def.name;
  const vd = withVariant(def);
  $('#curVar').textContent = def.variants ? def.variants.find((x) => x.id === vd.variant)?.name || '' : def.hi;
  $('#btnCur').classList.toggle('locked', Store.locked(def.id));
}
function select(id, user = false) {
  const def = byId[id];
  if (user) { Audio.unlock(); Audio.tick(); Haptics.tap(6); }
  if (Store.locked(id)) { openUnlock(def); return; }
  settings.sel = id; save();
  refreshTray();
  if (!$('#variantBar').hidden) renderVariants();
  if (user) {
    if (def.kind === 'phuljhadi' && settings.mode === 'place') setMode('hold');
    if (def.kind !== 'phuljhadi' && settings.mode === 'hold') setMode('place');
    hint(def.kind === 'phuljhadi' ? `Press Hold to take a ${def.name} in your hand` : `Look at the ground and press Place to set down the ${def.name}`, true);
  }
  lastAct = '';
  Audio.warm(withVariant(def));
}
function renderVariants() {
  const def = byId[settings.sel], bar = $('#variantBar');
  if (!def?.variants) { bar.hidden = true; return; }
  const cur = withVariant(def).variant;
  bar.innerHTML = `<span class="vb-label">${def.name}</span>` + def.variants.map((v) => `<button data-v="${v.id}" aria-pressed="${v.id === cur}"><i style="background:${v.sw}"></i>${v.name}</button>`).join('');
  bar.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    settings.variants[def.id] = b.dataset.v; save(); Audio.tick(); Haptics.tap(5);
    renderVariants(); refreshTray(); Audio.warm(withVariant(def));
    setTimeout(() => { bar.hidden = true; }, 250);
  }));
  bar.hidden = false;
}
$('#btnCur').addEventListener('click', () => {
  Audio.unlock(); Audio.tick();
  const def = byId[settings.sel];
  if (!def.variants) { renderBox(); openSheet('#box'); return; }
  if ($('#variantBar').hidden) renderVariants(); else $('#variantBar').hidden = true;
});
$('#btnShop').addEventListener('click', () => { Audio.unlock(); Audio.tick(); renderBox(); openSheet('#box'); });

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
const sheets = ['#settings', '#box', '#unlock', '#impact', '#about', '#card', '#manual'];
function openSheet(sel) { $(sel).hidden = false; player.move.x = player.move.y = 0; }
function closeSheet(sel) { $(sel).hidden = true; }
function sheetOpen() { return sheets.some((s) => !$(s).hidden); }
document.querySelectorAll('.sheet-wrap').forEach((w) => {
  w.addEventListener('click', (e) => { if (e.target === w) w.hidden = true; });
  w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { w.hidden = true; }));
});
/** Android back button: close the top sheet, then go back to the map select; false = leave the app. */
window.artinBack = () => {
  for (const s of sheets.slice().reverse()) if (!$(s).hidden) { closeSheet(s); return true; }
  if (!$('#reward').hidden) { $('#rewGo').click(); return true; }
  if (tut) { endTutorial(false); return true; }
  if (!$('#variantBar').hidden) { $('#variantBar').hidden = true; return true; }
  if (playing) { showHome(); return true; }
  return false;
};

// settings
function seg(sel, val, fn) {
  const el = $(sel);
  el.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.v === val));
    b.onclick = () => { fn(b.dataset.v); el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); Audio.tick(); };
  });
}
function setTab(name) {
  document.querySelectorAll('#setTabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  document.querySelectorAll('#settings .tab').forEach((t) => { t.hidden = t.dataset.tab !== name; });
}
document.querySelectorAll('#setTabs [role=tab]').forEach((b) => b.addEventListener('click', () => { Audio.tick(); setTab(b.dataset.tab); }));
function openSettings() {
  $('#optVol').value = settings.vol; $('#optVib').checked = settings.vib; $('#optVibK').value = settings.vibK;
  $('#optTorch').checked = Torch.active; $('#optAmbient').checked = settings.ambient; $('#optShake').checked = settings.shake;
  $('#optVib').disabled = !Haptics.supported; $('#optMic').value = settings.micSens;
  $('#optBob').checked = settings.bob; $('#optFps').checked = settings.fps; $('#optLook').value = settings.look; $('#optInvert').checked = settings.invert;
  $('#optShakeLight').checked = settings.shakeLight; $('#optEasy').checked = settings.easyAim;
  seg('#optQuality', settings.quality, setQuality);
  seg('#optLighter', settings.lighter, (v) => { settings.lighter = v; save(); lighter.setKind(v); });
  $('#torchNote').textContent = NATIVE ? '' : Torch.possible
    ? 'Flashlight bursts use the camera flash (Chrome on Android). Your browser will ask for camera permission. The camera image is never used.'
    : 'Flashlight bursts need a phone with a flash, in Chrome on Android, or the Patakha app.';
  renderShop();
  openSheet('#settings');
}
function setQuality(q) {
  settings.quality = q; save();
  world.setQuality(q);
  // particle budgets and lights are set when a map loads
  const p = player.pos.clone(), yaw = player.yaw, pitch = player.pitch;
  loadMap(world.mapId);
  if (playing) { player.pos.copy(p); player.yaw = yaw; player.pitch = pitch; player.apply(); }
}
$('#btnSettings').addEventListener('click', () => { Audio.unlock(); openSettings(); });
$('#optVol').addEventListener('input', (e) => { settings.vol = +e.target.value; Audio.setVolume(settings.vol); save(); });
$('#optVib').addEventListener('change', (e) => { settings.vib = e.target.checked; Haptics.enabled = settings.vib; if (!settings.vib) Haptics.stop(); else Haptics.tap(20); save(); });
$('#optVibK').addEventListener('change', (e) => { settings.vibK = +e.target.value; Haptics.intensity = settings.vibK; Haptics.tap(30); save(); });
$('#optTorch').addEventListener('change', (e) => setTorch(e.target.checked));
$('#optAmbient').addEventListener('change', (e) => { settings.ambient = e.target.checked; save(); });
$('#optShake').addEventListener('change', (e) => { settings.shake = e.target.checked; world.shakeOn = settings.shake; save(); });
$('#optBob').addEventListener('change', (e) => { settings.bob = e.target.checked; player.bobOn = settings.bob; save(); });
$('#optFps').addEventListener('change', (e) => { settings.fps = e.target.checked; $('#fps').hidden = !settings.fps; save(); });
$('#optLook').addEventListener('input', (e) => { settings.look = +e.target.value; save(); });
$('#optInvert').addEventListener('change', (e) => { settings.invert = e.target.checked; save(); });
$('#optEasy').addEventListener('change', (e) => { settings.easyAim = e.target.checked; save(); });
$('#btnTutorial').addEventListener('click', () => { if (!playing) startGame(); startTutorial(); });
$('#optShakeLight').addEventListener('change', (e) => { settings.shakeLight = e.target.checked; save(); });
$('#optMic').addEventListener('input', (e) => { settings.micSens = +e.target.value; Mic.sensitivity = settings.micSens; save(); });

// phone flashlight bursts
async function setTorch(on) {
  if (on) {
    try { await Torch.enable(); Torch.flash(160); settings.torch = true; } catch (err) { settings.torch = false; toast(err.message || 'Flashlight not available'); }
  } else { Torch.disable(); settings.torch = false; }
  save();
  $('#optTorch').checked = Torch.active;
}

// diyas + microphone
$('#btnDiya').addEventListener('click', async () => {
  const ctx = Audio.unlock();
  if (Mic.on) { Mic.stop(); $('#micPill').hidden = true; $('#btnDiya').setAttribute('aria-pressed', 'false'); return; }
  try {
    await Mic.start(ctx);
    if (!world.litDiyas) { world.diyas.forEach((d) => { d.lit = true; }); Audio.strike(); }
    $('#micPill').hidden = false; $('#btnDiya').setAttribute('aria-pressed', 'true');
  } catch {
    toast('Microphone unavailable. You can still light diyas with your lighter.');
  }
});

// shake the phone to light the cracker you are looking at
let lastShake = 0;
window.addEventListener('devicemotion', (e) => {
  if (!settings.shakeLight || !playing) return;
  const a = e.acceleration?.x != null ? e.acceleration : e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  const g = e.acceleration?.x != null ? 0 : 9.8, m = Math.abs(Math.hypot(a.x, a.y, a.z) - g), now = performance.now();
  if (m > 16 && now - lastShake > 900) { lastShake = now; if (target?.kind === 'cracker') startLighting(target); }
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
  if (e.target.closest?.('input')) return;
  const k = e.key.toLowerCase();
  if (!playing) { if (k === 'enter' && !sheetOpen()) startGame(); return; }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { player.keys.add(k); e.preventDefault(); return; }
  if (sheetOpen()) return;
  if (k === 'm') $('#btnMute').click();
  if (k === 'c') $('#btnClear').click();
  if (k === 'f') $('#btnTorch').click();
  if (k === 'l') $('#btnLighter').click();
  if (k === 'q') { const ms = ['place', 'hold', 'pick']; setMode(ms[(ms.indexOf(settings.mode) + 1) % 3]); }
  if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); if (!e.repeat) act(); }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9 && CRACKERS[n - 1]) select(CRACKERS[n - 1].id, true);
});
window.addEventListener('keyup', (e) => player.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => player.keys.clear());

// ------------------------------------------------------------------ lifecycle
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Haptics.stop(); Audio.ctx?.suspend(); player.keys.clear(); } else Audio.ctx?.resume();
});

async function prewarm() {
  const order = [byId[settings.sel], ...CRACKERS.filter((c) => c.free && c.id !== settings.sel)];
  for (const d of order) { await Audio.variant(withVariant(d)); await new Promise((r) => setTimeout(r, 30)); }
  await Audio.variant(DISTANT);
}

function start() {
  Haptics.enabled = settings.vib; Haptics.intensity = settings.vibK; Audio.setVolume(settings.vol);
  Mic.sensitivity = settings.micSens; setMuted(settings.muted);
  lighter.setKind(settings.lighter); player.bobOn = settings.bob; world.shakeOn = settings.shake;
  $('#fps').hidden = !settings.fps;
  updateEcoMeter(); refreshTray(); setMode(settings.mode);
  makeThumbs();
  loadMap(settings.map);
  resize();
  requestAnimationFrame((t) => { last = t; frame(t); });
  prewarm();
  fetch('version.json').then((r) => r.json()).then((v) => { $('#verLine').textContent = `v${v.version} · build ${v.versionCode}`; }).catch(() => {});
  if (NATIVE && settings.torch) setTorch(true);
  NATIVE?.setLandscape?.(true);
  const splash = $('#splash');
  setTimeout(() => {
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 300);
    needConsent(showHome);
  }, 1300);
}

if ('serviceWorker' in navigator && !NATIVE && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
// test hook for automated tests: ?debug
if (new URLSearchParams(location.search).has('debug')) window.__patakha = { world, player, lighter, actives: () => actives, act, setMode, select, startGame, target: () => target };
start();
