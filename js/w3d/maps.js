// The 3D maps: a mohalla lane, a housing society, a village chowk and a green
// park. Built from low-poly blocks in code. Static parts are merged per
// material, so a whole map draws in a few dozen calls.

import * as THREE from '../vendor/three.module.min.js';
import { toon, glow, flat, rangoliTexture } from './art.js';
import { rng } from '../synth.js';

export const MAPS = {
  gali: { name: 'Mohalla Gali', hi: 'मोहल्ला', sky: [[0, '#02040e'], [0.55, '#0a1430'], [0.8, '#2a1e44'], [1, '#5a2d3c']], fog: '#0b0f22', ground: '#24262c' },
  society: { name: 'Society', hi: 'सोसाइटी', sky: [[0, '#01030b'], [0.55, '#07142a'], [0.8, '#182a46'], [1, '#3c3550']], fog: '#0a1222', ground: '#2a2c30' },
  village: { name: 'Village Chowk', hi: 'गाँव', sky: [[0, '#01030c'], [0.55, '#06122e'], [0.8, '#13284e'], [1, '#2d3456']], fog: '#0a1226', ground: '#4a3424' },
  green: { name: 'Green Park', hi: 'हरित पार्क', sky: [[0, '#010806'], [0.55, '#03201a'], [0.8, '#0b3a30'], [1, '#1f5a44']], fog: '#06160f', ground: '#173a22' },
};

const PASTEL = ['#3fb8a8', '#f28fb0', '#f4c64d', '#9fd36b', '#f2a07b', '#b29ae6', '#7ec8f0', '#f5e6c8', '#ef6f5e', '#62c6d8'];
const TORAN = ['#ff4b4b', '#ffd23f', '#53ff8f', '#5aa9ff', '#ff5ec4', '#ffffff'];

/** Collects a map's parts while it is being built. */
class Builder {
  constructor(seed) {
    this.r = rng(seed);
    this.statics = []; this.dynamic = new THREE.Group();
    this.colliders = []; this.bulbs = []; this.lamps = []; this.diyas = []; this.props = []; this.turbines = [];
    this.spawn = { x: 0, z: 8, yaw: 0 };
  }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  add(geom, color, x, y, z, { ry = 0, rx = 0, rz = 0, emissive = false } = {}) {
    const m = new THREE.Mesh(flat(geom), emissive ? glow(color) : toon(color));
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    this.statics.push(m);
    return m;
  }
  box(w, h, d, x, y, z, color, o) { return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, o); }
  cyl(rt, rb, h, seg, x, y, z, color, o) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z, o); }
  cone(r, h, seg, x, y, z, color, o) { return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, o); }
  ico(r, x, y, z, color, detail = 0) { return this.add(new THREE.IcosahedronGeometry(r, detail), color, x, y, z); }
  collide(x0, x1, z0, z1) { this.colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }); }
  /** A drooping string of toran bulbs between two points. */
  toran(a, b, sag = 0.6, step = 0.45) {
    const n = Math.max(3, Math.round(a.distanceTo(b) / step));
    for (let k = 0; k <= n; k++) {
      const t = k / n, p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      this.bulbs.push({ p, c: TORAN[k % TORAN.length], ph: k });
    }
  }
}

