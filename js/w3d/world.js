// The 3D world: renderer, sky, map, lights, particles, flashes and simple physics.
// Quality presets keep it smooth on budget Android phones.

import * as THREE from '../vendor/three.module.min.js';
import { glow, toon, flat, dotTexture, skyTexture, mergeStatic, INK } from './art.js';
import { MAPS, buildMap } from './maps.js';

export const QUALITY = {
  low: { dpr: 0.75, particles: 2500, smoke: 260, lamps: 2, fx: 2, far: 75, bulbGlow: false },
  medium: { dpr: 1, particles: 5000, smoke: 520, lamps: 4, fx: 3, far: 110, bulbGlow: true },
  high: { dpr: 1.6, particles: 9000, smoke: 900, lamps: 6, fx: 4, far: 150, bulbGlow: true },
};

const rnd = (a, b) => a + Math.random() * (b - a);
const colCache = new Map();
/** '#rrggbb' → [r, g, b] in 0..1 (display colours; the particle shader writes them as is). */
export function rgb(hex) {
  let c = colCache.get(hex);
  if (!c) { const n = parseInt(hex.slice(1), 16); c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; colCache.set(hex, c); }
  return c;
}

// ------------------------------------------------------------------ particles
// One Points draw call per system. Each particle lives in a flat Float32Array
// (structure of arrays would be faster still, but this is plenty for a few thousand).
const VERT = `
attribute vec3 pcolor; attribute float psize; attribute float palpha;
varying vec3 vColor; varying float vAlpha;
uniform float scale;
void main() {
  vColor = pcolor; vAlpha = palpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.5, psize * scale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  if (t.a * vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
}`;
export const F = { FLICKER: 1, TRAIL: 2, SPLIT: 4, STROBE: 8, STICK: 16 };
const S = 20; // stride: x y z vx vy vz age life s0 s1 r g b a drag grav bounce flags tr seed

