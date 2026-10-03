// Crackers in 3D: a low-poly model for each kind, and how it burns. Each one
// reads the same plan as its sound (crackers.js), so sight, sound, vibration and
// flashlight stay in step.

import * as THREE from '../vendor/three.module.min.js';
import { toon, glow, flat } from './art.js';
import { F } from './world.js';
import { PALETTES, sample } from '../crackers.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pickW = (list) => { let r = Math.random(); for (const [v, w] of list) if ((r -= w) <= 0) return v; return list[0][0]; };
const V = new THREE.Vector3();

function mesh(geom, color, x = 0, y = 0, z = 0, emissive = false) {
  const m = new THREE.Mesh(flat(geom), emissive ? glow(color) : toon(color));
  m.position.set(x, y, z);
  return m;
}

class C3 {
  /** world, def (with variant), v: { plan, buffer, envelope }, pos, yaw */
  constructor(world, def, v, pos, yaw = 0) {
    this.w = world; this.def = def; this.v = v; this.p = v.plan;
    this.g = new THREE.Group(); this.g.position.copy(pos); this.g.rotation.y = yaw;
    this.lit = false; this.done = false; this.t = 0; this.acc = 0; this.fuseLocal = new THREE.Vector3(0, 0.2, 0);
    this.q = world.q.particles / 5000; // particle budget for this quality level
    this.build();
    world.scene.add(this.g);
    this.body = world.addBody({ mesh: this.g, r: this.radius ?? 0.12, rest: 0.15, mass: this.mass ?? 0.5, kind: 'cracker', owner: this });
    this.body.ground = 0;
  }
  get name() { return this.def.name; }
  build() {}
  fuseTip(out = new THREE.Vector3()) { this.g.updateWorldMatrix(true, false); return this.g.localToWorld(out.copy(this.fuseLocal)); }
  ignite(when) { this.lit = true; this.when = when; this.body.locked = true; }
  /** Particles to emit this frame at `rate` per second. */
  count(rate, dt) { this.acc += rate * this.q * dt; const n = Math.floor(this.acc); this.acc -= n; return n; }
  fuse(dt) {
    const tip = this.fuseTip(V);
    for (let i = this.count(70, dt); i > 0; i--) this.w.sparks.spawn({ x: tip.x, y: tip.y, z: tip.z, vx: rnd(-0.6, 0.6), vy: rnd(0.2, 1.2), vz: rnd(-0.6, 0.6), life: rnd(0.1, 0.3), size: 0.03, c: Math.random() < 0.5 ? '#ffd27a' : '#ff9a3c', drag: 2, grav: 4 });
    if (Math.random() < dt * 6) this.w.smoke.spawn({ x: tip.x, y: tip.y, z: tip.z, vy: 0.3, life: 1.2, size: 0.03, size1: 0.15, c: '#9a9a9a', a: 0.3, grav: -0.05, drag: 0.5 });
    this.w.glowAt(tip, '#ff9a3c', 1.5 + Math.random());
  }
  update(dt, now) {
    if (!this.lit || this.done) return;
    this.t = (now - this.when) / 1000;
    if (this.t < 0) return;
    if (this.t < this.p.fuse && !this.noFuse) this.fuse(dt);
    this.tick(dt, this.t);
  }
  tick() {}
  /** Leaves the empty shell behind as a prop. */
  spend() {
    this.done = true; this.spent = true; this.body.locked = false;
    this.g.traverse((o) => { if (o.isMesh && o.material?.isMeshToonMaterial) o.material = toon(this.shellCol || '#3a2f2a'); });
  }
  remove() {
    this.done = true; this.g.removeFromParent(); this.w.removeBody(this.body);
  }
  smokePuff(p, k = 1, col = '#8e8e94') {
    this.w.smoke.spawn({ x: p.x + rnd(-0.05, 0.05), y: p.y, z: p.z + rnd(-0.05, 0.05), vx: rnd(-0.2, 0.2), vy: rnd(0.4, 0.9), vz: rnd(-0.2, 0.2), life: rnd(2.5, 4.5), size: 0.2 * k, size1: rnd(1, 1.8) * k, c: col, a: 0.32, grav: -0.1, drag: 0.8 });
  }
}