// ------------------------------------------------------------------ building blocks
/** An Indian town house: painted walls, floor bands, windows, a door with a toran, balconies, a water tank. */
function house(b, cx, cz, w, d, floors, face, color) {
  const fh = 3, H = floors * fh, fx = cx + face * d / 2;
  b.box(d, H, w, cx, 0, cz, color);
  b.collide(cx - d / 2 - 0.1, cx + d / 2 + 0.1, cz - w / 2 - 0.1, cz + w / 2 + 0.1);
  const trim = '#f3ead8';
  for (let f = 1; f <= floors; f++) b.box(0.12, 0.18, w + 0.06, fx + face * 0.03, f * fh - 0.18, cz, trim);
  // parapet + water tank
  b.box(d, 0.7, 0.18, cx, H, cz - w / 2 + 0.09, color); b.box(d, 0.7, 0.18, cx, H, cz + w / 2 - 0.09, color);
  b.box(0.18, 0.7, w, fx - face * 0.09, H, cz, color); b.box(0.18, 0.7, w, cx - face * d / 2 + face * 0.09, H, cz, color);
  if (b.r() < 0.7) b.cyl(0.55, 0.55, 1.1, 8, cx - face * d * 0.15, H, cz + (b.r() - 0.5) * w * 0.4, b.pick(['#1b1f24', '#2f6fb0', '#f2f2f2']));
  // toran lights along the roof edge
  b.toran(new THREE.Vector3(fx + face * 0.15, H + 0.75, cz - w / 2), new THREE.Vector3(fx + face * 0.15, H + 0.75, cz + w / 2), 0.25);
  // ground floor: door, step, marigold toran, two diyas
  const dz = cz + (b.r() - 0.5) * w * 0.3;
  b.box(0.08, 2.1, 1.1, fx + face * 0.04, 0, dz, '#5a2a14');
  b.box(0.1, 0.12, 1.4, fx + face * 0.06, 2.1, dz, trim);
  for (let k = 0; k < 7; k++) b.ico(0.07, fx + face * 0.14, 2.02 - Math.sin((k / 6) * Math.PI) * 0.12, dz - 0.6 + k * 0.2, k % 2 ? '#ff9a1a' : '#ffd23f');
  b.box(0.6, 0.18, 1.6, fx + face * 0.3, 0, dz, '#9a9488');
  b.diyas.push(new THREE.Vector3(fx + face * 0.42, 0.18, dz - 0.62), new THREE.Vector3(fx + face * 0.42, 0.18, dz + 0.62));
  // windows on every floor
  for (let f = 0; f < floors; f++) {
    const nw = w > 5.5 ? 2 : 1;
    for (let k = 0; k < nw; k++) {
      const wz = cz + (nw === 1 ? (f === 0 ? (dz > cz ? -1 : 1) * w * 0.25 : 0) : (k - 0.5) * w * 0.45), wy = f * fh + 1.0;
      if (f === 0 && Math.abs(wz - dz) < 1.2) continue;
      b.box(0.1, 1.3, 1.1, fx + face * 0.02, wy - 0.05, wz, trim);
      b.box(0.1, 1.1, 0.9, fx + face * 0.06, wy + 0.05, wz, b.r() < 0.72 ? '#ffcf7a' : '#1c2733', { emissive: true });
    }
    if (f > 0 && b.r() < 0.55) { // balcony
      b.box(1.0, 0.15, w * 0.6, fx + face * 0.5, f * fh, cz, trim);
      for (let k = 0; k <= 6; k++) b.box(0.05, 0.8, 0.05, fx + face * 0.95, f * fh + 0.15, cz - w * 0.3 + (k / 6) * w * 0.6, '#2b2b2b');
      b.box(0.06, 0.06, w * 0.6, fx + face * 0.95, f * fh + 0.95, cz, '#2b2b2b');
      b.toran(new THREE.Vector3(fx + face * 0.98, f * fh + 1.0, cz - w * 0.3), new THREE.Vector3(fx + face * 0.98, f * fh + 1.0, cz + w * 0.3), 0.15, 0.35);
    }
  }
}

function tree(b, x, z, s = 1, kind = 'neem') {
  b.cyl(0.14 * s, 0.2 * s, 2.2 * s, 6, x, 0, z, '#5a3a22');
  if (kind === 'palm') {
    b.cyl(0.1 * s, 0.16 * s, 4.5 * s, 6, x, 2.2 * s, z, '#6b4a2a');
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; b.box(0.25 * s, 0.06, 2.2 * s, x + Math.cos(a) * 0.9 * s, 6.5 * s, z + Math.sin(a) * 0.9 * s, '#2f8f3e', { ry: -a, rx: 0.5 }); }
  } else {
    const g = ['#1f6a3a', '#2a7d44', '#185a30'];
    b.ico(1.5 * s, x, 3.2 * s, z, g[0]); b.ico(1.1 * s, x + 0.6 * s, 4.2 * s, z - 0.3 * s, g[1]); b.ico(1.0 * s, x - 0.7 * s, 3.9 * s, z + 0.4 * s, g[2]);
  }
  b.collide(x - 0.3 * s, x + 0.3 * s, z - 0.3 * s, z + 0.3 * s);
}