export class Particles {
  constructor(cap, { additive = true } = {}) {
    this.cap = cap; this.n = 0;
    this.d = new Float32Array(cap * S);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTexture() }, scale: { value: 400 } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geom = g;
    this.additive = additive;
  }
  /** o: { x, y, z, vx, vy, vz, life, size, size1, c: '#hex', a, drag, grav, bounce, f: flags, tr } */
  spawn(o) {
    if (this.n >= this.cap) return;
    const d = this.d, i = this.n++ * S, c = rgb(o.c || '#ffd27a');
    d[i] = o.x; d[i + 1] = o.y; d[i + 2] = o.z; d[i + 3] = o.vx || 0; d[i + 4] = o.vy || 0; d[i + 5] = o.vz || 0;
    d[i + 6] = 0; d[i + 7] = o.life || 1; d[i + 8] = o.size || 0.06; d[i + 9] = o.size1 ?? o.size ?? 0.06;
    d[i + 10] = c[0]; d[i + 11] = c[1]; d[i + 12] = c[2]; d[i + 13] = o.a ?? 1;
    d[i + 14] = o.drag ?? 0.5; d[i + 15] = o.grav ?? 9.8; d[i + 16] = o.bounce ?? 0; d[i + 17] = o.f || 0; d[i + 18] = o.tr ?? 0; d[i + 19] = Math.random();
  }
  get room() { return this.cap - this.n; }
  clear() { this.n = 0; this.geom.setDrawRange(0, 0); }
  update(dt, world) {
    const d = this.d;
    let n = this.n;
    for (let p = 0; p < n; p++) {
      const i = p * S;
      d[i + 6] += dt;
      if (d[i + 6] >= d[i + 7]) {
        const f = d[i + 17];
        if (f & F.SPLIT && this.room > 3) {
          for (let k = 0; k < 3; k++) this.spawn({ x: d[i], y: d[i + 1], z: d[i + 2], vx: d[i + 3] * 0.3 + rnd(-1.5, 1.5), vy: d[i + 4] * 0.3 + rnd(-1, 1.5), vz: d[i + 5] * 0.3 + rnd(-1.5, 1.5), life: rnd(0.12, 0.3), size: d[i + 8] * 0.7, c: '#fff4d0', drag: 3, grav: 4 });
          n = this.n;
        }
        if (f & F.STROBE && this.room > 1) { this.spawn({ x: d[i], y: d[i + 1], z: d[i + 2], life: 0.09, size: d[i + 8] * 3, c: '#ffffff', grav: 0 }); n = this.n; }
        // swap-remove: move the last particle into this slot
        n--; this.n = n;
        if (p !== n) d.copyWithin(i, n * S, n * S + S);
        p--; continue;
      }
      const drag = Math.max(0, 1 - d[i + 14] * dt);
      d[i + 3] *= drag; d[i + 5] *= drag; d[i + 4] = d[i + 4] * drag - d[i + 15] * dt;
      d[i] += d[i + 3] * dt; d[i + 1] += d[i + 4] * dt; d[i + 2] += d[i + 5] * dt;
      if (d[i + 1] < 0.01) {
        if (d[i + 16] > 0) { d[i + 1] = 0.01; d[i + 4] = -d[i + 4] * d[i + 16]; d[i + 3] *= 0.6; d[i + 5] *= 0.6; }
        else if (d[i + 17] & F.STICK) { d[i + 1] = 0.01; d[i + 3] = d[i + 4] = d[i + 5] = 0; }
        else d[i + 6] = d[i + 7];
      }
      if (d[i + 17] & F.TRAIL && this.n < this.cap && Math.random() < 0.6) {
        this.spawn({ x: d[i], y: d[i + 1], z: d[i + 2], vx: rnd(-0.2, 0.2), vy: rnd(-0.3, 0.1), vz: rnd(-0.2, 0.2), life: rnd(0.25, 0.5) * (d[i + 18] || 1), size: d[i + 8] * 0.55, c: d[i + 18] > 1 ? '#ff9a3c' : '#ffd9a0', a: 0.6, drag: 2, grav: 1.2 });
      }
    }
    // write the GPU buffers
    const pos = this.pos, col = this.col, size = this.size, alpha = this.alpha, t = world.time;
    for (let p = 0; p < this.n; p++) {
      const i = p * S, k = d[i + 6] / d[i + 7], f = d[i + 17];
      pos[p * 3] = d[i]; pos[p * 3 + 1] = d[i + 1]; pos[p * 3 + 2] = d[i + 2];
      col[p * 3] = d[i + 10]; col[p * 3 + 1] = d[i + 11]; col[p * 3 + 2] = d[i + 12];
      size[p] = d[i + 8] + (d[i + 9] - d[i + 8]) * k;
      let a = d[i + 13] * (this.additive ? 1 - k * k : (1 - k) * Math.min(1, k * 8));
      if (f & F.FLICKER) a *= 0.35 + 0.65 * (Math.sin(t * 60 + d[i + 19] * 40) > 0 ? 1 : 0.2);
      alpha[p] = a;
    }
    const a = this.geom.attributes;
    a.position.needsUpdate = a.pcolor.needsUpdate = a.psize.needsUpdate = a.palpha.needsUpdate = true;
    this.geom.setDrawRange(0, this.n);
  }
}