// ------------------------------------------------------------------ ANAR (flower pot)
class Anar extends C3 {
  build() {
    const p = this.p, s = p.big ? 1.4 : 1, [c0, c1, c2] = p.bodyCols || ['#c8323c', '#ffcf4a', '#7a3b1a'];
    this.g.add(mesh(new THREE.CylinderGeometry(0.1 * s, 0.11 * s, 0.03, 10), c2, 0, 0.015, 0));
    this.g.add(mesh(new THREE.CylinderGeometry(0.02 * s, 0.095 * s, 0.26 * s, 10), c0, 0, 0.03 + 0.13 * s, 0));
    this.g.add(mesh(new THREE.CylinderGeometry(0.06 * s, 0.075 * s, 0.05 * s, 10), c1, 0, 0.03 + 0.1 * s, 0));
    this.g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4), '#c49a6c', 0, 0.03 + 0.28 * s, 0));
    this.fuseLocal.set(0, 0.03 + 0.3 * s, 0); this.tipY = 0.03 + 0.26 * s;
    this.radius = 0.11 * s; this.shellCol = '#4a2a22';
  }
  tick(dt, t) {
    const p = this.p, k = sample(p.curve, p.burn, t - p.fuse);
    if (t >= p.fuse && k > 0.01) {
      const tip = this.g.localToWorld(V.set(0, this.tipY, 0)), H = (1.3 + 2.4 * k) * (p.big ? 1.4 : 1), v0 = Math.sqrt(2 * 9.8 * H);
      for (let i = this.count(520 * k, dt); i > 0; i--) {
        const a = Math.random() * Math.PI * 2, sp = (Math.random() + Math.random() - 1) * 0.28, s = v0 * rnd(0.5, 1);
        const col = p.colours && Math.random() < 0.7 ? p.colours[Math.floor((t - p.fuse) / 1.1 + Math.random() * 0.6) % p.colours.length] : pickW([['#ffcf6e', 0.6], ['#fff1c9', 0.27], ['#ff9a3c', 0.13]]);
        this.w.sparks.spawn({ x: tip.x, y: tip.y, z: tip.z, vx: Math.cos(a) * sp * s, vy: Math.cos(sp) * s, vz: Math.sin(a) * sp * s, life: rnd(0.7, 1.3), size: rnd(0.045, 0.075), c: col, drag: 0.4, grav: 9.8, bounce: 0.3, f: (Math.random() < 0.12 ? F.SPLIT : 0) | (Math.random() < 0.12 ? F.FLICKER : 0) });
      }
      this.w.glowAt({ x: tip.x, y: tip.y + 0.8, z: tip.z }, p.colours ? p.colours[0] : '#ffaa55', 6 + 24 * k);
      if (Math.random() < dt * 5 * k) this.smokePuff(tip, 0.8);
    }
    if (t > p.end + 0.5) this.spend();
  }
}

