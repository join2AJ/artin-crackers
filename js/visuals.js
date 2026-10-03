// What each cracker looks like. A visual reads the same plan as the sound, so
// pops, bursts and flashes land exactly on the audio. Each class has:
//   update(dt)  move and emit sparks (fx canvas)
//   draw(c)     paint the body on the props canvas
//   static torch(plan)  flashlight bursts [{ t, ms }]

import { PALETTES, sample } from './crackers.js';
import { rng } from './synth.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pickW = (list) => { let r = Math.random(); for (const [v, w] of list) { if ((r -= w) <= 0) return v; } return list[0][0]; };


/** Soft contact shadow under a body. */
function shadow(c, x, y, rx, ry, a = 0.45) {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = g; c.beginPath(); c.arc(x, y, rx, 0, Math.PI * 2); c.fill(); c.restore();
}
/** A cylinder-style horizontal gradient: dark edges, colour, a bright highlight. */
function tube(c, x0, x1, cols) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, cols[2]); g.addColorStop(0.28, cols[0]); g.addColorStop(0.42, cols[1]); g.addColorStop(0.6, cols[0]); g.addColorStop(1, cols[2]);
  return g;
}

class Visual {
  constructor(st, plan, x, y, when) {
    this.st = st; this.p = plan; this.x = x; this.y = y; this.when = when; this.done = false;
    this.k = st.scene.depth(y); // nearer = bigger
    this.acc = 0;
  }
  /** Seconds since lighting. An unlit cracker (lit === false) stays frozen at 0. */
  get t() { return this.lit === false ? 0 : (performance.now() - this.when) / 1000; }
  /** Where its fuse is: touch a lighter here to light it. */
  fusePoint() { return { x: this.x, y: this.y - 10 * this.u }; }
  get u() { return this.st.scene.u * this.k; }
  /** Number of particles to emit this frame for a rate per second (keeps fractions). */
  count(rate, dt) { this.acc += rate * dt; const n = Math.floor(this.acc); this.acc -= n; return n; }
  fuseSpark(x, y, dt) {
    const u = this.u;
    for (let i = this.count(70, dt); i > 0; i--) {
      const a = rnd(0, Math.PI * 2), s = rnd(20, 70) * u;
      this.st.sparks.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20 * u, life: rnd(0.08, 0.22), colour: Math.random() < 0.5 ? '#ffe6a8' : '#ff9a3c', size: 1.1 * u, drag: 2, grav: 120 * u });
    }
    this.st.scene.lights.push({ x, y, r: 26 * u, colour: 'rgba(255,170,80,1)', a: 0.35 + Math.random() * 0.2 });
  }
  static torch() { return []; }
}

/** A firework shell bursting at (x, y). Shared by rockets, sky shots and the distant neighbourhood. */
export function burst(st, x, y, b, { scale = 1, alpha = 1 } = {}) {
  const u = st.scene.u * scale, pal = PALETTES[b.colour] || PALETTES.gold, pal2 = b.colour2 ? PALETTES[b.colour2] : null;
  const V = 235 * u * ((b.size ?? 0.6) / 0.6);
  const n = Math.round((b.type === 'willow' ? 110 : b.type === 'ring' ? 90 : 150) * (alpha < 1 ? 0.5 : 1));
  for (let i = 0; i < n; i++) {
    let dx, dy;
    if (b.type === 'ring') { const a = (i / n) * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a) * 0.6; }
    else { const z = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, r = Math.sqrt(1 - z * z); dx = r * Math.cos(phi); dy = r * Math.sin(phi); }
    const s = V * rnd(0.88, 1.04), col = (pal2 && i % 2 ? pal2 : pal)[i % 3 === 0 ? 1 : 0];
    const o = { x, y, vx: dx * s, vy: dy * s, life: rnd(1.3, 1.9), colour: col, size: 2.2 * u, drag: 1.9, grav: 75 * u, alpha, glow: true };
    if (b.type === 'willow') Object.assign(o, { life: rnd(2.4, 3.1), drag: 2.5, grav: 120 * u, trail: 0.55, tcol: '#ffb347', colour: '#ffcf6e', size: 1.6 * u });
    else if (b.type === 'crackle') Object.assign(o, { life: rnd(0.9, 1.5), crackle: true, colour: '#ffd27a', split: 2 });
    else if (Math.random() < 0.25) Object.assign(o, { flicker: true, trail: 0.15, tcol: col });
    st.sparks.add(o);
  }
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = rnd(10, 60) * u;
    st.sparks.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.12, 0.3), colour: '#ffffff', size: 3 * u, drag: 3, grav: 0, alpha, dot: true });
  }
  st.flash(x, y, 0.5 * alpha * (b.size ?? 0.6) / 0.6, alpha < 1 ? 600 : 520, pal[0]);
}