// ------------------------------------------------------------------ the world
export class World {
  constructor(canvas, quality = 'medium') {
    this.q = QUALITY[quality] || QUALITY.medium; this.qName = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400);
    this.hand = new THREE.Group(); this.camera.add(this.hand);
    this.time = 0; this.shakeAmt = 0;
    this.resize();
  }
  setQuality(name) {
    this.q = QUALITY[name] || QUALITY.medium; this.qName = name;
    this.resize();
  }
  resize(w = window.innerWidth, h = window.innerHeight) {
    const dpr = this.q.dpr < 1 ? this.q.dpr : Math.min(window.devicePixelRatio || 1, this.q.dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.pxScale = (h * dpr) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    for (const p of [this.sparks, this.smoke, this.glows, this.diyaGlow]) if (p) p.mat.uniforms.scale.value = this.pxScale;
  }

  /** Builds a map from scratch. */
  load(id) {
    if (this.scene) this.dispose();
    const M = MAPS[id] || MAPS.gali, b = buildMap(MAPS[id] ? id : 'gali');
    this.mapId = MAPS[id] ? id : 'gali'; this.map = M; this.b = b;
    const sc = this.scene = new THREE.Scene();
    sc.fog = new THREE.Fog(M.fog, 18, this.q.far);
    sc.background = new THREE.Color(M.fog);
    // sky dome and stars
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture([...M.sky.map(([t, c]) => [t * 0.5, c]), [1, M.sky[M.sky.length - 1][1]]]), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; sc.add(sky);
    const sp = [], N = 700;
    for (let i = 0; i < N; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, y = 0.15 + Math.random() * 0.85, r = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * r * 280, y * 280, Math.sin(a) * r * 280); void u; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
    sc.add(stars);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xfff1cc, fog: false }));
    moon.position.set(-120, 140, -200); moon.lookAt(0, 0, 0); sc.add(moon);
    // lights: soft night fill + pools that follow the player
    this.hemi = new THREE.HemisphereLight(0x8aa0ff, 0x2a1a10, 0.9); sc.add(this.hemi);
    this.moonLight = new THREE.DirectionalLight(0x9fb4ff, 0.55); this.moonLight.position.set(-30, 50, -40); sc.add(this.moonLight);
    this.lampLights = [];
    for (let i = 0; i < Math.min(this.q.lamps, b.lamps.length); i++) { const l = new THREE.PointLight(0xffc27a, 0, 14, 1.6); sc.add(l); this.lampLights.push(l); }
    this.fxLights = [];
    for (let i = 0; i < this.q.fx; i++) { const l = new THREE.PointLight(0xffaa55, 0, 26, 1.6); sc.add(l); this.fxLights.push(l); }
    this.flashlight = new THREE.SpotLight(0xfff4dd, 0, 30, 0.42, 0.5, 1.4);
    this.camera.add(this.flashlight); this.flashlight.position.set(0.15, -0.1, 0); this.flashlight.target.position.set(0, 0, -5); this.camera.add(this.flashlight.target);
    sc.add(this.camera);
    // the map itself
    for (const m of mergeStatic(b.statics)) { m.matrixAutoUpdate = false; sc.add(m); }
    sc.add(b.dynamic);
    // lamp glows
    for (const p of b.lamps) { const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffd08a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); h.scale.setScalar(2.6); h.position.copy(p); sc.add(h); }
    // particle systems
    this.sparks = new Particles(this.q.particles); this.smoke = new Particles(this.q.smoke, { additive: false });
    sc.add(this.sparks.points); sc.add(this.smoke.points);
    this.smoke.points.renderOrder = 1; this.sparks.points.renderOrder = 2;
    this.buildBulbs(b); this.buildDiyas(b); this.buildTurbines(b);
    // physics
    this.colliders = b.colliders; this.bounds = b.bounds;
    this.bodies = []; this.marks = []; this.rings = []; this.flashes = []; this.req = [];
    for (const p of b.props) this.addProp(p.type, p.x, p.z);
    this.skyFlash = 0; this.skyCol = new THREE.Color();
    this.resize();
  }
  dispose() {
    this.scene.traverse((o) => { if (o.geometry && !o.isSprite) o.geometry.dispose(); });
    this.scene.clear();
    this.camera.remove(this.flashlight, this.flashlight.target);
  }

  // ---------------------------------------------------------------- toran bulbs
  buildBulbs(b) {
    const n = b.bulbs.length;
    this.bulbs = b.bulbs;
    if (!n) { this.bulbMesh = null; return; }
    const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 0), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    const mx = new THREE.Matrix4(), c = new THREE.Color();
    b.bulbs.forEach((u, i) => { mx.makeTranslation(u.p.x, u.p.y, u.p.z); m.setMatrixAt(i, mx); m.setColorAt(i, c.set(u.c)); });
    m.instanceMatrix.needsUpdate = true;
    this.scene.add(m); this.bulbMesh = m;
    if (this.q.bulbGlow) {
      const g = this.glows = new Particles(n);
      g.mat.uniforms.scale.value = this.pxScale;
      b.bulbs.forEach((u) => g.spawn({ x: u.p.x, y: u.p.y, z: u.p.z, life: 1e9, size: 0.42, c: u.c, a: 0.55, grav: 0, drag: 0 }));
      g.update(0, this);
      this.scene.add(g.points);
    } else this.glows = null;
    this.bulbStep = -1;
  }
  tickBulbs() {
    const step = Math.floor(this.time * 3);
    if (!this.bulbMesh || step === this.bulbStep) return;
    this.bulbStep = step;
    const c = new THREE.Color(), al = this.glows?.alpha;
    this.bulbs.forEach((u, i) => {
      const on = (u.ph + step) % 4 !== 0;
      c.set(u.c).multiplyScalar(on ? 1 : 0.18);
      this.bulbMesh.setColorAt(i, c);
      if (al) al[i] = on ? 0.55 : 0.06;
    });
    this.bulbMesh.instanceColor.needsUpdate = true;
    if (al) this.glows.geom.attributes.palpha.needsUpdate = true;
  }

  // ---------------------------------------------------------------- diyas
  buildDiyas(b) {
    const n = b.diyas.length;
    this.diyas = b.diyas.map((p) => ({ p, lit: true, flame: new THREE.Vector3(p.x, p.y + 0.075, p.z), ph: Math.random() * 10 }));
    if (!n) return;
    const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.05, 0.005), new THREE.Vector2(0.085, 0.035), new THREE.Vector2(0.09, 0.05), new THREE.Vector2(0.07, 0.04), new THREE.Vector2(0.001, 0.03)];
    this.diyaBody = new THREE.InstancedMesh(flat(new THREE.LatheGeometry(pts, 8)), toon('#b4552a'), n);
    this.diyaFlame = new THREE.InstancedMesh(new THREE.ConeGeometry(0.022, 0.075, 6), glow('#ffcf5a'), n);
    const mx = new THREE.Matrix4();
    this.diyas.forEach((d, i) => { mx.makeTranslation(d.p.x, d.p.y, d.p.z); this.diyaBody.setMatrixAt(i, mx); });
    this.scene.add(this.diyaBody, this.diyaFlame);
    const g = this.diyaGlow = new Particles(n);
    g.mat.uniforms.scale.value = this.pxScale;
    this.diyas.forEach((d) => g.spawn({ x: d.flame.x, y: d.flame.y + 0.02, z: d.flame.z, life: 1e9, size: 0.55, c: '#ff9a2a', a: 0.8, grav: 0, drag: 0 }));
    g.update(0, this);
    this.scene.add(g.points);
  }
  tickDiyas(wind) {
    if (!this.diyaFlame) return;
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler(), al = this.diyaGlow.alpha;
    this.diyas.forEach((d, i) => {
      const f = d.lit ? 1 + Math.sin(this.time * 13 + d.ph) * 0.12 + Math.sin(this.time * 31 + d.ph * 3) * 0.06 : 0;
      e.set(Math.sin(this.time * 7 + d.ph) * 0.12 * (1 + wind * 4), 0, wind * 0.6);
      q.setFromEuler(e); s.set(f * 0.9, f, f * 0.9);
      mx.compose(d.flame, q, s); this.diyaFlame.setMatrixAt(i, mx);
      al[i] = d.lit ? 0.7 + Math.sin(this.time * 9 + d.ph) * 0.1 : 0;
    });
    this.diyaFlame.instanceMatrix.needsUpdate = true;
    this.diyaGlow.geom.attributes.palpha.needsUpdate = true;
  }
  get litDiyas() { return this.diyas.filter((d) => d.lit).length; }
  /** Puts out the lit diya nearest `p` (within `r`), with a smoke wisp. */
  blowOut(p, r = 7) {
    let best = null, bd = r;
    for (const d of this.diyas) if (d.lit) { const k = d.p.distanceTo(p); if (k < bd) { bd = k; best = d; } }
    if (!best) return false;
    best.lit = false;
    for (let i = 0; i < 6; i++) this.smoke.spawn({ x: best.flame.x, y: best.flame.y + 0.04, z: best.flame.z, vx: rnd(-0.05, 0.05), vy: rnd(0.2, 0.4), vz: rnd(-0.05, 0.05), life: rnd(1.2, 2), size: 0.05, size1: 0.3, c: '#9a9a9a', a: 0.35, grav: -0.05, drag: 0.6 });
    return true;
  }

  // ---------------------------------------------------------------- wind turbines
  buildTurbines(b) {
    this.rotors = b.turbines.map((p) => {
      const g = new THREE.Group(); g.position.copy(p);
      for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(flat(new THREE.BoxGeometry(0.6, 11, 0.15)), toon('#eef4f1')); m.position.y = 5.5; const piv = new THREE.Group(); piv.rotation.z = (k / 3) * Math.PI * 2; piv.add(m); g.add(piv); }
      g.add(new THREE.Mesh(flat(new THREE.SphereGeometry(0.6, 6, 4)), toon('#d7e4de')));
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), glow('#ff3b3b')); red.position.set(0, 1, -0.6); g.add(red);
      this.scene.add(g); return g;
    });
  }

  // ---------------------------------------------------------------- physics props
  addProp(type, x, z) {
    const P = {
      ball: [new THREE.IcosahedronGeometry(0.17, 1), '#ff5c3a', 0.17, 0.75, 0.45],
      bucket: [new THREE.CylinderGeometry(0.2, 0.15, 0.34, 10), '#2f6fb0', 0.2, 0.25, 1.6],
      can: [new THREE.CylinderGeometry(0.06, 0.06, 0.14, 8), '#e8433a', 0.08, 0.35, 0.2],
      box: [new THREE.BoxGeometry(0.4, 0.3, 0.32), '#c99a5b', 0.2, 0.2, 0.8],
      matka: [new THREE.IcosahedronGeometry(0.2, 1), '#b4552a', 0.2, 0.2, 1.2],
    }[type] || [new THREE.BoxGeometry(0.3, 0.3, 0.3), '#999', 0.15, 0.3, 0.6];
    const color = type === 'can' ? ['#e8433a', '#2ee59d', '#ffc857', '#5aa9ff'][Math.floor(Math.random() * 4)] : P[1];
    const mesh = new THREE.Mesh(flat(P[0]), toon(color));
    if (type === 'matka') mesh.scale.set(1, 0.85, 1);
    mesh.position.set(x, P[2], z);
    this.scene.add(mesh);
    return this.addBody({ mesh, r: P[2], rest: P[3], mass: P[4], kind: 'prop', type, spin: true });
  }
  addBody(o) {
    const b = { v: new THREE.Vector3(), w: new THREE.Vector3(), locked: false, ...o, p: o.mesh.position };
    this.bodies.push(b); return b;
  }
  removeBody(b) { this.bodies = this.bodies.filter((x) => x !== b); }
  /** Blast wave: pushes bodies away from `p`. */
  impulse(p, strength, radius) {
    for (const b of this.bodies) {
      if (b.locked || b.held) continue;
      const dx = b.p.x - p.x, dz = b.p.z - p.z, dy = b.p.y - p.y, d = Math.hypot(dx, dy, dz);
      if (d > radius || d < 1e-4) continue;
      const k = (strength * (1 - d / radius)) / b.mass;
      b.v.x += (dx / d) * k; b.v.z += (dz / d) * k; b.v.y += k * 0.7 + Math.abs(dy / d) * k * 0.3;
      if (b.spin) b.w.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(k * 3);
    }
  }
  /** Circle (x, z, r) against the map's boxes and bounds; returns the push-out. */
  collide(x, z, r, out = { x: 0, z: 0, hit: false }) {
    out.x = x; out.z = z; out.hit = false;
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(out.x, c.x1)), nz = Math.max(c.z0, Math.min(out.z, c.z1));
      const dx = out.x - nx, dz = out.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      out.hit = true;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; out.x += dx * k; out.z += dz * k; }
      else { // centre inside the box: push out along the shortest side
        const l = out.x - c.x0, rr = c.x1 - out.x, t = out.z - c.z0, bb = c.z1 - out.z, m = Math.min(l, rr, t, bb);
        if (m === l) out.x = c.x0 - r; else if (m === rr) out.x = c.x1 + r; else if (m === t) out.z = c.z0 - r; else out.z = c.z1 + r;
      }
    }
    const B = this.bounds;
    if (B) {
      if (out.x < B.x0) { out.x = B.x0; out.hit = true; } if (out.x > B.x1) { out.x = B.x1; out.hit = true; }
      if (out.z < B.z0) { out.z = B.z0; out.hit = true; } if (out.z > B.z1) { out.z = B.z1; out.hit = true; }
    }
    return out;
  }
  stepBodies(dt, player) {
    const o = { x: 0, z: 0, hit: false };
    for (const b of this.bodies) {
      if (b.held) continue;
      if (b.locked) { if (b.slide) { /* moved by its owner */ } continue; }
      // the player kicks what they walk into
      if (player) {
        const dx = b.p.x - player.pos.x, dz = b.p.z - player.pos.z, d = Math.hypot(dx, dz), R = b.r + 0.32;
        if (d < R && d > 1e-4 && b.p.y < 1.2) {
          const sp = Math.hypot(player.vel.x, player.vel.z);
          b.p.x = player.pos.x + (dx / d) * R; b.p.z = player.pos.z + (dz / d) * R;
          if (sp > 0.3) { const k = (1.2 + sp * 0.9) / Math.max(0.5, b.mass); b.v.x += (dx / d) * k; b.v.z += (dz / d) * k; b.v.y += k * 0.25; if (b.spin) b.w.set(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)); }
        }
      }
      const gy = b.ground ?? b.r, moving = b.v.lengthSq() > 1e-4 || b.p.y > gy + 0.001;
      if (!moving) continue;
      b.v.y -= 9.8 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < gy) {
        b.p.y = gy;
        b.v.y = Math.abs(b.v.y) > 0.8 ? -b.v.y * b.rest : 0;
        const fr = b.type === 'ball' ? 0.6 : 4;
        b.v.x *= Math.max(0, 1 - fr * dt); b.v.z *= Math.max(0, 1 - fr * dt);
        b.w.multiplyScalar(Math.max(0, 1 - 5 * dt));
        if (Math.hypot(b.v.x, b.v.z) < 0.05 && b.v.y === 0) b.v.set(0, 0, 0);
      }
      this.collide(b.p.x, b.p.z, b.r, o);
      if (o.hit) {
        if (o.x !== b.p.x) b.v.x = -b.v.x * b.rest;
        if (o.z !== b.p.z) b.v.z = -b.v.z * b.rest;
        b.p.x = o.x; b.p.z = o.z;
      }
      if (b.spin) {
        if (b.type === 'ball' && b.p.y <= gy + 0.01) { b.mesh.rotation.x += (b.v.z / b.r) * dt; b.mesh.rotation.z -= (b.v.x / b.r) * dt; }
        else { b.mesh.rotation.x += b.w.x * dt; b.mesh.rotation.y += b.w.y * dt; b.mesh.rotation.z += b.w.z * dt; }
      }
    }
    // bodies push each other apart
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], c = bs[j];
      if (a.held || c.held || (a.locked && c.locked)) continue;
      const dx = c.p.x - a.p.x, dz = c.p.z - a.p.z, d = Math.hypot(dx, dz), R = a.r + c.r;
      if (d >= R || d < 1e-5 || Math.abs(a.p.y - c.p.y) > R) continue;
      const push = (R - d) / d / 2;
      if (!a.locked) { a.p.x -= dx * push; a.p.z -= dz * push; }
      if (!c.locked) { c.p.x += dx * push; c.p.z += dz * push; }
      const rv = (c.v.x - a.v.x) * dx + (c.v.z - a.v.z) * dz;
      if (rv < 0) {
        const k = rv / (d * d) * 0.9;
        if (!a.locked) { a.v.x += dx * k * (c.mass / (a.mass + c.mass)) * 2; a.v.z += dz * k * (c.mass / (a.mass + c.mass)) * 2; }
        if (!c.locked) { c.v.x -= dx * k * (a.mass / (a.mass + c.mass)) * 2; c.v.z -= dz * k * (a.mass / (a.mass + c.mass)) * 2; }
      }
    }
  }

  // ---------------------------------------------------------------- light and flashes
  /** A light for this frame only (fountains, fuses). */
  glowAt(p, color, intensity) { this.req.push({ x: p.x, y: p.y, z: p.z, c: color, i: intensity }); }
  /** A flash that fades over `ms`. */
  flash(p, color, intensity, ms, sky = 0) {
    this.flashes.push({ x: p.x, y: p.y, z: p.z, c: color, i: intensity, t0: this.time, dur: ms / 1000 });
    if (sky) { this.skyFlash = Math.min(2.5, this.skyFlash + sky); this.skyCol.set(color); }
    if (this.flashes.length > 24) this.flashes.shift();
  }
  updateLights(camPos) {
    const now = this.time;
    this.flashes = this.flashes.filter((f) => now - f.t0 < f.dur);
    for (const f of this.flashes) { const k = 1 - (now - f.t0) / f.dur; this.req.push({ x: f.x, y: f.y, z: f.z, c: f.c, i: f.i * k * k }); }
    // the brightest requests (weighted by distance) get the real lights
    for (const r of this.req) r.w = r.i / (1 + Math.hypot(r.x - camPos.x, r.z - camPos.z) * 0.15);
    this.req.sort((a, b) => b.w - a.w);
    this.fxLights.forEach((l, i) => {
      const r = this.req[i];
      if (!r) { l.intensity = 0; return; }
      l.position.set(r.x, r.y, r.z); l.color.set(r.c); l.intensity = r.i;
    });
    this.req.length = 0;
    // street lamps: the nearest ones get real lights
    if (this.lampLights.length && (!this.lampT || now - this.lampT > 0.4)) {
      this.lampT = now;
      const near = this.b.lamps.slice().sort((a, b) => a.distanceToSquared(camPos) - b.distanceToSquared(camPos));
      this.lampLights.forEach((l, i) => { l.position.copy(near[i]); l.intensity = 6; });
    }
    // fireworks light the sky and everything under it
    this.skyFlash *= Math.exp(-4.5 * (1 / 60));
    this.hemi.intensity = 0.9 + this.skyFlash * 1.6;
    this.hemi.color.setRGB(0.54, 0.63, 1).lerp(this.skyCol, Math.min(1, this.skyFlash));
  }

  // ---------------------------------------------------------------- effects
  /** A firework shell bursting at p. b: { type, colour, colour2, size } with PALETTES colours passed in `pal`. */
  burst(p, b, pal, pal2, scale = 1) {
    const V = 17 * ((b.size ?? 0.6) / 0.6) * scale, room = this.sparks.room;
    const n = Math.min(room, Math.round((b.type === 'willow' ? 130 : b.type === 'ring' ? 110 : 170) * (scale < 1 ? 0.55 : 1)));
    const ax = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), u = new THREE.Vector3().crossVectors(ax, new THREE.Vector3(0, 1, 0.3)).normalize(), w = new THREE.Vector3().crossVectors(ax, u);
    for (let i = 0; i < n; i++) {
      let dx, dy, dz;
      if (b.type === 'ring') { const a = (i / n) * Math.PI * 2; dx = u.x * Math.cos(a) + w.x * Math.sin(a); dy = u.y * Math.cos(a) + w.y * Math.sin(a); dz = u.z * Math.cos(a) + w.z * Math.sin(a); }
      else { const z = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z); dx = r * Math.cos(phi); dy = z; dz = r * Math.sin(phi); }
      const s = V * rnd(0.85, 1.05), col = (pal2 && i % 2 ? pal2 : pal)[i % 3 === 0 ? 1 : 0];
      const o = { x: p.x, y: p.y, z: p.z, vx: dx * s, vy: dy * s, vz: dz * s, life: rnd(1.4, 2), size: 0.6 * scale, c: col, drag: 1.7, grav: 2.6 };
      if (b.type === 'willow') Object.assign(o, { life: rnd(2.6, 3.3), drag: 2.4, grav: 3.6, f: F.TRAIL, tr: 1.4, c: '#ffcf6e', size: 0.45 * scale });
      else if (b.type === 'crackle') Object.assign(o, { life: rnd(0.9, 1.5), f: F.STROBE | F.SPLIT, c: '#ffd27a' });
      else if (Math.random() < 0.45) Object.assign(o, { f: (Math.random() < 0.5 ? F.FLICKER : 0) | F.TRAIL, tr: 0.6 });
      this.sparks.spawn(o);
    }
    for (let i = 0; i < 14; i++) this.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: rnd(-2, 2), vy: rnd(-2, 2), vz: rnd(-2, 2), life: rnd(0.1, 0.25), size: 2.4 * scale, c: '#ffffff', grav: 0, drag: 3 });
    this.flash(p, pal[0], 60 * scale, 700, scale >= 1 ? 0.6 * ((b.size ?? 0.6) / 0.6) : 0.2);
  }
  /** A bang on the ground: flash, sparks, smoke, paper bits, ring, scorch and a push. */
  bang(p, size = 1, { paper = '#d9303a', smoke = 1 } = {}) {
    this.flash(p, '#fff1d6', 90 * size, 380 + 200 * size, 0.5 * size);
    this.flash({ x: p.x, y: p.y + 0.4, z: p.z }, '#ffb066', 40 * size, 900);
    const n = Math.min(this.sparks.room, Math.round(60 + 90 * size));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, up = rnd(0.1, 1), s = rnd(3, 11) * size;
      this.sparks.spawn({ x: p.x, y: p.y + 0.05, z: p.z, vx: Math.cos(a) * s * (1 - up * 0.5), vy: up * s, vz: Math.sin(a) * s * (1 - up * 0.5), life: rnd(0.15, 0.55), size: rnd(0.05, 0.1), c: Math.random() < 0.5 ? '#fff4d0' : '#ffb347', drag: 2, grav: 9.8, bounce: 0.3 });
    }
    for (let i = 0; i < 3; i++) this.sparks.spawn({ x: p.x, y: p.y + 0.15, z: p.z, life: 0.12, size: 2.2 * size, c: '#fff6e0', grav: 0 });
    for (let i = 0; i < Math.round(14 * size * smoke); i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.3, 1.6) * size;
      this.smoke.spawn({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * s, vy: rnd(0.3, 1.2), vz: Math.sin(a) * s, life: rnd(2.5, 4.5), size: 0.3, size1: rnd(1.4, 2.4) * size, c: Math.random() < 0.5 ? '#8e8e94' : '#b0aeb4', a: 0.5, grav: -0.12, drag: 1.2 });
    }
    for (let i = 0; i < Math.round(16 * size); i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(1, 4) * size;
      this.smoke.spawn({ x: p.x, y: p.y + 0.1, z: p.z, vx: Math.cos(a) * s, vy: rnd(2, 5) * size, vz: Math.sin(a) * s, life: rnd(2, 4), size: 0.06, c: Math.random() < 0.6 ? paper : '#e8d9b0', a: 1, grav: 5, drag: 1.5, f: F.STICK });
    }
    this.ring(p, size); this.scorch(p, 0.35 + size * 0.35);
    this.impulse(p, 5 * size, 2.5 + size * 2);
    if (this.shakeOn !== false) this.shake(size * 0.9 * Math.max(0, 1 - this.camera.position.distanceTo(p) / 15));
  }
  ring(p, size) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z);
    this.scene.add(m); this.rings.push({ m, t0: this.time, size });
  }
  scorch(p, r) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 12), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.015, p.z); m.rotation.z = Math.random() * 6;
    this.scene.add(m); this.marks.push(m);
    if (this.marks.length > 30) { const o = this.marks.shift(); this.scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }
  shake(s) { this.shakeAmt = Math.min(1.2, this.shakeAmt + s); }
  clearFx() {
    this.sparks.clear(); this.smoke.clear(); this.flashes = []; this.skyFlash = 0;
    for (const m of this.marks) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.marks = [];
  }

  // ---------------------------------------------------------------- frame
  update(dt, player, wind = 0) {
    this.time += dt;
    this.sparks.update(dt, this); this.smoke.update(dt, this);
    this.tickBulbs(); this.tickDiyas(wind);
    for (const r of this.rotors) r.rotation.z += dt * 0.9;
    this.rings = this.rings.filter((r) => {
      const k = (this.time - r.t0) / 0.45;
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; }
      r.m.scale.setScalar(0.3 + k * 4 * r.size); r.m.material.opacity = 0.6 * (1 - k);
      return true;
    });
    this.stepBodies(dt, player);
    this.updateLights(this.camera.position);
  }
  render() {
    if (this.shakeAmt > 0.002) {
      const s = this.shakeAmt * 0.06, c = this.camera;
      c.position.x += rnd(-s, s); c.position.y += rnd(-s, s);
      c.rotation.z = rnd(-s, s) * 0.6;
      this.renderer.render(this.scene, c);
      this.shakeAmt *= 0.86;
    } else this.renderer.render(this.scene, this.camera);
  }
  /** Ground point under the screen centre, within `max` metres (null if looking up). */
  aimGround(max = 4.5) {
    const c = this.camera, d = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion), o = c.position;
    let t = d.y < -0.05 ? -o.y / d.y : Infinity;
    if (t > max) { t = max; }
    const p = o.clone().addScaledVector(d, t); p.y = 0;
    return p;
  }
}
export { INK };