// ------------------------------------------------------------------ CHAKRI (ground spinner)
class Chakri extends C3 {
  build() {
    const col = this.p.colours ? '#2f6fb0' : '#1f8a5a';
    const torus = mesh(new THREE.TorusGeometry(0.075, 0.017, 5, 14), col, 0, 0.02, 0); torus.rotation.x = Math.PI / 2;
    this.wheel = new THREE.Group(); this.wheel.add(torus);
    this.wheel.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), '#c8323c', 0, 0.02, 0));
    const stripe = mesh(new THREE.TorusGeometry(0.075, 0.019, 3, 14, 1.2), '#ffcf4a', 0, 0.02, 0); stripe.rotation.x = Math.PI / 2; this.wheel.add(stripe);
    this.g.add(this.wheel);
    this.fuseLocal.set(0.09, 0.03, 0); this.radius = 0.1; this.shellCol = '#2a2a2a';
    this.th = 0; this.vel = new THREE.Vector2();
  }
  tick(dt, t) {
    const p = this.p, k = sample(p.curve, p.burn, t - p.fuse);
    if (t >= p.fuse && k > 0.01) {
      const w = p.rps * Math.PI * 2 * Math.min(1, k * 1.3);
      this.th += w * dt; this.wheel.rotation.y = this.th;
      // it skids about on the ground
      this.vel.x += rnd(-3, 3) * dt * k; this.vel.y += rnd(-3, 3) * dt * k; this.vel.multiplyScalar(0.97);
      const o = this.w.collide(this.g.position.x + this.vel.x * dt, this.g.position.z + this.vel.y * dt, 0.12);
      if (o.hit) this.vel.multiplyScalar(-0.5);
      this.g.position.x = o.x; this.g.position.z = o.z;
      const gy = this.g.rotation.y + this.th, c = this.g.position;
      for (let i = this.count(420 * k, dt); i > 0; i--) {
        const a = gy + rnd(-0.3, 0.3), rx = Math.cos(a) * 0.09, rz = -Math.sin(a) * 0.09, s = rnd(3, 6.5) * (0.6 + 0.4 * k);
        const col = p.colours ? p.colours[Math.floor(Math.random() * p.colours.length)] : pickW([['#ffd27a', 0.6], ['#fff1c9', 0.25], ['#ff9a3c', 0.15]]);
        this.w.sparks.spawn({ x: c.x + rx, y: 0.04, z: c.z + rz, vx: Math.sin(a) * s, vy: rnd(0.3, 1.6), vz: Math.cos(a) * s, life: rnd(0.25, 0.6), size: rnd(0.04, 0.06), c: col, drag: 1.4, grav: 9.8, bounce: 0.35 });
      }
      this.w.glowAt({ x: c.x, y: 0.3, z: c.z }, p.colours ? p.colours[0] : '#ffaa55', 8 + 30 * k);
      if (Math.random() < dt * 4 * k) this.smokePuff({ x: c.x, y: 0.1, z: c.z }, 0.6);
    }
    if (t > p.end + 0.3) this.spend();
  }
}

// ------------------------------------------------------------------ ROCKET (in a bottle)
class Rocket extends C3 {
  build() {
    this.g.add(mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.2, 8), '#2c6b4b', 0, 0.1, 0));
    this.g.add(mesh(new THREE.CylinderGeometry(0.02, 0.055, 0.07, 8), '#2c6b4b', 0, 0.235, 0));
    this.g.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.03, 8), '#3d8a62', 0, 0.28, 0));
    const r = this.rocket = new THREE.Group();
    r.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 4), '#c49a6c', 0, 0.05, 0));
    r.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), '#c8323c', 0, 0.38, 0));
    r.add(mesh(new THREE.ConeGeometry(0.024, 0.06, 8), '#ffcf4a', 0, 0.49, 0));
    r.position.y = 0.0; this.g.add(r);
    this.fuseLocal.set(0.02, 0.3, 0); this.radius = 0.07; this.shellCol = '#1d4a35';
  }
  tick(dt, t) {
    const p = this.p, w = this.w;
    if (t >= p.launch && !this.flying && !this.burst) {
      this.flying = true;
      this.from = this.g.localToWorld(new THREE.Vector3(0, 0.3, 0));
      this.g.remove(this.rocket); w.scene.add(this.rocket);
      const cam = w.camera.position, away = new THREE.Vector2(this.from.x - cam.x, this.from.z - cam.z).normalize();
      this.dir = away.rotateAround(new THREE.Vector2(), rnd(-0.5, 0.5));
      this.H = 18 + 16 * p.height;
      w.flash(this.from, '#ffb066', 12, 250);
      for (let i = 0; i < 6; i++) this.smokePuff(this.from, 0.6);
    }
    if (this.flying) {
      const fl = p.burst - p.launch, u = Math.min(1, (t - p.launch) / fl), y = this.H * (1 - (1 - u) * (1 - u)), dx = (0.4 + Math.abs(p.drift)) * this.H * u;
      const pos = V.set(this.from.x + this.dir.x * dx, this.from.y + y - 0.38, this.from.z + this.dir.y * dx);
      this.rocket.position.copy(pos);
      this.rocket.rotation.set(0, 0, 0);
      const tail = { x: pos.x, y: pos.y + 0.3, z: pos.z };
      for (let i = this.count(300 * (1 - u * 0.5), dt); i > 0; i--) this.w.sparks.spawn({ ...tail, vx: rnd(-0.6, 0.6), vy: rnd(-4, -1.5), vz: rnd(-0.6, 0.6), life: rnd(0.2, 0.5), size: rnd(0.05, 0.09), c: pickW([['#ffd27a', 0.6], ['#ff9a3c', 0.4]]), drag: 2, grav: 2 });
      w.glowAt(tail, '#ffaa55', 10);
      if (u >= 1) {
        this.flying = false; this.burst = true; w.scene.remove(this.rocket);
        w.burst(this.rocket.position.clone().add(new THREE.Vector3(0, 0.4, 0)), p, PALETTES[p.colour] || PALETTES.gold, p.colour2 ? PALETTES[p.colour2] : null, 1);
      }
    }
    if (t > p.end) this.spend();
  }
  remove() { super.remove(); this.w.scene.remove(this.rocket); }
}

