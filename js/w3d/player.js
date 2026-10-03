// First-person player: walk with the joystick (or WASD), drag to look. Also the
// lighter held in the hand: an agarbatti, a candle or a phuljhadi.

import * as THREE from '../vendor/three.module.min.js';
import { toon, glow, flat } from './art.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Player {
  constructor(world) {
    this.w = world;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = -0.12; this.eye = 1.6; this.bob = 0; this.bobOn = true;
    this.move = { x: 0, y: 0 }; this.keys = new Set(); this.run = false;
  }
  spawn(s) { this.pos.set(s.x, 0, s.z); this.yaw = s.yaw || 0; this.pitch = -0.15; this.vel.set(0, 0, 0); this.apply(); }
  look(dx, dy) {
    this.yaw -= dx; this.pitch = Math.max(-1.45, Math.min(1.35, this.pitch - dy));
  }
  update(dt) {
    let mx = this.move.x, my = this.move.y;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) my += 1;
    if (k.has('s') || k.has('arrowdown')) my -= 1;
    if (k.has('a')) mx -= 1;
    if (k.has('d')) mx += 1;
    if (k.has('arrowleft')) this.yaw += dt * 2;
    if (k.has('arrowright')) this.yaw -= dt * 2;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    const speed = k.has('shift') ? 4.5 : 2.6; // an easy stroll: nothing in the game needs running
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward is -z in camera space
    const tx = (mx * cos - my * sin) * speed, tz = (-mx * sin - my * cos) * speed;
    const a = Math.min(1, dt * 10);
    this.vel.x += (tx - this.vel.x) * a; this.vel.z += (tz - this.vel.z) * a;
    const o = this.w.collide(this.pos.x + this.vel.x * dt, this.pos.z + this.vel.z * dt, 0.3);
    this.pos.x = o.x; this.pos.z = o.z;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.bobOn && sp > 0.3) this.bob += dt * sp * 2.4; else this.bob *= 0.9;
    this.apply();
  }
  apply() {
    const c = this.w.camera;
    c.position.set(this.pos.x, this.eye + (this.bobOn ? Math.sin(this.bob * 2) * 0.035 : 0), this.pos.z);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.w.camera.quaternion); }
  right(out = new THREE.Vector3()) { return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
}

// ------------------------------------------------------------------ the lighter in your hand
export const LIGHTERS = {
  agarbatti: { name: 'Agarbatti', hi: 'अगरबत्ती', catch: 0.4 },
  candle: { name: 'Candle', hi: 'मोमबत्ती', catch: 0.3 },
  phuljhadi: { name: 'Phuljhadi', hi: 'फुलझड़ी', catch: 0.15 },
};
const REST = new THREE.Vector3(0.2, -0.25, -0.48);

