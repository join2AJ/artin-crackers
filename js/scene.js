// The stage: an Amavasya (moonless) Diwali night over Indian rooftops.
// Static art (sky, skyline, terrace, rangoli) is painted once per resize on
// the sky canvas; living things (diya flames, toran lights, crackers, debris)
// are painted every frame on the props canvas.

import { rng } from './synth.js';

const TORAN = ['#ff4b4b', '#ffd23f', '#53ff8f', '#5aa9ff', '#ff5ec4', '#ffffff'];

export class Scene {
  constructor(sky, props) {
    this.sky = sky; this.sc = sky.getContext('2d');
    this.props = props; this.pc = props.getContext('2d');
    this.diyas = []; this.bulbs = []; this.debris = []; this.smoke = []; this.rings = []; this.scorch = []; this.lights = [];
    this.wind = 0;
  }

  resize(w, h, dpr, trayH) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.u = Math.min(1.9, Math.min(w, h) / 360);
    const land = w > h;
    this.horizon = Math.round(h * (land ? 0.52 : 0.58));
    this.wallH = Math.round(15 * this.u);
    this.floorTop = this.horizon + this.wallH;
    this.trayH = trayH;
    // where crackers can stand: on the terrace, above the tray
    this.placeTop = this.floorTop + 12 * this.u;
    this.placeBottom = Math.max(this.placeTop + 8, h - trayH - 14 * this.u);
    for (const c of [this.sky, this.props]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.sc.setTransform(dpr, 0, 0, dpr, 0, 0); this.pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lit = this.diyas.map((d) => d.lit);
    this.paintSky();
    this.diyas.forEach((d, i) => { if (i < lit.length) d.lit = lit[i]; });
  }

  /** Clamp a tap to a standing spot on the terrace. */
  ground(x, y) {
    const m = 24 * this.u;
    return { x: Math.max(m, Math.min(this.w - m, x)), y: Math.max(this.placeTop, Math.min(this.placeBottom, y < this.placeTop ? (this.placeTop + this.placeBottom) / 2 : y)) };
  }
  /** Depth scale: things nearer the viewer are drawn a little bigger. */
  depth(y) { return 0.85 + 0.3 * Math.max(0, Math.min(1, (y - this.floorTop) / Math.max(1, this.h - this.floorTop))); }