function lamp(b, x, z, face) {
  b.cyl(0.07, 0.1, 5.2, 6, x, 0, z, '#2a2d33');
  b.box(1.2, 0.08, 0.08, x + face * 0.6, 5.1, z, '#2a2d33');
  b.box(0.5, 0.15, 0.3, x + face * 1.15, 4.95, z, '#2a2d33');
  b.box(0.42, 0.04, 0.24, x + face * 1.15, 4.93, z, '#ffe6a8', { emissive: true });
  b.lamps.push(new THREE.Vector3(x + face * 1.15, 4.8, z));
  b.collide(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
}

function auto(b, x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const part = (w, h, d, px, py, pz, c) => { const m = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), toon(c)); m.position.set(px, py + h / 2, pz); g.add(m); };
  part(2.4, 0.75, 1.3, 0, 0.35, 0, '#2f8f4e'); part(2.4, 0.18, 1.3, 0, 1.1, 0, '#f2c230');
  part(0.8, 0.7, 1.1, 1.3, 0.35, 0, '#2f8f4e'); part(2.2, 0.12, 1.4, -0.1, 1.85, 0, '#16181c');
  part(0.08, 0.7, 0.08, 0.95, 1.15, 0.6, '#16181c'); part(0.08, 0.7, 0.08, 0.95, 1.15, -0.6, '#16181c'); part(0.08, 0.7, 0.08, -1.1, 1.15, 0.6, '#16181c'); part(0.08, 0.7, 0.08, -1.1, 1.15, -0.6, '#16181c');
  for (const [wx, wz] of [[1.5, 0], [-0.8, 0.62], [-0.8, -0.62]]) { const w = new THREE.Mesh(flat(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 10)), toon('#141414')); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.3, wz); g.add(w); }
  g.updateMatrixWorld(true);
  g.children.forEach((m) => b.statics.push(m));
  b.collide(x - 1.5, x + 1.5, z - 1.5, z + 1.5);
}

function vehicle(b, x, z, ry, color, kind = 'car') {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const part = (w, h, d, px, py, pz, c, e) => { const m = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), e ? glow(c) : toon(c)); m.position.set(px, py + h / 2, pz); g.add(m); };
  if (kind === 'scooter') {
    part(1.4, 0.4, 0.4, 0, 0.35, 0, color); part(0.5, 0.15, 0.36, -0.2, 0.78, 0, '#1a1a1a'); part(0.12, 0.8, 0.12, 0.6, 0.4, 0, color); part(0.1, 0.06, 0.6, 0.62, 1.2, 0, '#1a1a1a');
    for (const wx of [0.55, -0.5]) { const w = new THREE.Mesh(flat(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 10)), toon('#141414')); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.25, 0); g.add(w); }
  } else {
    part(4, 0.7, 1.8, 0, 0.3, 0, color); part(2.2, 0.6, 1.6, -0.2, 1.0, 0, color); part(2.0, 0.5, 1.62, -0.2, 1.05, 0, '#9fd0ff', true);
    part(0.05, 0.18, 0.4, 2.0, 0.6, 0.55, '#fff6d0', true); part(0.05, 0.18, 0.4, 2.0, 0.6, -0.55, '#fff6d0', true);
    for (const [wx, wz] of [[1.3, 0.9], [1.3, -0.9], [-1.3, 0.9], [-1.3, -0.9]]) { const w = new THREE.Mesh(flat(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10)), toon('#141414')); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.34, wz); g.add(w); }
  }
  g.updateMatrixWorld(true);
  g.children.forEach((m) => b.statics.push(m));
  const L = kind === 'scooter' ? 0.8 : 2.2, W = kind === 'scooter' ? 0.4 : 1.1, c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  b.collide(x - (L * c + W * s), x + (L * c + W * s), z - (L * s + W * c), z + (L * s + W * c));
}