// ------------------------------------------------------------------ LADI (string of crackers)
class Ladi extends C3 {
  build() {
    const p = this.p, m = this.m = Math.min(p.n, p.n >= 1000 ? 150 : 64), step = p.n >= 1000 ? 0.036 : 0.05, L = m * step;
    this.L = L;
    this.segs = new THREE.InstancedMesh(flat(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 6)), toon(p.n >= 1000 ? '#b8242c' : '#d9303a'), m);
    this.mats = [];
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1);
    for (let k = 0; k < m; k++) {
      const side = k % 2 ? 1 : -1, pos = new THREE.Vector3(L / 2 - k * step, 0.012, side * 0.022);
      e.set(Math.PI / 2, 0, side * 0.6); q.setFromEuler(e);
      mx.compose(pos, q, sc); this.segs.setMatrixAt(k, mx); this.mats.push(pos);
    }
    this.g.add(this.segs);
    this.g.add(mesh(new THREE.BoxGeometry(L + 0.1, 0.006, 0.006), '#c49a6c', 0, 0.012, 0));
    this.fuseLocal.set(L / 2 + 0.07, 0.015, 0); this.radius = 0.15; this.mass = 0.8;
    this.next = 0;
  }
  tick(dt, t) {
    const p = this.p, w = this.w, hide = new THREE.Matrix4().makeScale(0, 0, 0);
    let popped = 0;
    while (this.next < p.pops.length && p.pops[this.next].t <= t) {
      const q = p.pops[this.next++], k = Math.min(this.m - 1, Math.floor((q.i / p.n) * this.m));
      this.segs.setMatrixAt(k, hide); this.segs.instanceMatrix.needsUpdate = true;
      if (q.dud || popped++ > 4) continue;
      const pos = this.g.localToWorld(V.copy(this.mats[k]));
      for (let i = Math.round(10 * this.q + 3); i > 0; i--) { const a = Math.random() * Math.PI * 2, s = rnd(1.5, 4.5); w.sparks.spawn({ x: pos.x, y: pos.y + 0.02, z: pos.z, vx: Math.cos(a) * s, vy: rnd(0.5, 3), vz: Math.sin(a) * s, life: rnd(0.06, 0.2), size: 0.05, c: Math.random() < 0.5 ? '#fff4d0' : '#ffd27a', drag: 3, grav: 4 }); }
      w.sparks.spawn({ x: pos.x, y: pos.y + 0.05, z: pos.z, life: 0.07, size: 0.6, c: '#fff6e0', grav: 0 });
      for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; w.smoke.spawn({ x: pos.x, y: pos.y + 0.03, z: pos.z, vx: Math.cos(a) * rnd(0.5, 1.5), vy: rnd(1, 3), vz: Math.sin(a) * rnd(0.5, 1.5), life: rnd(2, 3.5), size: 0.045, c: Math.random() < 0.7 ? '#d9303a' : '#e8d9b0', grav: 5, drag: 1.5, f: F.STICK }); }
      if (Math.random() < 0.5) this.smokePuff(pos, 0.5);
      w.flash(pos, '#fff1d6', 9, 90);
      w.impulse(pos, 0.5, 0.5);
      if (Math.random() < 0.08) w.scorch(pos, 0.12);
    }
    if (this.next >= p.pops.length && t > p.end + 0.2) this.remove();
  }
}