// ------------------------------------------------------------------ ANAR
class Anar extends Visual {
  fusePoint() { return { x: this.x, y: this.y - 32 * this.u }; }
  update(dt) {
    const t = this.t, p = this.p, u = this.u, st = this.st, tipY = this.y - 30 * u;
    if (t < p.fuse) { this.fuseSpark(this.x, tipY - 3 * u, dt); return; }
    const k = sample(p.curve, p.burn, t - p.fuse);
    if (k > 0.01) {
      const H = Math.min(tipY * 0.78, 340 * u) * (0.5 + 0.5 * k), g = 560 * u, v0 = Math.sqrt(2 * g * H);
      for (let i = this.count(430 * k, dt); i > 0; i--) {
        const a = -Math.PI / 2 + (Math.random() + Math.random() - 1) * 0.3, s = v0 * rnd(0.5, 1);
        st.sparks.add({ x: this.x + rnd(-1.5, 1.5) * u, y: tipY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.7, 1.35),
          colour: p.colours && Math.random() < 0.7 ? p.colours[Math.floor((t - p.fuse) / 1.1 + Math.random() * 0.6) % p.colours.length] : pickW([['#ffcf6e', 0.62], ['#fff1c9', 0.25], ['#ff9a3c', 0.13]]), size: rnd(1.2, 2) * u * 0.8, drag: 0.5, grav: g,
          floor: this.y + rnd(-4, 10) * u, bounce: 0.3, split: Math.random() < 0.12 ? 3 : 0, flicker: Math.random() < 0.12 });
      }
      st.scene.lights.push({ x: this.x, y: this.y - 14 * u, r: (40 + 150 * k) * u, colour: 'rgba(255,170,70,1)', a: 0.5 * k });
      st.scene.lights.push({ x: this.x, y: tipY - H * 0.5, r: H * 0.8, colour: 'rgba(255,190,110,1)', a: 0.12 * k });
    }
    if (t > p.end + 2) this.done = true;
  }
  draw(c) {
    const u = this.u, x = this.x, y = this.y, burnt = this.t > this.p.end;
    c.save(); c.globalAlpha = Math.min(1, (this.p.end + 2 - this.t) / 0.8);
    shadow(c, x, y + 1 * u, 16 * u, 4.5 * u);
    const cols = burnt ? ['#4a2420', '#6a3a30', '#22100c'] : this.p.colours ? ['#6d36b8', '#b98cff', '#2a1046'] : ['#d23a2e', '#ff8a5c', '#5e140f'];
    const top = y - 30 * u;
    // clay pot: a cone with a rounded belly
    c.fillStyle = tube(c, x - 12 * u, x + 12 * u, cols);
    c.beginPath(); c.moveTo(x - 2.6 * u, top);
    c.bezierCurveTo(x - 6 * u, top + 10 * u, x - 13 * u, y - 8 * u, x - 11 * u, y - 1 * u);
    c.quadraticCurveTo(x, y + 2.4 * u, x + 11 * u, y - 1 * u);
    c.bezierCurveTo(x + 13 * u, y - 8 * u, x + 6 * u, top + 10 * u, x + 2.6 * u, top); c.closePath(); c.fill();
    if (!burnt) {
      // painted bands: gold zigzag, a row of dots, a green ring
      c.strokeStyle = '#ffd34d'; c.lineWidth = 1.1 * u; c.beginPath();
      for (let i = 0; i <= 8; i++) { const px = x - 8.4 * u + (16.8 * u * i) / 8, py = y - 11 * u + (i % 2 ? -2 * u : 0); i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke();
      c.fillStyle = '#fff3d6'; for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(x + i * 2.4 * u, y - 5 * u + Math.abs(i) * 0.25 * u, 0.6 * u, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = this.p.colours ? '#53ff8f' : '#1fae6a'; c.lineWidth = 1.4 * u;
      c.beginPath(); c.moveTo(x - 5.4 * u, y - 19 * u); c.quadraticCurveTo(x, y - 17.6 * u, x + 5.4 * u, y - 19 * u); c.stroke();
    }
    // gloss
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.beginPath(); c.moveTo(x - 1.6 * u, top + 2 * u); c.quadraticCurveTo(x - 7 * u, y - 10 * u, x - 6.4 * u, y - 3 * u); c.lineTo(x - 4.6 * u, y - 3 * u); c.quadraticCurveTo(x - 5 * u, y - 10 * u, x - 0.6 * u, top + 2 * u); c.fill();
    // clay cap with the fuse hole
    c.fillStyle = '#7a4a2a'; c.beginPath(); c.ellipse(x, top, 3 * u, 1.2 * u, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a0d06'; c.beginPath(); c.ellipse(x, top, 1.2 * u, 0.5 * u, 0, 0, Math.PI * 2); c.fill();
    if (this.lit === false) { c.strokeStyle = '#c49a6c'; c.lineWidth = 0.9 * u; c.beginPath(); c.moveTo(x, top); c.quadraticCurveTo(x + 1.5 * u, top - 2 * u, x, top - 3 * u); c.stroke(); }
    c.restore();
  }

  static torch(p) { return [{ t: p.fuse + 0.05, ms: 350 }, { t: p.fuse + p.burn * 0.5, ms: 250 }]; }
}

// ------------------------------------------------------------------ CHAKRI
class Chakri extends Visual {
  fusePoint() { return { x: this.x + 10 * this.u, y: this.y }; }
  constructor(...a) { super(...a); this.th = 0; this.ox = this.x; }
  update(dt) {
    const t = this.t, p = this.p, u = this.u, st = this.st, R = 10 * u;
    if (t < p.fuse) { this.fuseSpark(this.x + R, this.y, dt); return; }
    const k = sample(p.curve, p.burn, t - p.fuse);
    this.th += 2 * Math.PI * p.rps * Math.min(1, k * 1.3) * dt;
    this.x = this.ox + Math.sin((t - p.fuse) * 1.3) * 9 * u * Math.min(1, k * 2);
    if (k > 0.01) {
      for (let i = this.count(560 * k, dt); i > 0; i--) {
        const th = this.th + (i % 2 ? Math.PI : 0) + rnd(-0.15, 0.15), s = rnd(140, 330) * u * (0.6 + 0.4 * k);
        st.sparks.add({ x: this.x + Math.cos(th) * R, y: this.y + Math.sin(th) * R * 0.42, vx: -Math.sin(th) * s, vy: Math.cos(th) * s * 0.42 - rnd(0, 110) * u,
          life: rnd(0.3, 0.75), colour: pickW([['#ffd27a', 0.55], ['#fff4d6', 0.3], ['#ff8a5c', 0.15]]), size: 1.5 * u, drag: 1.4, grav: 520 * u,
          floor: this.y + rnd(-3, 9) * u, bounce: 0.35, flicker: Math.random() < 0.1 });
      }
      st.scene.lights.push({ x: this.x, y: this.y, r: (50 + 120 * k) * u, colour: 'rgba(255,190,90,1)', a: 0.55 * k });
    }
    if (t > p.end + 1.8) this.done = true;
  }
  draw(c) {
    const u = this.u, x = this.x, y = this.y, R = 10 * u, t = this.t, p = this.p;
    const k = t > p.fuse ? sample(p.curve, p.burn, t - p.fuse) : 0, burnt = t > p.end;
    c.save(); c.globalAlpha = Math.min(1, (p.end + 1.8 - t) / 0.8);
    shadow(c, x, y + 2 * u, R * 1.4, R * 0.5);
    // the coiled paper tube: rings of colour, turning
    const bands = burnt ? ['#2b2b24', '#3a3428', '#2b2b24', '#3a3428'] : ['#e8343f', '#ffd23f', '#1fae6a', '#3f8cff'];
    for (let i = 0; i < 4; i++) {
      const rr = R * (1 - i * 0.2);
      c.strokeStyle = bands[i]; c.lineWidth = R * 0.2;
      c.setLineDash([R * 0.5, R * 0.18]); c.lineDashOffset = -this.th * rr * (i % 2 ? 1 : -1);
      c.beginPath(); c.ellipse(x, y, rr - R * 0.1, (rr - R * 0.1) * 0.42, 0, 0, Math.PI * 2); c.stroke();
    }
    c.setLineDash([]);
    // gold foil hub
    const hub = c.createRadialGradient(x - 1 * u, y - 0.6 * u, 0, x, y, 3 * u);
    hub.addColorStop(0, '#fff3c4'); hub.addColorStop(1, '#b8860b');
    c.fillStyle = hub; c.beginPath(); c.ellipse(x, y, 3 * u, 1.4 * u, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(x - R * 0.3, y - R * 0.18, R * 0.45, R * 0.12, -0.2, 0, Math.PI * 2); c.fill();
    if (k > 0.05) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        c.globalAlpha = 0.5 * k * (1 - i * 0.25); c.strokeStyle = i ? '#ffb347' : '#fff1c4'; c.lineWidth = (3 - i * 0.7) * u;
        c.beginPath(); c.ellipse(x, y, R * (1.15 + i * 0.12), R * (1.15 + i * 0.12) * 0.42, 0, this.th + i, this.th + i + 2.2); c.stroke();
      }
    }
    c.restore();
  }

}

// ------------------------------------------------------------------ ROCKET
class Rocket extends Visual {
  fusePoint() { return { x: this.x + 1.5 * this.u, y: this.y - 34 * this.u }; }
  constructor(...a) {
    super(...a);
    const s = this.st, p = this.p;
    this.ax = this.x + p.drift * s.scene.w * 0.5;
    this.ay = Math.max(s.scene.h * 0.07, s.scene.horizon - p.height * (s.scene.horizon - s.scene.h * 0.07));
    this.burst = false;
  }
  pos(q) { const e = 1 - Math.pow(1 - q, 1.8), u = this.u; return { x: this.x + (this.ax - this.x) * e * e, y: this.y - 38 * u + (this.ay - (this.y - 38 * u)) * e }; }
  update(dt) {
    const t = this.t, p = this.p, u = this.u, st = this.st;
    if (t < p.launch) { this.fuseSpark(this.x, this.y - 22 * u, dt); return; }
    if (t < p.burst) {
      const q = (t - p.launch) / (p.burst - p.launch), a = this.pos(q), b = this.pos(Math.max(0, q - 0.02));
      for (let i = this.count(p.whistle ? 220 : 300, dt); i > 0; i--) {
        const f = Math.random();
        st.sparks.add({ x: b.x + (a.x - b.x) * f, y: b.y + (a.y - b.y) * f, vx: rnd(-30, 30) * u, vy: rnd(40, 140) * u, life: rnd(0.25, 0.65),
          colour: Math.random() < 0.7 ? '#ffc76b' : '#fff1c9', size: 1.5 * u, drag: 1.5, grav: 160 * u, flicker: Math.random() < 0.2 });
      }
      st.scene.lights.push({ x: a.x, y: a.y, r: 40 * u, colour: 'rgba(255,200,120,1)', a: 0.4 });
      this.head = a;
    } else if (!this.burst) {
      this.burst = true; this.head = null;
      burst(st, this.ax, this.ay, p);
    }
    if (t > p.end + 0.5) this.done = true;
  }
  draw(c) {
    const u = this.u, x = this.x, y = this.y;
    c.save(); c.globalAlpha = Math.min(1, (this.p.end + 0.5 - this.t) / 0.8);
    shadow(c, x, y + 1 * u, 10 * u, 3 * u);
    // glass bottle with a printed label
    const glass = c.createLinearGradient(x - 6 * u, 0, x + 6 * u, 0);
    glass.addColorStop(0, 'rgba(20,90,60,0.85)'); glass.addColorStop(0.35, 'rgba(70,170,120,0.65)'); glass.addColorStop(1, 'rgba(15,70,45,0.9)');
    c.fillStyle = glass;
    c.beginPath(); c.moveTo(x - 6 * u, y); c.lineTo(x - 6 * u, y - 16 * u); c.quadraticCurveTo(x - 6 * u, y - 20 * u, x - 2.2 * u, y - 22 * u); c.lineTo(x - 2.2 * u, y - 28 * u);
    c.lineTo(x + 2.2 * u, y - 28 * u); c.lineTo(x + 2.2 * u, y - 22 * u); c.quadraticCurveTo(x + 6 * u, y - 20 * u, x + 6 * u, y - 16 * u); c.lineTo(x + 6 * u, y); c.closePath(); c.fill();
    c.fillStyle = '#f2e6c4'; c.fillRect(x - 6 * u, y - 11 * u, 12 * u, 5.5 * u);
    c.fillStyle = '#e8343f'; c.fillRect(x - 6 * u, y - 11 * u, 12 * u, 1.2 * u); c.fillRect(x - 6 * u, y - 6.7 * u, 12 * u, 1.2 * u);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x - 4.6 * u, y - 19 * u, 1.2 * u, 7 * u); c.fillRect(x - 4.6 * u, y - 4.5 * u, 1.2 * u, 3.5 * u);
    if (this.t < this.p.launch) {
      c.strokeStyle = '#c49a6c'; c.lineWidth = 1.1 * u; c.beginPath(); c.moveTo(x, y - 8 * u); c.lineTo(x, y - 42 * u); c.stroke();
      // striped tube, foil nose cone, little fins
      c.fillStyle = tube(c, x - 2.4 * u, x + 2.4 * u, ['#d42a36', '#ff7a7a', '#6e0f16']); c.fillRect(x - 2.4 * u, y - 48 * u, 4.8 * u, 13 * u);
      c.fillStyle = '#fff3d6'; c.fillRect(x - 2.4 * u, y - 44 * u, 4.8 * u, 1.3 * u); c.fillRect(x - 2.4 * u, y - 40 * u, 4.8 * u, 1.3 * u);
      c.fillStyle = tube(c, x - 2.4 * u, x + 2.4 * u, ['#e0b23c', '#fff1b8', '#7a5a10']);
      c.beginPath(); c.moveTo(x - 2.4 * u, y - 48 * u); c.quadraticCurveTo(x - 1.6 * u, y - 52 * u, x, y - 54.5 * u); c.quadraticCurveTo(x + 1.6 * u, y - 52 * u, x + 2.4 * u, y - 48 * u); c.fill();
      c.fillStyle = '#1fae6a'; c.beginPath(); c.moveTo(x - 2.4 * u, y - 38 * u); c.lineTo(x - 4.6 * u, y - 35 * u); c.lineTo(x - 2.4 * u, y - 35.5 * u); c.fill();
      c.beginPath(); c.moveTo(x + 2.4 * u, y - 38 * u); c.lineTo(x + 4.6 * u, y - 35 * u); c.lineTo(x + 2.4 * u, y - 35.5 * u); c.fill();
    }
    if (this.head) {
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(this.head.x, this.head.y, 0, this.head.x, this.head.y, 9 * u);
      g.addColorStop(0, 'rgba(255,246,221,1)'); g.addColorStop(0.3, 'rgba(255,200,110,0.6)'); g.addColorStop(1, 'rgba(255,160,60,0)');
      c.fillStyle = g; c.beginPath(); c.arc(this.head.x, this.head.y, 9 * u, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  static torch(p) { return [{ t: p.burst, ms: 140 }]; }
}

// ------------------------------------------------------------------ BOMB
class Bomb extends Visual {
  fusePoint() { const u = this.u, R = (this.p.big ? 13 : this.p.tube ? 7 : 10) * u; return { x: this.x + R * 0.6 + Math.cos(-0.9) * 14 * u, y: this.y - R * 1.6 + Math.sin(-0.9) * 14 * u }; }
  constructor(...a) { super(...a); this.banged = false; this.glow = 0; }
  update(dt) {
    const t = this.t, p = this.p, u = this.u, st = this.st, R = (p.big ? 13 : p.tube ? 7 : 10) * u;
    if (t < p.bang) {
      const f = 1 - t / p.fuse, a = -0.9 + f * 0.1;
      this.fuseSpark(this.x + R * 0.6 + Math.cos(a) * 14 * u * f, this.y - R * 1.6 + Math.sin(a) * 14 * u * f, dt);
    } else if (!this.banged) {
      this.banged = true;
      const s = p.size, cy = this.y - R;
      st.flash(this.x, cy, p.big ? 1.15 : p.tube ? 0.55 : 1, p.big ? 900 : p.tube ? 380 : 650, '#fff1d6');
      st.shake(p.big ? 1.6 : p.tube ? 0.35 : 1);
      for (let i = 0; i < 110 * s; i++) {
        const a = rnd(-Math.PI, 0) + rnd(-0.2, 0.2), v = rnd(250, 760) * u * s;
        st.sparks.add({ x: this.x, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.12, 0.4), colour: pickW([['#ffffff', 0.35], ['#ffd27a', 0.4], ['#ff8a3c', 0.25]]), size: 2.2 * u, drag: 3, grav: 400 * u, floor: this.y + 6 * u });
      }
      st.scene.ring(this.x, this.y, 160 * u * s);
      st.scene.paper(this.x, cy, Math.round(46 * s), p.colour === 'green' ? ['#2f8f4e', '#ffcf4a', '#d9303a'] : p.tube ? ['#d9303a', '#b8242c', '#ffcf4a'] : ['#b07a45', '#8a5a2b', '#d9303a']);
      st.scene.puff(this.x, cy, 12, 1.3 * s);
      st.scene.burn(this.x, this.y, 30 * u * s);
      this.glow = 1;
    }
    if (this.glow > 0) { st.scene.lights.push({ x: this.x, y: this.y - R, r: 260 * u * p.size, colour: 'rgba(255,200,130,1)', a: this.glow }); this.glow -= dt * 3.5; }
    if (t > p.bang + 2.5) this.done = true;
  }
  draw(c) {
    if (this.banged) return;
    const u = this.u, p = this.p, R = (p.big ? 13 : p.tube ? 7 : 10) * u, x = this.x, y = this.y - R, f = Math.max(0, 1 - this.t / p.fuse);
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(x, this.y + 1.5 * u, R * 1.1, R * 0.35, 0, 0, Math.PI * 2); c.fill();
    if (p.tube) { // bijli: a small red paper tube standing upright
      const tw = 4.5 * u, th = 15 * u, top = this.y - th;
      const tg = c.createLinearGradient(x - tw, 0, x + tw, 0);
      tg.addColorStop(0, '#8e1d26'); tg.addColorStop(0.45, '#e2404a'); tg.addColorStop(1, '#6e141c');
      c.fillStyle = tg; c.fillRect(x - tw, top, tw * 2, th);
      c.fillStyle = '#ffcf4a'; c.fillRect(x - tw, top + th * 0.35, tw * 2, 2.2 * u);
      c.strokeStyle = '#c49a6c'; c.lineWidth = 1.2 * u;
      // fuse ends where update() draws its spark
      c.beginPath(); c.moveTo(x, top); c.lineTo(x + R * 0.6 + Math.cos(-0.9) * 14 * u * f, this.y - R * 1.6 + Math.sin(-0.9) * 14 * u * f); c.stroke();
      return;
    }
    const g = c.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
    if (p.colour === 'green') { g.addColorStop(0, '#5fd38a'); g.addColorStop(1, '#1d5a33'); } else { g.addColorStop(0, '#d9a066'); g.addColorStop(1, '#6e4520'); }
    shadow(c, x, this.y + 1 * u, R * 1.3, R * 0.4);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(x - R * 0.4, y - R * 0.45, R * 0.28, R * 0.16, -0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.colour === 'green' ? 'rgba(255,207,74,0.75)' : 'rgba(70,40,15,0.65)'; c.lineWidth = 0.9 * u;
    for (let i = -2; i <= 2; i++) {
      c.beginPath(); c.ellipse(x, y, R, R * Math.abs(i) * 0.3 + 0.5, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(x, y, R * Math.abs(i) * 0.3 + 0.5, R, 0, 0, Math.PI * 2); c.stroke();
    }
    c.strokeStyle = '#c49a6c'; c.lineWidth = 1.3 * u;
    const a = -0.9;
    c.beginPath(); c.moveTo(x + R * 0.6, y - R * 0.6); c.lineTo(x + R * 0.6 + Math.cos(a) * 14 * u * f, y - R * 0.6 + Math.sin(a) * 14 * u * f); c.stroke();
  }
  static torch(p) { return [{ t: p.bang, ms: p.big ? 420 : p.tube ? 150 : 260 }]; }
}

// ------------------------------------------------------------------ LADI
class Ladi extends Visual {
  fusePoint() { return { x: this.pts[0].x + 6 * this.u, y: this.pts[0].y - 2 * this.u }; }
  constructor(...a) {
    super(...a);
    const st = this.st, sc = st.scene, p = this.p, u = sc.u;
    this.pts = [];
    if (p.n <= 200) {
      const L = Math.min(sc.w * 0.72, 300 * u);
      this.x = Math.max(L / 2 + 10, Math.min(sc.w - L / 2 - 10, this.x));
      for (let i = 0; i < p.n; i++) { const q = i / (p.n - 1); this.pts.push({ x: this.x + L / 2 - L * q, y: this.y + Math.sin(q * Math.PI * 2.2) * 5 * u }); }
      this.tube = 5.5;
    } else {
      const rows = 5, per = Math.ceil(p.n / rows), L = Math.min(sc.w * 0.84, 360 * u), gap = Math.min(10 * u, (sc.placeBottom - sc.placeTop) / rows);
      const y0 = Math.max(sc.placeTop, Math.min(sc.placeBottom - gap * (rows - 1), this.y - gap * 2));
      const x0 = sc.w / 2 + L / 2;
      for (let i = 0; i < p.n; i++) {
        const r = Math.floor(i / per), q = (i % per) / (per - 1), dir = r % 2 ? -1 : 1;
        this.pts.push({ x: dir > 0 ? x0 - L * q : x0 - L + L * q, y: y0 + r * gap + Math.sin(q * Math.PI * 4) * 2 * u });
      }
      this.tube = 2.6;
    }
    this.gone = new Uint8Array(p.n); this.next = 0; this.lastFlash = 0; this.fusePt = this.pts[0];
  }
  update(dt) {
    const t = this.t, p = this.p, st = this.st, u = this.u, big = p.n > 200;
    if (t < p.fuse) { this.fuseSpark(this.pts[0].x + 6 * u, this.pts[0].y - 2 * u, dt); return; }
    while (this.next < p.pops.length && t >= p.pops[this.next].t) {
      const q = p.pops[this.next++];
      this.fusePt = this.pts[q.i];
      if (q.dud) continue;
      this.gone[q.i] = 1;
      const { x, y } = this.pts[q.i];
      for (let i = 0; i < (big ? 4 : 8); i++) {
        const a = rnd(-Math.PI, 0), s = rnd(80, 240) * u * q.g;
        st.sparks.add({ x, y: y - 2 * u, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.05, 0.15), colour: Math.random() < 0.5 ? '#ffffff' : '#ffb347', size: 1.6 * u, drag: 3, grav: 300 * u });
      }
      st.sparks.add({ x, y: y - 2 * u, life: 0.06, colour: '#fff6dd', size: 5 * u * q.g, drag: 0, grav: 0, dot: true });
      st.scene.paper(x, y - 2 * u, big ? (Math.random() < 0.5 ? 1 : 0) : 2);
      if (q.i % (big ? 12 : 5) === 0) st.scene.puff(x, y - 4 * u, 1, 0.6);
      const now = performance.now();
      if (now - this.lastFlash > 75) { this.lastFlash = now; st.flash(x, y, 0.1 + 0.12 * q.g, 110, '#ffe2b0'); }
      st.scene.lights.push({ x, y, r: 70 * u, colour: 'rgba(255,200,130,1)', a: 0.5 * q.g });
    }
    if (this.next < p.pops.length) this.fuseSpark(this.fusePt.x, this.fusePt.y - 2 * u, dt * 0.5);
    if (t > p.end + 2) this.done = true;
  }
  draw(c) {
    const u = this.u, p = this.p, pts = this.pts, tl = this.tube * u;
    c.save(); c.globalAlpha = Math.min(1, (p.end + 2 - this.t) / 1);
    c.strokeStyle = '#8a6a48'; c.lineWidth = 0.9 * u; c.beginPath();
    let started = false;
    for (let i = 0; i < pts.length; i++) {
      if (this.gone[i] && i < this.next) { started = false; continue; }
      if (!started) { c.moveTo(pts[i].x, pts[i].y); started = true; } else c.lineTo(pts[i].x, pts[i].y);
    }
    c.stroke();
    c.lineWidth = (p.n > 200 ? 1.6 : 2.4) * u; c.lineCap = 'round';
    for (let i = 0; i < pts.length; i++) {
      if (this.gone[i]) continue;
      const a = i % 2 ? 0.6 : -0.6, { x, y } = pts[i];
      c.strokeStyle = i % 7 === 3 ? '#2f8f4e' : '#d9303a';
      c.beginPath(); c.moveTo(x - Math.sin(a) * tl * 0.5, y - Math.cos(a) * tl * 0.5); c.lineTo(x + Math.sin(a) * tl * 0.5, y + Math.cos(a) * tl * 0.5); c.stroke();
      if (p.n <= 200) { c.strokeStyle = '#ffd34d'; c.beginPath(); c.moveTo(x - Math.sin(a) * tl * 0.08, y - Math.cos(a) * tl * 0.08); c.lineTo(x + Math.sin(a) * tl * 0.08, y + Math.cos(a) * tl * 0.08); c.stroke(); }
    }
    c.restore();
  }
  static torch(p) {
    const out = [];
    let last = -1;
    for (const q of p.pops) if (!q.dud && q.t - last > 0.18) { out.push({ t: q.t, ms: 45 }); last = q.t; }
    return out;
  }
}

// ------------------------------------------------------------------ PHULJHADI (sparkler)
class Phuljhadi extends Visual {
  constructor(...a) {
    super(...a);
    this.hx = this.x; this.hy = this.y; this.vx = 0; this.trail = []; this.lean = 0;
    this.held = false;
  }
  moveTo(x, y, dt) {
    if (dt > 0) this.vx = this.vx * 0.7 + ((x - this.hx) / dt) * 0.3;
    this.hx = x; this.hy = y;
  }
  tip() {
    const u = this.u, p = this.p, f = Math.max(0, Math.min(1, (this.t - p.fuse) / p.burn)), L = 70 * u;
    const a = -Math.PI / 2 + 0.42 + this.lean;
    return { x: this.hx + Math.cos(a) * L * (1 - 0.72 * f), y: this.hy + Math.sin(a) * L * (1 - 0.72 * f), a, L, f };
  }
  update(dt) {
    const t = this.t, p = this.p, u = this.u, st = this.st;
    this.lean += (Math.max(-0.6, Math.min(0.6, -this.vx * 0.0007)) - this.lean) * Math.min(1, dt * 8);
    if (!this.held) this.vx *= Math.exp(-dt * 6);
    const tp = this.tip(), now = performance.now();
    const k = t < p.fuse ? 0.25 : sample(p.curve, p.burn, t - p.fuse);
    if (t < p.end && k > 0.01) {
      this.trail.push({ x: tp.x, y: tp.y, t: now });
      if (p.pencil) { // a colour pencil: a big coloured flame with only a few sparks
        st.scene.lights.push({ x: tp.x, y: tp.y, r: 150 * u, colour: p.colour, a: 0.5 * k });
        st.sparks.add({ x: tp.x + rnd(-2, 2) * u, y: tp.y, vx: rnd(-20, 20) * u, vy: rnd(-90, -30) * u, life: rnd(0.15, 0.35), colour: p.colour, size: 5 * u, drag: 2, grav: -40 * u, dot: true, alpha: 0.6 });
      }
      for (let i = this.count((p.pencil ? 40 : 260) * k, dt); i > 0; i--) {
        const a = Math.random() * Math.PI * 2, s = rnd(70, 270) * u;
        st.sparks.add({ x: tp.x, y: tp.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.08, 0.32), colour: Math.random() < 0.6 ? '#fff6e0' : '#ffd27a',
          size: 1.1 * u, drag: 2.2, grav: 140 * u, split: Math.random() < 0.3 ? 3 : 0, flicker: Math.random() < 0.2 });
      }
      st.scene.lights.push({ x: tp.x, y: tp.y, r: 90 * u, colour: 'rgba(255,225,170,1)', a: 0.45 * k });
    }
    while (this.trail.length && now - this.trail[0].t > 2600) this.trail.shift();
    if (t > p.end + 2.8) this.done = true;
  }
  draw(c) {
    const u = this.u, p = this.p, tp = this.tip(), now = performance.now(), t = this.t;
    c.save();
    // light painting
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    // one path per age band, so joints don't double up into beads
    for (let pass = 0; pass < 2; pass++) {
      c.lineWidth = (pass ? 1.4 : 4.5) * u; c.strokeStyle = pass ? '#fff8ea' : p.colour || '#ffb347';
      let i = 1;
      while (i < this.trail.length) {
        const band = Math.floor(((now - this.trail[i].t) / 2600) * 12);
        const age = (band + 0.5) / 12;
        c.globalAlpha = (pass ? 0.9 : 0.35) * Math.max(0, 1 - age) ** 2;
        c.beginPath(); c.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
        while (i < this.trail.length && Math.floor(((now - this.trail[i].t) / 2600) * 12) === band) { c.lineTo(this.trail[i].x, this.trail[i].y); i++; }
        c.stroke();
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = Math.min(1, (p.end + 2.8 - t) / 1);
    // wire handle → ash → unburnt coating
    const ca = Math.cos(tp.a), sa = Math.sin(tp.a), hx = this.hx, hy = this.hy, L = tp.L;
    c.lineCap = 'round';
    c.strokeStyle = '#7d828c'; c.lineWidth = 1.3 * u; c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + ca * L, hy + sa * L); c.stroke();
    c.strokeStyle = '#4b4741'; c.lineWidth = 2.8 * u; c.beginPath(); c.moveTo(hx + ca * L * 0.28, hy + sa * L * 0.28); c.lineTo(tp.x, tp.y); c.stroke();
    if (t < p.end) {
      c.globalCompositeOperation = 'lighter'; c.fillStyle = '#fffaf0';
      if (p.pencil) { c.globalAlpha = 0.7; c.fillStyle = p.colour; c.beginPath(); c.arc(tp.x, tp.y, 7 * u, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; c.fillStyle = '#fffaf0'; }
      c.beginPath(); c.arc(tp.x, tp.y, 2.6 * u, 0, Math.PI * 2); c.fill();
    } else if (t < p.end + 1) {
      c.fillStyle = `rgba(255,90,40,${1 - (t - p.end)})`; c.beginPath(); c.arc(tp.x, tp.y, 1.8 * u, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}

// ------------------------------------------------------------------ SKY SHOT
class SkyShot extends Visual {
  fusePoint() { return { x: this.x + 15 * this.u, y: this.y - 8 * this.u }; }
  constructor(...a) {
    super(...a);
    const sc = this.st.scene;
    this.shots = this.p.shots.map((s) => ({ ...s, ax: this.x + s.drift * sc.w * 0.45, ay: Math.max(sc.h * 0.07, sc.horizon - s.height * (sc.horizon - sc.h * 0.07)), state: 0 }));
  }
  update(dt) {
    const t = this.t, p = this.p, u = this.u, st = this.st, top = this.y - 20 * u;
    if (t < p.fuse) { this.fuseSpark(this.x + 15 * u, this.y - 8 * u, dt); return; }
    for (const s of this.shots) {
      if (s.state === 0 && t >= s.launch) {
        s.state = 1;
        st.flash(this.x, top, 0.16, 140, '#ffe2b0');
        st.scene.puff(this.x, top, 2, 0.7);
        for (let i = 0; i < 14; i++) st.sparks.add({ x: this.x + rnd(-6, 6) * u, y: top, vx: rnd(-60, 60) * u, vy: rnd(-200, -60) * u, life: rnd(0.1, 0.3), colour: '#ffd27a', size: 1.6 * u, drag: 2, grav: 300 * u });
      }
      if (s.state === 1) {
        const q = Math.min(1, (t - s.launch) / (s.burst - s.launch)), e = 1 - Math.pow(1 - q, 2);
        const x = this.x + (s.ax - this.x) * e, y = top + (s.ay - top) * e;
        st.sparks.add({ x, y, vx: rnd(-15, 15) * u, vy: rnd(20, 80) * u, life: rnd(0.2, 0.45), colour: '#ffc76b', size: 1.8 * u, drag: 1.5, grav: 120 * u });
        st.sparks.add({ x, y, life: 0.05, colour: '#fff4dd', size: 2.6 * u, drag: 0, grav: 0, dot: true });
        if (t >= s.burst) { s.state = 2; burst(st, s.ax, s.ay, s); }
      }
    }
    if (t > p.end + 0.5) this.done = true;
  }
  draw(c) {
    const u = this.u, x = this.x, y = this.y, t = this.t;
    c.save(); c.globalAlpha = Math.min(1, (this.p.end + 0.5 - t) / 0.8);
    shadow(c, x, y + 1.5 * u, 22 * u, 5 * u);
    // printed box: front, top, side
    const fr = c.createLinearGradient(0, y - 18 * u, 0, y); fr.addColorStop(0, '#7b3fd0'); fr.addColorStop(1, '#3a1470');
    c.fillStyle = fr; c.fillRect(x - 15 * u, y - 18 * u, 30 * u, 18 * u);
    c.fillStyle = '#2a0f55'; c.beginPath(); c.moveTo(x + 15 * u, y - 18 * u); c.lineTo(x + 19 * u, y - 22 * u); c.lineTo(x + 19 * u, y - 4 * u); c.lineTo(x + 15 * u, y); c.fill();
    c.fillStyle = '#9a62e8'; c.beginPath(); c.moveTo(x - 15 * u, y - 18 * u); c.lineTo(x - 11 * u, y - 22 * u); c.lineTo(x + 19 * u, y - 22 * u); c.lineTo(x + 15 * u, y - 18 * u); c.fill();
    c.fillStyle = '#ffcf4a'; c.fillRect(x - 15 * u, y - 11 * u, 30 * u, 2.2 * u); c.fillRect(x - 15 * u, y - 2.2 * u, 30 * u, 1.2 * u);
    // printed stars
    c.fillStyle = '#fff3c4';
    for (const [sx, sy, r] of [[-9, -14.5, 1.6], [0, -15, 1.2], [8, -14.2, 1.5], [-4, -5.5, 1.1], [6, -5.8, 1.2]]) {
      c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = (i % 2 ? 0.45 : 1) * r * u; c.lineTo(x + sx * u + Math.cos(a) * rr, y + sy * u + Math.sin(a) * rr); } c.fill();
    }
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
      const done = this.shots[r * 6 + i]?.state > 0, cx = x - 11 * u + i * 5 * u + r * 2 * u, cy = y - 19.2 * u - r * 1.6 * u;
      c.fillStyle = '#e8d9b8'; c.beginPath(); c.ellipse(cx, cy, 2.1 * u, 0.95 * u, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = done ? '#2a1a12' : '#160b24'; c.beginPath(); c.ellipse(cx, cy, 1.5 * u, 0.62 * u, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  static torch(p) { return p.shots.map((s) => ({ t: s.burst, ms: 120 })); }
}

// ------------------------------------------------------------------ SAANP GOLI (snake tablet)
class Snake extends Visual {
  fusePoint() { return { x: this.x, y: this.y - 2 * this.u }; }
  constructor(...a) {
    super(...a);
    const r = rng(this.p.seed), u = this.u, n = 70;
    let x = this.x, y = this.y - 2 * u, ang = -Math.PI / 2 + (r() - 0.5) * 0.9;
    this.pts = [{ x, y }];
    for (let i = 0; i < n; i++) {
      ang += (r() - 0.5) * 0.7 + Math.sin(i / 7) * 0.18;
      ang = Math.max(-Math.PI + 0.35, Math.min(-0.35, ang));
      x += Math.cos(ang) * 2.2 * u; y += Math.sin(ang) * 1.6 * u;
      this.pts.push({ x, y });
    }
    this.n = 1;
  }
  update(dt) {
    const t = this.t, p = this.p, u = this.u, st = this.st;
    if (t < p.fuse) { this.fuseSpark(this.x, this.y - 2 * u, dt); return; }
    const f = Math.min(1, (t - p.fuse) / p.burn);
    this.n = Math.max(1, Math.floor(Math.pow(f, 0.8) * (this.pts.length - 1)));
    const head = this.pts[this.n];
    if (t < p.end) {
      if (Math.random() < dt * 3) st.scene.puff(head.x, head.y, 1, 0.45);
      st.scene.lights.push({ x: head.x, y: head.y, r: 26 * u, colour: 'rgba(190,255,120,1)', a: 0.3 });
    }
    if (t > p.end + 3) this.done = true;
  }
  draw(c) {
    const u = this.u, t = this.t, p = this.p;
    c.save(); c.globalAlpha = Math.min(1, (p.end + 3 - t) / 1);
    c.fillStyle = '#0d0c0b'; c.beginPath(); c.ellipse(this.x, this.y, 6 * u, 2.2 * u, 0, 0, Math.PI * 2); c.fill();
    c.lineCap = 'round'; c.lineJoin = 'round';
    const pts = this.pts, n = this.n;
    for (let i = 1; i <= n; i++) { // thick at the base, thinner towards the head
      const k = i / Math.max(1, n);
      c.strokeStyle = '#2f2924'; c.lineWidth = (7 - 3.5 * k) * u;
      c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke();
    }
    c.strokeStyle = 'rgba(150,135,120,0.55)'; c.lineWidth = 1.1 * u; c.setLineDash([2 * u, 3 * u]);
    c.beginPath(); c.moveTo(pts[0].x - u, pts[0].y); for (let i = 1; i <= n; i++) c.lineTo(pts[i].x - u, pts[i].y); c.stroke();
    c.setLineDash([]);
    if (t > p.fuse && t < p.end) {
      const h = pts[n]; c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(200,255,130,0.8)'; c.beginPath(); c.arc(h.x, h.y, 2.4 * u, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}

export const VISUALS = { anar: Anar, chakri: Chakri, rocket: Rocket, bomb: Bomb, ladi: Ladi, phuljhadi: Phuljhadi, skyshot: SkyShot, snake: Snake };