function temple(b, x, z) {
  b.box(7, 0.8, 7, x, 0, z, '#d9cfc0'); b.box(5, 0.4, 5, x, 0.8, z, '#e8dfcf');
  b.box(3.6, 3, 3.6, x, 1.2, z, '#f3ead8');
  b.box(1.4, 2.2, 0.1, x, 1.2, z + 1.82, '#3a1a08');
  const tiers = [[3.2, 1.6], [2.6, 1.5], [2.0, 1.4], [1.4, 1.3], [0.8, 1.2]];
  let y = 4.2;
  tiers.forEach(([s, h], i) => { b.cyl(s * 0.42, s * 0.62, h, 8, x, y, z, i % 2 ? '#f08a24' : '#f3ead8'); y += h; });
  b.ico(0.35, x, y + 0.3, z, '#ffd23f');
  b.cyl(0.03, 0.03, 2.2, 4, x, y + 0.5, z, '#5a3a22');
  b.box(0.05, 0.6, 1.0, x, y + 2.0, z + 0.5, '#ff9933', { ry: 0 });
  for (let k = 0; k <= 16; k++) { const t = k / 16; b.bulbs.push({ p: new THREE.Vector3(x - 2.6 + 5.2 * t, 4.3, z + 2.6), c: '#ffd23f', ph: k }); }
  for (let k = 0; k <= 12; k++) { const t = k / 12, yy = 4.3 + t * 7; b.bulbs.push({ p: new THREE.Vector3(x - 1.4 * (1 - t) - 0.2, yy, z + 1.4 * (1 - t) + 0.2), c: '#ffd23f', ph: k }); b.bulbs.push({ p: new THREE.Vector3(x + 1.4 * (1 - t) + 0.2, yy, z + 1.4 * (1 - t) + 0.2), c: '#ffd23f', ph: k }); }
  for (let k = -2; k <= 2; k++) b.diyas.push(new THREE.Vector3(x + k * 0.8, 1.22, z + 2.3));
  b.collide(x - 3.5, x + 3.5, z - 3.5, z + 3.5);
}

function chaiStall(b, x, z, face) {
  b.box(1.2, 0.9, 2.2, x, 0, z, '#8a5a2b');
  b.box(1.6, 0.08, 2.6, x + face * 0.2, 2.2, z, '#e8433a', { rz: face * -0.15 });
  for (const zz of [-1.1, 1.1]) b.cyl(0.04, 0.04, 2.2, 4, x + face * 0.8, 0, z + zz, '#3a2a1a');
  b.cyl(0.15, 0.12, 0.3, 8, x, 0.9, z - 0.4, '#c0c4cc'); b.cyl(0.2, 0.2, 0.08, 8, x, 0.9, z + 0.4, '#1a1a1a');
  b.box(0.4, 0.45, 1.6, x + face * 1.4, 0, z, '#6b4a2a');
  b.collide(x - 0.7, x + 0.7, z - 1.2, z + 1.2);
}

function hut(b, x, z, s, ry) {
  b.cyl(1.8 * s, 1.9 * s, 2.2 * s, 9, x, 0, z, '#b9875a');
  b.cone(2.5 * s, 2.2 * s, 9, x, 2.2 * s, z, '#c9a85a');
  b.box(0.1, 1.5 * s, 0.8 * s, x + Math.cos(ry) * 1.85 * s, 0, z + Math.sin(ry) * 1.85 * s, '#3a1a08', { ry: -ry });
  b.box(0.08, 0.6, 0.6, x + Math.cos(ry + 0.9) * 1.86 * s, 1.0 * s, z + Math.sin(ry + 0.9) * 1.86 * s, b.r() < 0.7 ? '#ffb45c' : '#1c2733', { ry: -ry - 0.9, emissive: true });
  b.diyas.push(new THREE.Vector3(x + Math.cos(ry - 0.35) * 2.05 * s, 0.05, z + Math.sin(ry - 0.35) * 2.05 * s), new THREE.Vector3(x + Math.cos(ry + 0.35) * 2.05 * s, 0.05, z + Math.sin(ry + 0.35) * 2.05 * s));
  b.toran(new THREE.Vector3(x + Math.cos(ry - 0.6) * 2 * s, 2.3 * s, z + Math.sin(ry - 0.6) * 2 * s), new THREE.Vector3(x + Math.cos(ry + 0.6) * 2 * s, 2.3 * s, z + Math.sin(ry + 0.6) * 2 * s), 0.3, 0.35);
  b.collide(x - 1.9 * s, x + 1.9 * s, z - 1.9 * s, z + 1.9 * s);
}