// ------------------------------------------------------------------ BOMBS (sutli, bijli, atom)
class Bomb extends C3 {
  build() {
    const p = this.p;
    if (p.tube) { // bijli: a small red tube
      this.g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8), '#d9303a', 0, 0.04, 0));
      this.g.add(mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.015, 8), '#ffcf4a', 0, 0.05, 0));
      this.g.add(mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.05, 3), '#c49a6c', 0, 0.1, 0));
      this.fuseLocal.set(0, 0.125, 0); this.radius = 0.04; this.size = 0.5; this.paper = '#d9303a';
    } else if (p.big) { // atom bomb
      this.g.add(mesh(new THREE.IcosahedronGeometry(0.1, 1), '#2f8f4e', 0, 0.1, 0));
      for (const r of [0, 1.05, -1.05]) { const t = mesh(new THREE.TorusGeometry(0.11, 0.006, 3, 16), '#ffcf4a', 0, 0.1, 0); t.rotation.set(Math.PI / 2, r, 0); this.g.add(t); }
      const f = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 3), '#c49a6c', 0.04, 0.22, 0); f.rotation.z = -0.5; this.g.add(f);
      this.fuseLocal.set(0.065, 0.26, 0); this.radius = 0.11; this.size = 1.6; this.paper = '#2f8f4e'; this.mass = 1;
    } else { // sutli bomb
      this.g.add(mesh(new THREE.IcosahedronGeometry(0.075, 1), '#c48a50', 0, 0.075, 0));
      for (const r of [0, 1.1, 2.2]) { const t = mesh(new THREE.TorusGeometry(0.077, 0.006, 3, 14), '#7a5228', 0, 0.075, 0); t.rotation.set(r, r * 0.7, 0); this.g.add(t); }
      const f = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 3), '#c49a6c', 0.035, 0.17, 0); f.rotation.z = -0.5; this.g.add(f);
      this.fuseLocal.set(0.055, 0.205, 0); this.radius = 0.08; this.size = 1; this.paper = '#c48a50'; this.mass = 0.8;
    }
    this.times = [p.bang, ...(p.extra || [])]; this.k = 0;
  }
  tick(dt, t) {
    while (this.k < this.times.length && t >= this.times[this.k]) {
      const pos = this.g.position.clone(); pos.y = 0.05;
      if (this.k > 0) { pos.x += rnd(-0.4, 0.4); pos.z += rnd(-0.4, 0.4); }
      this.w.bang(pos, this.size * (this.k ? 0.85 : 1), { paper: this.paper });
      this.g.visible = false; this.k++;
    }
    if (this.k >= this.times.length && t > this.p.end) this.remove();
  }
}