export class Lighter {
  constructor(world) {
    this.w = world; this.kind = 'agarbatti'; this.out = false;
    this.g = new THREE.Group(); this.g.position.copy(REST); this.g.visible = false;
    this.reach = 0; this.goal = REST.clone(); this.tipLocal = new THREE.Vector3();
    this.build();
  }
  attach() { this.w.hand.add(this.g); }
  build() {
    this.g.clear();
    const add = (geom, col, x, y, z, e) => { const m = new THREE.Mesh(flat(geom), e ? glow(col) : toon(col)); m.position.set(x, y, z); this.g.add(m); return m; };
    // a blocky cartoon fist around the stick, with a kurta sleeve
    const skin = '#c98b5a', skin2 = '#b07548';
    add(new THREE.BoxGeometry(0.04, 0.055, 0.035), skin, 0.012, -0.025, 0.02); // palm
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.014, 0.012, 0.016), i % 2 ? skin : skin2, -0.012, -0.004 - i * 0.0135, 0.004); // curled fingers
    add(new THREE.BoxGeometry(0.012, 0.03, 0.014), skin2, -0.004, 0.012, 0.012).rotation.z = 0.5; // thumb
    const wrist = add(new THREE.BoxGeometry(0.036, 0.05, 0.032), skin, 0.02, -0.07, 0.03); wrist.rotation.z = -0.25;
    const sleeve = add(new THREE.CylinderGeometry(0.03, 0.036, 0.22, 7), '#e8762a', 0.05, -0.18, 0.05); sleeve.rotation.z = -0.35;
    const cuff = add(new THREE.CylinderGeometry(0.031, 0.031, 0.02, 7), '#ffd23f', 0.032, -0.085, 0.04); cuff.rotation.z = -0.35;
    if (this.kind === 'candle') {
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), '#fff4e0', 0, 0.06, 0);
      this.flame = add(new THREE.ConeGeometry(0.012, 0.04, 6), '#ffcf5a', 0, 0.165, 0, true);
      this.tipLocal.set(0, 0.17, 0);
    } else if (this.kind === 'phuljhadi') {
      add(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 4), '#9aa0a8', 0, 0.12, 0);
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 5), '#5a5e66', 0, 0.22, 0);
      this.flame = null; this.tipLocal.set(0, 0.27, 0);
    } else {
      add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.26, 4), '#5a3a22', 0, 0.1, 0);
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), '#2b1a10', 0, 0.2, 0);
      this.flame = add(new THREE.SphereGeometry(0.007, 5, 4), '#ff5a1a', 0, 0.24, 0, true);
      this.tipLocal.set(0, 0.24, 0);
    }
    this.g.rotation.set(-0.5, 0, 0.25);
  }
  setKind(k) { this.kind = LIGHTERS[k] ? k : 'agarbatti'; this.build(); }
  get catchTime() { return LIGHTERS[this.kind].catch; }
  show(on) { this.out = on; this.g.visible = on; }
  tip(out = new THREE.Vector3()) { this.g.updateWorldMatrix(true, false); return this.g.localToWorld(out.copy(this.tipLocal)); }
  /** Reach the tip towards a world point (null = back to rest). */
  reachTo(p) {
    if (!p) { this.goal.copy(REST); return; }
    const local = this.w.camera.worldToLocal(p.clone());
    // keep the hand on screen: move it at most part of the way
    local.sub(this.tipLocal.clone().applyEuler(this.g.rotation));
    local.z = Math.max(-0.9, Math.min(-0.3, local.z)); local.x = Math.max(-0.2, Math.min(0.35, local.x)); local.y = Math.max(-0.45, Math.min(0.1, local.y));
    this.goal.copy(local);
  }
  update(dt, t) {
    this.g.position.lerp(this.goal, Math.min(1, dt * 9));
    if (!this.out) return;
    const w = this.w;
    if (this.flame) { const f = 1 + Math.sin(t * 15) * 0.12; this.flame.scale.set(f, f * (this.kind === 'candle' ? 1.2 : 1), f); }
    const tip = this.tip();
    if (this.kind === 'phuljhadi') {
      for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, z = rnd(-1, 1), r = Math.sqrt(1 - z * z), s = rnd(0.6, 1.4); w.sparks.spawn({ x: tip.x, y: tip.y, z: tip.z, vx: r * Math.cos(a) * s, vy: z * s, vz: r * Math.sin(a) * s, life: rnd(0.08, 0.2), size: 0.015, c: '#fff3c4', drag: 3, grav: 1 }); }
      w.glowAt(tip, '#fff1d6', 2.5);
    } else if (this.kind === 'candle') w.glowAt(tip, '#ffb347', 1.6);
    else if (Math.random() < dt * 5) w.smoke.spawn({ x: tip.x, y: tip.y, z: tip.z, vx: rnd(-0.02, 0.02), vy: 0.15, vz: rnd(-0.02, 0.02), life: 2.2, size: 0.01, size1: 0.12, c: '#c8c8cc', a: 0.25, grav: -0.04, drag: 0.4 });
  }
}