function block(b, cx, cz, w, d, floors, ry, color) {
  // an apartment block in a housing society; ry: 0 faces +z
  const H = floors * 3, g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry;
  const part = (pw, ph, pd, px, py, pz, c, e) => { const m = new THREE.Mesh(flat(new THREE.BoxGeometry(pw, ph, pd)), e ? glow(c) : toon(c)); m.position.set(px, py + ph / 2, pz); g.add(m); };
  part(w, H, d, 0, 0, 0, color);
  part(w + 0.4, 0.5, d + 0.4, 0, H, 0, '#e9e2d4');
  const cols = Math.floor(w / 3.2);
  for (let f = 0; f < floors; f++) {
    part(w + 0.1, 0.16, 0.25, 0, f * 3 + 2.9, d / 2 + 0.05, '#e9e2d4');
    for (let k = 0; k < cols; k++) {
      const wx = -w / 2 + (k + 0.5) * (w / cols);
      part(1.3, 1.3, 0.08, wx, f * 3 + 0.9, d / 2 + 0.04, b.r() < 0.7 ? '#ffcf7a' : '#1c2733', true);
      if (f > 0 && k % 2 === 0) { part(2.2, 0.12, 0.9, wx, f * 3, d / 2 + 0.45, '#e9e2d4'); part(2.2, 0.8, 0.05, wx, f * 3 + 0.12, d / 2 + 0.88, '#2b2b2b'); }
    }
  }
  g.updateMatrixWorld(true);
  g.children.forEach((m) => b.statics.push(m));
  // lights along each floor's front edge
  const v = new THREE.Vector3();
  for (const f of [2, 4]) if (f < floors) {
    const a = g.localToWorld(v.set(-w / 2, f * 3 + 2.8, d / 2 + 0.3).clone()), c = g.localToWorld(new THREE.Vector3(w / 2, f * 3 + 2.8, d / 2 + 0.3));
    b.toran(a, c, 0.2, 0.5);
  }
  const ex = Math.abs(Math.cos(ry)) * w / 2 + Math.abs(Math.sin(ry)) * d / 2, ez = Math.abs(Math.sin(ry)) * w / 2 + Math.abs(Math.cos(ry)) * d / 2;
  b.collide(cx - ex, cx + ex, cz - ez, cz + ez);
}

function wall(b, x0, z0, x1, z1, color = '#d8cfc0') {
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  b.box(L, 1.4, 0.25, (x0 + x1) / 2, 0, (z0 + z1) / 2, color, { ry: -a });
  for (let k = 0; k <= Math.floor(L / 4); k++) { const t = (k * 4) / L; b.box(0.45, 1.7, 0.45, x0 + dx * t, 0, z0 + dz * t, '#c4b8a4'); }
  b.collide(Math.min(x0, x1) - 0.2, Math.max(x0, x1) + 0.2, Math.min(z0, z1) - 0.2, Math.max(z0, z1) + 0.2);
}

function bench(b, x, z, ry) {
  b.box(1.6, 0.08, 0.5, x, 0.45, z, '#8a5a2b', { ry });
  b.box(0.08, 0.45, 0.45, x - Math.cos(ry) * 0.7, 0, z + Math.sin(ry) * 0.7, '#3a3a3a', { ry }); b.box(0.08, 0.45, 0.45, x + Math.cos(ry) * 0.7, 0, z - Math.sin(ry) * 0.7, '#3a3a3a', { ry });
}

function rangoli(b, x, z, R) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(R * 1.25, 48), new THREE.MeshToonMaterial({ map: rangoliTexture(), transparent: true }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z);
  b.dynamic.add(m);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; b.diyas.push(new THREE.Vector3(x + Math.cos(a) * R * 1.4, 0.0, z + Math.sin(a) * R * 1.4)); }
}

function hills(b, R, color, n = 18, hMin = 18, hMax = 40) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + b.r() * 0.2, h = hMin + b.r() * (hMax - hMin);
    b.cone(h * 1.3, h, 5, Math.cos(a) * R, -1, Math.sin(a) * R, color, { ry: b.r() * 3 });
  }
}

function props(b, x, z) {
  const kinds = ['ball', 'bucket', 'can', 'can', 'box', 'matka', 'ball', 'can'];
  kinds.forEach((k, i) => b.props.push({ type: k, x: x + Math.cos(i * 0.8) * (1.5 + i * 0.35), z: z + Math.sin(i * 0.8) * (1.5 + i * 0.35) }));
}