// ------------------------------------------------------------------ PHULJHADI and PENCIL (handheld)
class Sparkler extends C3 {
  build() {
    const p = this.p, coat = p.pencil ? '#e8e0d0' : '#5a5e66';
    this.g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.5, 4), '#9aa0a8', 0, 0.25, 0));
    this.coat = mesh(new THREE.CylinderGeometry(p.pencil ? 0.009 : 0.006, p.pencil ? 0.009 : 0.006, 0.32, 5), coat, 0, 0.34, 0);
    this.g.add(this.coat);
    if (p.pencil) this.g.add(mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.06, 5), p.colour, 0, 0.46, 0));
    this.g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 5), '#8a5a2b', 0, 0.05, 0));
    this.fuseLocal.set(0, 0.5, 0); this.radius = 0.06; this.mass = 0.2; this.noFuse = true;
  }
  /** Stuck in the ground at an angle (the "Place" action). */
  plant() { this.g.rotation.z = 0.35; this.g.position.y = -0.04; }
  tick(dt, t) {
    const p = this.p, w = this.w, k = t < p.fuse ? 0.3 : sample(p.curve, p.burn, t - p.fuse), burnt = Math.max(0, Math.min(1, (t - p.fuse) / p.burn));
    // the coating burns down the wire
    this.coat.scale.y = 1 - burnt * 0.95; this.coat.position.y = 0.18 + 0.16 * this.coat.scale.y;
    const tip = this.g.localToWorld(V.set(0, 0.18 + 0.32 * (1 - burnt * 0.95), 0));
    if (k > 0.01) {
      if (p.pencil) {
        for (let i = this.count(160 * k, dt); i > 0; i--) w.sparks.spawn({ x: tip.x, y: tip.y, z: tip.z, vx: rnd(-0.4, 0.4), vy: rnd(0.2, 1), vz: rnd(-0.4, 0.4), life: rnd(0.15, 0.45), size: rnd(0.06, 0.12), c: Math.random() < 0.8 ? p.colour : '#ffffff', drag: 2, grav: -0.5 });
        w.glowAt(tip, p.colour, 6 + 8 * k);
      } else {
        const cols = p.colours || ['#fff3c4', '#ffd27a', '#ffffff'];
        for (let i = this.count(300 * k, dt); i > 0; i--) {
          const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z), s = rnd(1.2, 3.4);
          w.sparks.spawn({ x: tip.x, y: tip.y, z: tip.z, vx: r * Math.cos(a) * s, vy: z * s, vz: r * Math.sin(a) * s, life: rnd(0.12, 0.35), size: rnd(0.025, 0.04), c: cols[Math.floor(Math.random() * cols.length)], drag: 3, grav: 2, f: Math.random() < 0.35 ? F.SPLIT : 0 });
        }
        w.sparks.spawn({ x: tip.x, y: tip.y, z: tip.z, life: 0.05, size: 0.2, c: '#fff6e0', grav: 0 });
        w.glowAt(tip, '#fff1d6', 8 + 10 * k);
      }
      if (Math.random() < dt * 3) this.smokePuff(tip, 0.35, '#b8b8bc');
    }
    if (t > p.end) this.remove();
  }
}

// ------------------------------------------------------------------ SAANP GOLI (snake tablet)
class Snake extends C3 {
  build() {
    this.g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8), '#1a1714', 0, 0.008, 0));
    this.max = 80;
    this.ash = new THREE.InstancedMesh(flat(new THREE.IcosahedronGeometry(0.03, 0)), toon('#4a443e'), this.max);
    this.ash.count = 0; this.g.add(this.ash);
    this.fuseLocal.set(0, 0.02, 0); this.radius = 0.05; this.mass = 0.2;
    this.head = new THREE.Vector3(0, 0.02, 0); this.dir = new THREE.Vector3(rnd(-1, 1), 0, rnd(-1, 1)).normalize(); this.grown = 0;
  }
  tick(dt, t) {
    const p = this.p, w = this.w;
    if (t >= p.fuse && t < p.end) {
      const k = sample(p.curve, p.burn, t - p.fuse), target = Math.min(this.max, Math.floor(((t - p.fuse) / p.burn) * this.max));
      while (this.ash.count < target) {
        const i = this.ash.count++, u = i / this.max;
        this.dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rnd(-0.6, 0.6));
        this.head.addScaledVector(this.dir, 0.018);
        this.head.y = 0.02 + Math.sin(u * Math.PI) * 0.12 + Math.sin(u * 9) * 0.02;
        const s = 0.8 + Math.random() * 0.5;
        this.ash.setMatrixAt(i, new THREE.Matrix4().compose(this.head, new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
        this.ash.instanceMatrix.needsUpdate = true;
      }
      const hp = this.g.localToWorld(V.copy(this.head));
      // the snake tablet is the smokiest cracker of all: lots of thick smoke
      for (let i = this.count(26 * k, dt); i > 0; i--) w.smoke.spawn({ x: hp.x, y: hp.y, z: hp.z, vx: rnd(-0.15, 0.15), vy: rnd(0.3, 0.7), vz: rnd(-0.15, 0.15), life: rnd(3, 5), size: 0.15, size1: rnd(0.9, 1.5), c: pickW([['#5e5a56', 0.5], ['#77726c', 0.5]]), a: 0.45, grav: -0.1, drag: 0.6 });
      if (Math.random() < dt * 20) w.sparks.spawn({ x: hp.x, y: hp.y, z: hp.z, life: 0.2, size: 0.05, c: '#ff9a3c', grav: 0 });
      w.glowAt(hp, '#ff7a2a', 1.5);
    }
    if (t > p.end) { this.done = true; this.spent = true; this.body.locked = false; }
  }
}