  paintSky() {
    const c = this.sc, w = this.w, h = this.h, u = this.u, H = this.horizon, r = rng(20261108);
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#04020b'); g.addColorStop(0.55, '#0d0722'); g.addColorStop(0.86, '#24103a'); g.addColorStop(1, '#4a1d3c');
    c.fillStyle = g; c.fillRect(0, 0, w, H + 2);
    // stars (no moon: Diwali falls on the new-moon night)
    for (let i = 0, n = Math.round((w * H) / 2600); i < n; i++) {
      const x = r() * w, y = r() * H * 0.85, b = r();
      c.globalAlpha = 0.25 + b * 0.6; c.fillStyle = b > 0.93 ? '#ffe9c8' : '#dfe6ff';
      c.fillRect(x, y, b > 0.85 ? 1.6 : 1, b > 0.85 ? 1.6 : 1);
    }
    c.globalAlpha = 1;
    // warm haze of city lights on the horizon
    const hz = c.createLinearGradient(0, H - 90 * u, 0, H);
    hz.addColorStop(0, 'rgba(255,140,60,0)'); hz.addColorStop(1, 'rgba(255,140,60,0.22)');
    c.fillStyle = hz; c.fillRect(0, H - 90 * u, w, 90 * u);

    // far skyline
    this.skyline(c, r, H, 0.55, '#1a0f2c', 0.18);
    // near skyline with lit windows, water tanks and a temple
    this.bulbs = [];
    const tops = this.skyline(c, r, H, 1, '#0d0718', 0.65, true);
    // toran strings between rooftops
    for (let i = 0; i < tops.length - 1; i++) {
      if (r() < 0.35) continue;
      const a = tops[i], b = tops[i + 1];
      const sag = 10 * u + r() * 14 * u, n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (7 * u)));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        this.bulbs.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag, c: k % TORAN.length, ph: i });
      }
    }

    // parapet wall
    const wall = c.createLinearGradient(0, H, 0, H + this.wallH);
    wall.addColorStop(0, '#3b2a4a'); wall.addColorStop(0.12, '#2a1d37'); wall.addColorStop(1, '#1a1124');
    c.fillStyle = wall; c.fillRect(0, H, w, this.wallH);
    c.fillStyle = 'rgba(255,190,120,0.18)'; c.fillRect(0, H, w, 1.5);
    // terrace floor with faint tiles in perspective
    const fl = c.createLinearGradient(0, this.floorTop, 0, h);
    fl.addColorStop(0, '#120b1a'); fl.addColorStop(1, '#1c1226');
    c.fillStyle = fl; c.fillRect(0, this.floorTop, w, h - this.floorTop);
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1;
    const vx = w / 2, vy = this.floorTop - 260 * u;
    for (let i = -14; i <= 14; i++) { const bx = w / 2 + i * 70 * u; c.beginPath(); c.moveTo(vx + (bx - vx) * ((this.floorTop - vy) / (h - vy)), this.floorTop); c.lineTo(bx, h); c.stroke(); }
    for (let k = 1; k < 9; k++) { const y = this.floorTop + (h - this.floorTop) * Math.pow(k / 9, 1.6); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    this.rangoli(c, w / 2, (this.placeTop + this.placeBottom) / 2, Math.min(w * 0.22, 95 * u));

    // diyas along the parapet
    const prev = this.diyas;
    const n = Math.max(5, Math.floor(w / (48 * u)));
    this.diyas = Array.from({ length: n }, (_, i) => ({ x: (w / n) * (i + 0.5), y: H, lit: prev[i] ? prev[i].lit : true, ph: r() * 6, out: 0 }));
  }

  skyline(c, r, H, scale, fill, windows, near = false) {
    const u = this.u, tops = [];
    let x = -10 * u;
    const temple = near ? this.w * (0.62 + r() * 0.2) : -1;
    c.fillStyle = fill;
    while (x < this.w + 10) {
      const bw = (26 + r() * 46) * u * (near ? 1 : 0.8);
      let bh = (near ? 20 + r() * 70 : 40 + r() * 90) * u * scale;
      if (near && temple > x && temple < x + bw) {
        // temple shikhara with a flag
        const cx = x + bw / 2, th = 88 * u;
        c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - 26 * u); c.lineTo(cx - 14 * u, H - 30 * u);
        c.quadraticCurveTo(cx - 10 * u, H - th * 0.8, cx, H - th); c.quadraticCurveTo(cx + 10 * u, H - th * 0.8, cx + 14 * u, H - 30 * u);
        c.lineTo(x + bw, H - 26 * u); c.lineTo(x + bw, H); c.fill();
        c.fillRect(cx - 0.8 * u, H - th - 14 * u, 1.6 * u, 14 * u);
        c.save(); c.fillStyle = '#ff9933'; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(cx + 0.8 * u, H - th - 14 * u); c.lineTo(cx + 11 * u, H - th - 10 * u); c.lineTo(cx + 0.8 * u, H - th - 7 * u); c.fill(); c.restore();
        this.templeTop = { x: cx, y: H - th };
        tops.push({ x: cx, y: H - th + 30 * u });
        x += bw; continue;
      }
      c.fillRect(x, H - bh, bw, bh + 1);
      if (near && r() < 0.5) { // rooftop water tank
        const tw = 12 * u, tx = x + r() * (bw - tw);
        c.fillRect(tx, H - bh - 10 * u, tw, 10 * u); c.fillRect(tx - 1.5 * u, H - bh - 10.8 * u, tw + 3 * u, 1.6 * u);
      }
      if (windows) {
        c.save();
        for (let wy = H - bh + 6 * u; wy < H - 6 * u; wy += 11 * u) {
          for (let wx = x + 4 * u; wx < x + bw - 8 * u; wx += 9 * u) {
            if (r() > windows * 0.55) continue;
            c.fillStyle = r() < 0.75 ? '#ffc56b' : '#ffe2a8'; c.globalAlpha = (near ? 0.55 : 0.22) + r() * 0.35;
            c.fillRect(wx, wy, 4 * u * (near ? 1 : 0.7), 5 * u * (near ? 1 : 0.7));
          }
        }
        c.restore(); c.fillStyle = fill;
      }
      tops.push({ x: x + bw * (0.2 + r() * 0.6), y: H - bh });
      x += bw + (near ? 0 : r() * 6 * u);
    }
    return tops;
  }

  rangoli(c, cx, cy, R) {
    c.save(); c.translate(cx, cy); c.scale(1, 0.36); c.globalAlpha = 0.5;
    const ring = (n, r1, r2, col, wide) => {
      c.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        c.save(); c.rotate(a); c.beginPath(); c.moveTo(r1, 0);
        c.quadraticCurveTo((r1 + r2) / 2, -wide, r2, 0); c.quadraticCurveTo((r1 + r2) / 2, wide, r1, 0); c.fill(); c.restore();
      }
    };
    c.fillStyle = '#2a1238'; c.beginPath(); c.arc(0, 0, R * 1.04, 0, Math.PI * 2); c.fill();
    ring(16, R * 0.62, R, '#ff4f8b', R * 0.12);
    ring(16, R * 0.62, R * 0.9, '#ffcc33', R * 0.05);
    ring(10, R * 0.3, R * 0.64, '#2ecc71', R * 0.13);
    ring(10, R * 0.32, R * 0.56, '#3fa9f5', R * 0.05);
    c.fillStyle = '#ff9933'; c.beginPath(); c.arc(0, 0, R * 0.26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff3d6';
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.beginPath(); c.arc(Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1, R * 0.025, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.arc(0, 0, R * 0.09, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /** Index of the diya nearest to a tap on the parapet, or -1. */
  diyaAt(x, y) {
    const dy = y - this.horizon;
    if (dy < -24 * this.u || dy > 8 * this.u) return -1;
    let best = -1, bd = 16 * this.u;
    this.diyas.forEach((d, i) => { const dd = Math.abs(d.x - x); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }
  get litCount() { return this.diyas.filter((d) => d.lit).length; }
  /** Blow out the lit diya nearest the middle (blowing works from the centre outwards). */
  blowOne() {
    const mid = this.w / 2;
    let best = null;
    for (const d of this.diyas) if (d.lit && (!best || Math.abs(d.x - mid) < Math.abs(best.x - mid))) best = d;
    if (best) { best.lit = false; best.out = performance.now(); }
    return !!best;
  }

  /** Per-frame: clears props and paints lights, diyas and toran. Visuals draw on top. */
  beginFrame(now) {
    const c = this.pc, u = this.u;
    c.clearRect(0, 0, this.w, this.h);
    // light thrown by crackers on the floor and wall
    c.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      const g = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, l.colour); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = Math.min(1, l.a); c.fillStyle = g; c.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    this.lights.length = 0;
    // toran: a slow chase
    const step = Math.floor(now / 380);
    for (const b of this.bulbs) {
      const on = (b.c + step + b.ph) % 3 !== 0;
      c.globalAlpha = on ? 0.95 : 0.25; c.fillStyle = TORAN[b.c];
      c.beginPath(); c.arc(b.x, b.y, 1.5 * u, 0, Math.PI * 2); c.fill();
      if (on) { c.globalAlpha = 0.18; c.beginPath(); c.arc(b.x, b.y, 4.5 * u, 0, Math.PI * 2); c.fill(); }
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    // diyas
    for (const d of this.diyas) this.drawDiya(c, d, now);
  }

  drawDiya(c, d, now) {
    const u = this.u, x = d.x, y = d.y;
    if (d.lit) {
      const g = c.createRadialGradient(x, y - 4 * u, 0, x, y - 4 * u, 34 * u);
      g.addColorStop(0, 'rgba(255,170,70,0.38)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.fillRect(x - 34 * u, y - 38 * u, 68 * u, 68 * u);
    }
    // clay lamp
    c.fillStyle = '#9c4422';
    c.beginPath(); c.moveTo(x - 9 * u, y - 3 * u); c.quadraticCurveTo(x, y + 6 * u, x + 9 * u, y - 3 * u); c.lineTo(x + 12 * u, y - 5 * u); c.quadraticCurveTo(x + 8 * u, y - 1.5 * u, x + 5 * u, y - 3 * u); c.closePath(); c.fill();
    c.fillStyle = '#c96a3a'; c.beginPath(); c.ellipse(x, y - 3 * u, 9 * u, 2.2 * u, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a1608'; c.beginPath(); c.ellipse(x, y - 3 * u, 6.5 * u, 1.3 * u, 0, 0, Math.PI * 2); c.fill();
    const fx = x + 9.5 * u, fy = y - 5.5 * u;
    if (d.lit) {
      const t = now / 1000, fl = Math.sin(t * 13 + d.ph) * 0.08 + Math.sin(t * 29 + d.ph * 2) * 0.05;
      const lean = this.wind * (0.6 + 0.4 * Math.sin(t * 40 + d.ph)) * 5 * u;
      const fh = 9 * u * (1 + fl - this.wind * 0.35);
      const g = c.createRadialGradient(fx, fy - fh * 0.35, 0, fx, fy - fh * 0.35, fh * 0.75);
      g.addColorStop(0, '#fffbe6'); g.addColorStop(0.35, '#ffd36b'); g.addColorStop(1, 'rgba(255,110,30,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(fx - 2.6 * u, fy);
      c.quadraticCurveTo(fx - 3 * u, fy - fh * 0.5, fx + lean, fy - fh);
      c.quadraticCurveTo(fx + 3 * u, fy - fh * 0.5, fx + 2.6 * u, fy); c.closePath(); c.fill();
    } else if (d.out && now - d.out < 2200) {
      // smoke wisp after blowing out
      const k = (now - d.out) / 2200;
      c.strokeStyle = `rgba(200,200,215,${0.45 * (1 - k)})`; c.lineWidth = 1.2 * u;
      c.beginPath(); c.moveTo(fx, fy);
      for (let i = 1; i <= 8; i++) c.lineTo(fx + Math.sin(i * 0.9 + now / 300) * 3 * u * (i / 8), fy - i * 4 * u * (0.4 + k));
      c.stroke();
    }
  }

  // ------------------------------------------------------------ debris & smoke (props layer)
  paper(x, y, n, colours = ['#d9303a', '#b8242c', '#e0b06a']) {
    const u = this.u;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = (60 + Math.random() * 220) * u;
      this.debris.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20, s: (2 + Math.random() * 3) * u, c: colours[i % colours.length], floor: y + (Math.random() - 0.3) * 30 * u, age: 0, life: 4 + Math.random() * 3 });
    }
    if (this.debris.length > 500) this.debris.splice(0, this.debris.length - 500);
  }
  puff(x, y, n, size = 1) {
    const u = this.u;
    for (let i = 0; i < n; i++) this.smoke.push({ x: x + (Math.random() - 0.5) * 14 * u * size, y: y - Math.random() * 10 * u, vx: (Math.random() - 0.5) * 30 * u, vy: -(10 + Math.random() * 30) * u * size, r: (8 + Math.random() * 10) * u * size, age: 0, life: 1.6 + Math.random() * 1.6 * size });
    if (this.smoke.length > 120) this.smoke.splice(0, this.smoke.length - 120);
  }
  ring(x, y, R, life = 0.45) { this.rings.push({ x, y, R, age: 0, life }); }
  burn(x, y, r) { this.scorch.push({ x, y, r, age: 0, life: 9 }); if (this.scorch.length > 20) this.scorch.shift(); }

  drawFloorMarks(dt) {
    const c = this.pc;
    for (const s of this.scorch) {
      s.age += dt;
      c.globalAlpha = 0.55 * Math.min(1, (s.life - s.age) / 3);
      const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(s.x, s.y, s.r, s.r * 0.38, 0, 0, Math.PI * 2); c.fill();
    }
    this.scorch = this.scorch.filter((s) => s.age < s.life);
    c.globalAlpha = 1;
  }
  drawDebris(dt) {
    const c = this.pc, u = this.u;
    for (const p of this.debris) {
      p.age += dt;
      if (p.y < p.floor) { p.vy += 380 * u * dt; p.vx *= Math.exp(-1.6 * dt); p.vy = Math.min(p.vy, 70 * u); p.x += p.vx * dt + Math.sin(p.age * 5 + p.rot) * 12 * u * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      c.globalAlpha = Math.min(1, (p.life - p.age) / 1.2);
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.age * 7 + p.rot));
      c.fillStyle = p.c; c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7); c.restore();
    }
    this.debris = this.debris.filter((p) => p.age < p.life);
    for (const s of this.smoke) {
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= Math.exp(-0.6 * dt); s.r += 14 * u * dt;
      c.globalAlpha = 0.2 * Math.sin(Math.PI * Math.min(1, s.age / s.life));
      const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, 'rgba(160,155,175,0.9)'); g.addColorStop(0.6, 'rgba(140,135,160,0.45)'); g.addColorStop(1, 'rgba(120,115,140,0)');
      c.fillStyle = g; c.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    this.smoke = this.smoke.filter((s) => s.age < s.life);
    c.lineWidth = 2.5 * u;
    for (const r of this.rings) {
      r.age += dt; const k = r.age / r.life;
      c.globalAlpha = 0.5 * (1 - k); c.strokeStyle = '#ffe7c2';
      c.beginPath(); c.ellipse(r.x, r.y, r.R * k, r.R * k * 0.45, 0, 0, Math.PI * 2); c.stroke();
    }
    this.rings = this.rings.filter((r) => r.age < r.life);
    c.globalAlpha = 1;
  }
}