// ------------------------------------------------------------------ maps
const BUILD = {
  gali(b) {
    b.box(8, 0.02, 90, 0, -0.02, -5, '#2b2d33');
    for (const s of [-1, 1]) { b.box(1.8, 0.2, 90, s * 4.9, 0, -5, '#8a8478'); b.box(0.2, 0.22, 90, s * 4.0, 0, -5, '#e8e4d8'); }
    for (let k = -8; k < 8; k++) b.box(0.15, 0.025, 2, 0, 0, k * 5, '#d8d0b8');
    for (const s of [-1, 1]) {
      let z = 34;
      while (z > -36) {
        const w = 4.5 + b.r() * 3, d = 7 + b.r() * 3, floors = 2 + Math.floor(b.r() * 2.2);
        house(b, s * (5.8 + d / 2), z - w / 2, w, d, floors, -s, b.pick(PASTEL));
        z -= w + 0.15;
      }
    }
    // toran strings across the lane
    for (let z = 28; z > -32; z -= 7) b.toran(new THREE.Vector3(-5.8, 6.4, z), new THREE.Vector3(5.8, 6.4, z + 1), 1.2);
    for (let z = 22; z > -30; z -= 13) { lamp(b, -4.6, z, 1); lamp(b, 4.6, z - 6.5, -1); }
    temple(b, 0, -42);
    chaiStall(b, 3.4, 14, -1);
    auto(b, -2.6, 4, Math.PI / 2 + 0.1);
    vehicle(b, 2.8, -10, Math.PI / 2, '#d23a2e', 'scooter'); vehicle(b, 3.0, -11.4, Math.PI / 2, '#2f6fb0', 'scooter');
    tree(b, -4.6, -18, 0.9); tree(b, 4.6, 24, 0.8);
    rangoli(b, 0, -2, 1.3);
    props(b, -1.5, 9);
    hills(b, 130, '#0d1426');
    b.bounds = { x0: -3.8, x1: 3.8, z0: -37, z1: 33 };
    b.spawn = { x: -1.2, z: 21, yaw: 0 };
  },
  society(b) {
    b.box(70, 0.02, 70, 0, -0.02, 0, '#2a2c30');
    b.box(26, 0.04, 26, 0, 0, 0, '#3b3d42');
    block(b, 0, -24, 34, 10, 7, 0, '#e8d2b0'); block(b, -24, 0, 30, 10, 6, Math.PI / 2, '#cfe0e8'); block(b, 24, 0, 30, 10, 6, -Math.PI / 2, '#f0c8c0');
    wall(b, -18, 18, -3, 18); wall(b, 3, 18, 18, 18);
    b.box(0.5, 3, 0.5, -3, 0, 18, '#c4b8a4'); b.box(0.5, 3, 0.5, 3, 0, 18, '#c4b8a4'); b.toran(new THREE.Vector3(-3, 3, 18), new THREE.Vector3(3, 3, 18), 0.5, 0.4);
    for (const [x, z] of [[-13, -13], [13, -13], [-13, 12], [13, 12]]) { b.box(6, 0.3, 6, x, 0, z, '#2f6e3a'); tree(b, x, z, 1.1); }
    for (const [x, z, a] of [[-8, -4, 0], [8, -4, 0], [-8, 6, Math.PI], [8, 6, Math.PI]]) bench(b, x, z, a);
    vehicle(b, -15, 5, 0, '#c0c4cc'); vehicle(b, -15, -6, 0, '#d23a2e'); vehicle(b, 15, 5, Math.PI, '#2f6fb0'); vehicle(b, 15, -4, Math.PI, '#f5e6c8');
    for (const [x, z] of [[-10, 0], [10, 0], [0, -14], [-5, 12]]) lamp(b, x, z, x ? -Math.sign(x) : 1);
    rangoli(b, 0, 0, 2.2);
    props(b, 3, 7);
    hills(b, 140, '#0c1424');
    b.bounds = { x0: -18, x1: 18, z0: -18, z1: 17 };
    b.spawn = { x: 0, z: 13, yaw: 0 };
  },
  village(b) {
    b.box(90, 0.02, 90, 0, -0.02, 0, '#4a3424');
    // banyan on a chabutra platform
    b.cyl(3.2, 3.4, 0.7, 10, 0, 0, -6, '#b9a07a'); b.cyl(0.8, 1.0, 4, 8, 0, 0.7, -6, '#5a3a22');
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; b.ico(2.2 + b.r(), Math.cos(a) * 3, 5.5 + b.r() * 1.5, -6 + Math.sin(a) * 3, b.pick(['#1f5a30', '#246a38', '#184a28']), 0); }
    b.ico(3, 0, 7.5, -6, '#1f6a3a');
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; b.diyas.push(new THREE.Vector3(Math.cos(a) * 3.05, 0.7, -6 + Math.sin(a) * 3.05)); }
    b.collide(-3.3, 3.3, -9.3, -2.7);
    for (let k = 0; k < 7; k++) { const a = -0.4 + (k / 6) * (Math.PI + 0.8) + Math.PI, r = 16 + b.r() * 4; hut(b, Math.cos(a) * r, -6 + Math.sin(a) * r, 0.9 + b.r() * 0.3, Math.atan2(-Math.sin(a), -Math.cos(a))); }
    b.cyl(1.0, 1.0, 0.9, 10, 8, 0, 4, '#8a8478'); b.box(0.12, 2.2, 0.12, 7, 0, 4, '#5a3a22'); b.box(0.12, 2.2, 0.12, 9, 0, 4, '#5a3a22'); b.box(2.4, 0.1, 0.3, 8, 2.2, 4, '#5a3a22'); b.collide(6.9, 9.1, 2.9, 5.1);
    for (const [x, z] of [[-9, 6], [-11, 8]]) b.cone(1.4, 2.4, 7, x, 0, z, '#d9b04a');
    b.collide(-12.5, -7.5, 4.5, 9.5);
    for (const [x, z] of [[-20, -20], [20, -18], [22, 10], [-22, 12], [12, 16]]) tree(b, x, z, 1.1, 'palm');
    props(b, 4, 9);
    hills(b, 110, '#0e1830', 16, 14, 30);
    b.bounds = { x0: -26, x1: 26, z0: -28, z1: 22 };
    b.spawn = { x: 0, z: 14, yaw: 0 };
  },
  green(b) {
    b.box(90, 0.02, 90, 0, -0.02, 0, '#173a22');
    b.box(3, 0.03, 60, 0, 0, 0, '#5a5248'); b.box(60, 0.03, 3, 0, 0, 0, '#5a5248');
    for (let k = 0; k < 26; k++) { const a = b.r() * Math.PI * 2, r = 9 + b.r() * 16; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 3 || Math.abs(z) < 3) continue; tree(b, x, z, 0.8 + b.r() * 0.5); }
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { // solar lamps
      b.cyl(0.06, 0.08, 4, 6, x, 0, z, '#3a3d44'); b.box(0.9, 0.05, 0.6, x, 4.1, z, '#1b3a6a', { rx: -0.4 }); b.box(0.3, 0.12, 0.3, x, 3.7, z, '#ffe6a8', { emissive: true });
      b.lamps.push(new THREE.Vector3(x, 3.6, z)); b.collide(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
    }
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.5, x = Math.cos(a) * 60, z = Math.sin(a) * 60; b.cyl(0.4, 0.7, 26, 8, x, 0, z, '#d7e4de'); b.turbines.push(new THREE.Vector3(x, 26, z + 0.8)); }
    for (const [x, z, a] of [[-4, 2.5, 0], [4, -2.5, Math.PI], [2.5, 4, Math.PI / 2]]) bench(b, x, z, a);
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; b.box(0.5, 0.35, 0.5, Math.cos(a) * 9, 0, Math.sin(a) * 9, '#a4532c'); b.ico(0.4, Math.cos(a) * 9, 0.65, Math.sin(a) * 9, '#3fae55'); }
    rangoli(b, 0, 0, 1.6);
    props(b, 3, 8);
    hills(b, 120, '#082419', 16, 16, 34);
    b.bounds = { x0: -26, x1: 26, z0: -26, z1: 26 };
    b.spawn = { x: 0, z: 12, yaw: 0 };
  },
};

/** Builds a map: returns meshes to add, plus lights, bulbs, diyas, colliders, props and spawn. */
export function buildMap(id) {
  const b = new Builder(id.length * 7919 + 2026);
  BUILD[id](b);
  return b;
}