// ------------------------------------------------------------------ SKY SHOT (multi-shot cake)
class SkyShot extends C3 {
  build() {
    const big = this.p.shots.length > 15;
    this.g.add(mesh(new THREE.BoxGeometry(0.28, big ? 0.3 : 0.24, 0.28), '#7b46b3', 0, big ? 0.15 : 0.12, 0));
    this.g.add(mesh(new THREE.BoxGeometry(0.29, 0.03, 0.29), '#ffcf4a', 0, big ? 0.2 : 0.16, 0));
    this.top = big ? 0.3 : 0.24;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) this.g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 6), '#1b1030', i * 0.08, this.top + 0.004, j * 0.08));
    const f = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 3), '#c49a6c', 0.17, 0.05, 0); f.rotation.z = 1.2; this.g.add(f);
    this.fuseLocal.set(0.21, 0.07, 0); this.radius = 0.2; this.mass = 1.2; this.shellCol = '#3a2a4a';
    this.k = 0; this.comets = [];
  }
  tick(dt, t) {
    const p = this.p, w = this.w;
    while (this.k < p.shots.length && t >= p.shots[this.k].launch) {
      const s = p.shots[this.k++], from = this.g.localToWorld(new THREE.Vector3(rnd(-0.08, 0.08), this.top, rnd(-0.08, 0.08))), cam = w.camera.position;
      const dir = new THREE.Vector2(from.x - cam.x, from.z - cam.z).normalize().rotateAround(new THREE.Vector2(), rnd(-0.7, 0.7));
      this.comets.push({ s, from, dir, H: 14 + 14 * s.height, pos: from.clone() });
      w.flash(from, '#ffb066', 14, 160);
      this.smokePuff(from, 0.7);
      w.sparks.spawn({ x: from.x, y: from.y + 0.1, z: from.z, life: 0.08, size: 0.8, c: '#fff1d6', grav: 0 });
    }
    this.comets = this.comets.filter((c) => {
      const fl = c.s.burst - c.s.launch, u = Math.min(1, (t - c.s.launch) / fl), dx = (0.2 + Math.abs(c.s.drift)) * c.H * u;
      c.pos.set(c.from.x + c.dir.x * dx, c.from.y + c.H * (1 - (1 - u) * (1 - u)), c.from.z + c.dir.y * dx);
      for (let i = this.count(140, dt); i > 0; i--) w.sparks.spawn({ x: c.pos.x, y: c.pos.y, z: c.pos.z, vx: rnd(-0.3, 0.3), vy: rnd(-1.5, -0.3), vz: rnd(-0.3, 0.3), life: rnd(0.2, 0.45), size: 0.08, c: '#ffcf6e', drag: 2, grav: 1.5 });
      if (u >= 1) { w.burst(c.pos, c.s, PALETTES[c.s.colour] || PALETTES.gold, null, 0.85); return false; }
      return true;
    });
    if (t > p.end) this.spend();
  }
}

export const KINDS = { anar: Anar, chakri: Chakri, rocket: Rocket, ladi: Ladi, bomb: Bomb, phuljhadi: Sparkler, snake: Snake, skyshot: SkyShot };

/** Flashlight bursts for a plan: [{ t, ms }]. */
export const TORCH = {
  anar: (p) => [{ t: p.fuse + 0.05, ms: 350 }, { t: p.fuse + p.burn * 0.5, ms: 250 }],
  chakri: (p) => [{ t: p.fuse + 0.1, ms: 200 }],
  rocket: (p) => [{ t: p.burst, ms: 140 }],
  bomb: (p) => [p.bang, ...(p.extra || [])].map((t) => ({ t, ms: p.big ? 420 : p.tube ? 150 : 260 })),
  ladi: (p) => { const out = []; let last = -1; for (const q of p.pops) if (!q.dud && q.t - last > 0.18) { out.push({ t: q.t, ms: 45 }); last = q.t; } return out; },
  skyshot: (p) => p.shots.map((s) => ({ t: s.burst, ms: 120 })),
  phuljhadi: () => [], snake: () => [],
};
