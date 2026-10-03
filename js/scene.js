// The stage: an Amavasya (moonless) Diwali night in one of many places (see THEMES).
// Static art (sky, skyline, terrace, rangoli) is painted once per resize on
// the sky canvas; living things (diya flames, toran lights, crackers, debris)
// are painted every frame on the props canvas.

import { rng } from './synth.js';

const TORAN = ['#ff4b4b', '#ffd23f', '#53ff8f', '#5aa9ff', '#ff5ec4', '#ffffff'];

// Background themes. sky = 4 gradient stops top→horizon; wall = where the diyas stand.
export const THEMES = {
  city: { name: 'Rooftop', hi: 'छत', sky: ['#04020b', '#0d0722', '#24103a', '#4a1d3c'], haze: 'rgba(255,140,60,0.22)', stars: 1,
    wall: ['#3b2a4a', '#2a1d37', '#1a1124'], floor: ['#120b1a', '#1c1226'], ground: 'tiles', rangoli: true },
  home: { name: 'Home', hi: 'घर-आँगन', sky: ['#04020b', '#0f0824', '#271238', '#4b2140'], haze: 'rgba(255,150,80,0.18)', stars: 1,
    wall: ['#6a3b35', '#4d2a27', '#321b1a'], floor: ['#1a1014', '#271820'], ground: 'tiles', rangoli: true },
  village: { name: 'Village', hi: 'गाँव', sky: ['#02040d', '#06102a', '#122045', '#2d2a4c'], haze: 'rgba(255,170,90,0.12)', stars: 1.7,
    wall: ['#6b4a30', '#4f3522', '#33231a'], floor: ['#1f150d', '#2c1e13'], ground: 'earth', wallStyle: 'mud', rangoli: true },
  ghat: { name: 'River Ghat', hi: 'घाट', sky: ['#030312', '#0b0b2c', '#1f1640', '#53284a'], haze: 'rgba(255,150,70,0.2)', stars: 1.2,
    wall: ['#4a4552', '#35313d', '#24212b'], floor: ['#16141c', '#211e28'], ground: 'tiles', rangoli: true },
  palace: { name: 'Palace', hi: 'महल', sky: ['#03020c', '#0c0826', '#25143c', '#5a2a3c'], haze: 'rgba(255,170,90,0.22)', stars: 1.1,
    wall: ['#e8d8c0', '#bfae96', '#8a7c6a'], floor: ['#1e1b24', '#2c2834'], ground: 'tiles', wallStyle: 'balustrade', rangoli: true },
  snow: { name: 'Himalaya', hi: 'बर्फ़', sky: ['#01030b', '#06112a', '#14284a', '#2e4466'], haze: 'rgba(170,200,255,0.12)', stars: 1.8,
    wall: ['#e9f0fa', '#b9c6da', '#7e8ca4'], floor: ['#2d3850', '#4a5876'], ground: 'snow', wallStyle: 'snow', weather: 'snow' },
  desert: { name: 'Desert', hi: 'रेगिस्तान', sky: ['#02020a', '#0a0a26', '#25183a', '#5c3036'], haze: 'rgba(255,160,90,0.16)', stars: 2,
    wall: ['#7a5638', '#5e4129', '#3f2b1b'], floor: ['#2a1d14', '#3d2b1d'], ground: 'sand', wallStyle: 'mud', weather: 'sand' },
  army: { name: 'Border Post', hi: 'सीमा चौकी', sky: ['#020309', '#071021', '#142236', '#2c3440'], haze: 'rgba(200,190,140,0.1)', stars: 1.9,
    wall: ['#6e6748', '#544e36', '#3a3524'], floor: ['#16150f', '#211f17'], ground: 'earth', wallStyle: 'sandbag' },
  camp: { name: 'Camp', hi: 'कैंप', sky: ['#01020a', '#051026', '#0f1f3a', '#1f2c40'], haze: 'rgba(255,150,70,0.1)', stars: 2.2, milky: true,
    wall: ['#5a3a22', '#432b19', '#2b1c10'], floor: ['#0b120b', '#121c11'], ground: 'grass', wallStyle: 'log' },
  open: { name: 'Open Sky', hi: 'खुला आसमान', sky: ['#000004', '#03051a', '#0b0f30', '#1d1c40'], haze: 'rgba(120,140,255,0.08)', stars: 2.4,
    wall: ['#16201a', '#101812', '#0b120d'], floor: ['#08100b', '#0e1a12'], ground: 'grass', milky: true },
};

export class Scene {
  constructor(sky, props) {
    this.sky = sky; this.sc = sky.getContext('2d');
    this.props = props; this.pc = props.getContext('2d');
    this.diyas = []; this.bulbs = []; this.debris = []; this.smoke = []; this.rings = []; this.scorch = []; this.lights = [];
    this.wind = 0; this.theme = 'city'; this.fires = []; this.kandils = []; this.flakes = []; this.beams = [];
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

  setTheme(id) { this.theme = THEMES[id] ? id : 'city'; if (this.w) this.paintSky(); }

  paintSky() {
    const c = this.sc, w = this.w, h = this.h, u = this.u, H = this.horizon, r = rng(20261108);
    const T = THEMES[this.theme] || THEMES.city;
    c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, H);
    T.sky.forEach((col, i) => g.addColorStop([0, 0.55, 0.86, 1][i], col));
    c.fillStyle = g; c.fillRect(0, 0, w, H + 2);
    if (T.milky) this.milkyWay(c, r);
    // stars (no moon: Diwali falls on the new-moon night)
    for (let i = 0, n = Math.round(((w * H) / 2600) * T.stars); i < n; i++) {
      const x = r() * w, y = r() * H * 0.88, b = r();
      c.globalAlpha = 0.25 + b * 0.6; c.fillStyle = b > 0.93 ? '#ffe9c8' : '#dfe6ff';
      c.fillRect(x, y, b > 0.85 ? 1.6 : 1, b > 0.85 ? 1.6 : 1);
    }
    c.globalAlpha = 1;
    const hz = c.createLinearGradient(0, H - 90 * u, 0, H);
    hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, T.haze);
    c.fillStyle = hz; c.fillRect(0, H - 90 * u, w, 90 * u);

    this.bulbs = []; this.fires = []; this.kandils = []; this.beams = [];
    this.flakes = T.weather ? Array.from({ length: T.weather === 'snow' ? 140 : 50 }, () => ({ x: r() * w, y: T.weather === 'snow' ? r() * h : H + r() * (h - H), s: 0.6 + r() * 1.6, ph: r() * 6 })) : [];
    if (this.theme === 'village') this.torans(r, this.village(c, r, H), 0.45);
    else if (this.theme === 'ghat') this.ghat(c, r, H);
    else if (this.theme === 'open') this.hills(c, r, H);
    else if (this.theme === 'snow') this.himalaya(c, r, H);
    else if (this.theme === 'desert') this.desert(c, r, H);
    else if (this.theme === 'army') this.army(c, r, H);
    else if (this.theme === 'palace') this.palace(c, r, H);
    else if (this.theme === 'camp') this.camp(c, r, H);
    else if (this.theme === 'home') this.home(c, r, H);
    else {
      this.skyline(c, r, H, 0.55, '#1a0f2c', 0.18);
      this.torans(r, this.skyline(c, r, H, 1, '#0d0718', 0.65, true), 0.65);
    }

    // the wall the diyas stand on: parapet, mud wall, ghat step or a low earth bund
    const wall = c.createLinearGradient(0, H, 0, H + this.wallH);
    wall.addColorStop(0, T.wall[0]); wall.addColorStop(0.12, T.wall[1]); wall.addColorStop(1, T.wall[2]);
    c.fillStyle = wall; c.fillRect(0, H, w, this.wallH);
    c.fillStyle = 'rgba(255,190,120,0.18)'; c.fillRect(0, H, w, 1.5);
    this.wallDetail(c, r, T.wallStyle);
    // floor
    const fl = c.createLinearGradient(0, this.floorTop, 0, h);
    fl.addColorStop(0, T.floor[0]); fl.addColorStop(1, T.floor[1]);
    c.fillStyle = fl; c.fillRect(0, this.floorTop, w, h - this.floorTop);
    if (T.ground === 'tiles') {
      c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1;
      const vx = w / 2, vy = this.floorTop - 260 * u;
      for (let i = -14; i <= 14; i++) { const bx = w / 2 + i * 70 * u; c.beginPath(); c.moveTo(vx + (bx - vx) * ((this.floorTop - vy) / (h - vy)), this.floorTop); c.lineTo(bx, h); c.stroke(); }
      for (let k = 1; k < 9; k++) { const y = this.floorTop + (h - this.floorTop) * Math.pow(k / 9, 1.6); c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    } else if (T.ground === 'earth' || T.ground === 'sand') {
      for (let i = 0; i < (w * (h - this.floorTop)) / 300; i++) { c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,220,170,0.05)'; c.fillRect(r() * w, this.floorTop + r() * (h - this.floorTop), 1.5 * u, 1.2 * u); }
      if (T.ground === 'sand') { c.strokeStyle = 'rgba(255,210,160,0.06)'; c.lineWidth = 1; for (let k = 0; k < 14; k++) { const y0 = this.floorTop + (h - this.floorTop) * r(); c.beginPath(); for (let x = 0; x <= w; x += 10) c.lineTo(x, y0 + Math.sin(x / (40 * u) + k) * 3 * u); c.stroke(); } }
    } else if (T.ground === 'snow') {
      for (let i = 0; i < (w * (h - this.floorTop)) / 200; i++) { c.fillStyle = r() < 0.6 ? 'rgba(255,255,255,0.12)' : 'rgba(20,30,60,0.15)'; const y = this.floorTop + r() * (h - this.floorTop); c.beginPath(); c.ellipse(r() * w, y, (3 + r() * 9) * u, (1 + r() * 2) * u, 0, 0, Math.PI * 2); c.fill(); }
    } else {
      c.strokeStyle = 'rgba(70,120,80,0.22)'; c.lineWidth = 1;
      for (let i = 0; i < (w * (h - this.floorTop)) / 260; i++) { const x = r() * w, y = this.floorTop + r() * (h - this.floorTop), l = (2 + r() * 4) * u * this.depth(y); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 2 * u, y - l); c.stroke(); }
    }
    if (T.rangoli) this.rangoli(c, w / 2, (this.placeTop + this.placeBottom) / 2, Math.min(w * 0.22, 95 * u));

    const prev = this.diyas;
    const n = Math.max(5, Math.floor(w / (48 * u)));
    this.diyas = Array.from({ length: n }, (_, i) => ({ x: (w / n) * (i + 0.5), y: H, lit: prev[i] ? prev[i].lit : true, ph: r() * 6, out: 0 }));
  }

  /** Strings of toran lights between rooftops. */
  torans(r, tops, chance) {
    const u = this.u;
    for (let i = 0; i < tops.length - 1; i++) {
      if (r() > chance) continue;
      const a = tops[i], b = tops[i + 1];
      const sag = 10 * u + r() * 14 * u, n = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (7 * u)));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        this.bulbs.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag, c: k % TORAN.length, ph: i });
      }
    }
  }

  milkyWay(c, r) {
    const w = this.w, H = this.horizon;
    c.save(); c.translate(w * 0.5, H * 0.45); c.rotate(-0.45);
    const L = Math.hypot(w, H);
    const g = c.createLinearGradient(0, -H * 0.18, 0, H * 0.18);
    g.addColorStop(0, 'rgba(160,170,255,0)'); g.addColorStop(0.5, 'rgba(190,180,255,0.09)'); g.addColorStop(1, 'rgba(160,170,255,0)');
    c.fillStyle = g; c.fillRect(-L / 2, -H * 0.18, L, H * 0.36);
    c.fillStyle = '#e6e9ff';
    for (let i = 0; i < 700; i++) { c.globalAlpha = 0.15 + r() * 0.45; c.fillRect((r() - 0.5) * L, (r() + r() + r() - 1.5) * H * 0.08, 1, 1); }
    c.restore(); c.globalAlpha = 1;
  }

  /** Village: hills, thatched huts with glowing doorways, coconut palms and a banyan. */
  village(c, r, H) {
    const u = this.u, w = this.w, tops = [];
    c.fillStyle = '#0c1330'; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= w + 10; x += 8) c.lineTo(x, H - (34 + 16 * Math.sin(x / (80 * u) + 1) + 9 * Math.sin(x / (31 * u))) * u);
    c.lineTo(w, H); c.fill();
    const banyan = w * (0.15 + r() * 0.2);
    let x = -14 * u;
    while (x < w + 10) {
      c.fillStyle = '#05070f';
      if (Math.abs(x - banyan) < 30 * u) { // banyan tree
        for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(x + (r() - 0.5) * 70 * u, H - (52 + r() * 30) * u, (18 + r() * 14) * u, 0, Math.PI * 2); c.fill(); }
        c.fillRect(x - 5 * u, H - 50 * u, 10 * u, 50 * u);
        x += 70 * u; continue;
      }
      if (r() < 0.3) { // coconut palm
        const lean = (r() - 0.5) * 24 * u, th = (70 + r() * 40) * u, tx = x + lean, ty = H - th;
        c.strokeStyle = '#05070f'; c.lineWidth = 3.2 * u; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + lean * 0.2, H - th * 0.5, tx, ty); c.stroke();
        c.lineWidth = 2.2 * u;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, l = (20 + r() * 8) * u; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * l * 0.6, ty - 8 * u, tx + Math.cos(a) * l, ty + Math.abs(Math.sin(a)) * 6 * u + 8 * u); c.stroke(); }
        x += 26 * u; continue;
      }
      const hw = (40 + r() * 30) * u, wh = (16 + r() * 10) * u, rh = (18 + r() * 12) * u;
      c.fillRect(x, H - wh, hw, wh + 1);
      c.beginPath(); c.moveTo(x - 6 * u, H - wh); c.lineTo(x + hw / 2, H - wh - rh); c.lineTo(x + hw + 6 * u, H - wh); c.fill();
      if (r() < 0.7) { // a warm doorway and a little window
        const dx = x + hw * (0.25 + r() * 0.4);
        c.fillStyle = '#ffb45c'; c.globalAlpha = 0.75; c.fillRect(dx, H - 11 * u, 6 * u, 11 * u);
        if (r() < 0.6) { c.globalAlpha = 0.6; c.fillRect(x + hw * 0.75, H - wh + 5 * u, 4 * u, 4 * u); }
        c.globalAlpha = 1;
      }
      tops.push({ x: x + hw / 2, y: H - wh - rh + 4 * u });
      x += hw + (4 + r() * 22) * u;
    }
    return tops;
  }

  /** River ghat: temples on the far bank outlined in lights, reflections and floating diyas on the water. */
  ghat(c, r, H) {
    const u = this.u, w = this.w, river = Math.min(64 * u, H * 0.2), bank = H - river;
    this.skyline(c, r, bank, 0.4, '#160f2c', 0.12);
    // far-bank steps
    c.fillStyle = '#100b22'; c.fillRect(0, bank - 10 * u, w, 10 * u);
    c.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 3; k++) c.fillRect(0, bank - 10 * u + k * 3.4 * u, w, 0.8);
    // temples
    const count = Math.max(3, Math.round(w / (150 * u)));
    for (let i = 0; i < count; i++) {
      const cx = (w / count) * (i + 0.5) + (r() - 0.5) * 30 * u, th = (60 + r() * 50) * u, tw = (26 + r() * 16) * u, base = bank - 10 * u;
      c.fillStyle = '#0a0719';
      c.fillRect(cx - tw * 1.3, base - 18 * u, tw * 2.6, 18 * u);
      c.beginPath(); c.moveTo(cx - tw, base - 18 * u); c.quadraticCurveTo(cx - tw * 0.8, base - th * 0.85, cx, base - th);
      c.quadraticCurveTo(cx + tw * 0.8, base - th * 0.85, cx + tw, base - 18 * u); c.fill();
      c.fillRect(cx - 0.8 * u, base - th - 12 * u, 1.6 * u, 12 * u);
      c.save(); c.fillStyle = '#ff9933'; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(cx + 0.8 * u, base - th - 12 * u); c.lineTo(cx + 10 * u, base - th - 8.5 * u); c.lineTo(cx + 0.8 * u, base - th - 5.5 * u); c.fill(); c.restore();
      // lamp outlines along the shikhara
      for (let k = 0; k <= 12; k++) {
        const t = k / 12, q = (a, b2, c2) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b2 + t * t * c2;
        const yy = q(base - 18 * u, base - th * 0.85, base - th);
        this.bulbs.push({ x: q(cx - tw, cx - tw * 0.8, cx), y: yy, c: 1, ph: k }, { x: q(cx + tw, cx + tw * 0.8, cx), y: yy, c: 1, ph: k + 1 });
      }
      for (let k = 0; k <= 10; k++) this.bulbs.push({ x: cx - tw * 1.3 + (tw * 2.6 * k) / 10, y: base - 18 * u, c: 1, ph: k });
    }
    // the river
    const rg = c.createLinearGradient(0, bank, 0, H);
    rg.addColorStop(0, '#120c2c'); rg.addColorStop(1, '#0a0820');
    c.fillStyle = rg; c.fillRect(0, bank, w, river);
    // shimmering reflections of the temple lamps
    c.fillStyle = '#ffcf6e';
    for (const b of this.bulbs) {
      if (r() < 0.5) continue;
      for (let k = 0; k < 5; k++) { c.globalAlpha = 0.22 * (1 - k / 5); c.fillRect(b.x - (2 + r() * 3) * u, bank + 2 * u + (bank - b.y) * 0.35 + k * 4 * u, (4 + r() * 6) * u, 1); }
    }
    // floating diyas
    for (let i = 0; i < Math.round(w / (70 * u)); i++) {
      const fx = r() * w, fy = bank + river * (0.3 + r() * 0.6);
      const gl = c.createRadialGradient(fx, fy, 0, fx, fy, 14 * u);
      gl.addColorStop(0, 'rgba(255,190,90,0.5)'); gl.addColorStop(1, 'rgba(255,190,90,0)');
      c.globalAlpha = 1; c.fillStyle = gl; c.fillRect(fx - 14 * u, fy - 14 * u, 28 * u, 28 * u);
      c.fillStyle = '#fff1c2'; c.fillRect(fx - 0.8 * u, fy - 2.4 * u, 1.6 * u, 2.4 * u);
      c.globalAlpha = 0.5; c.fillStyle = '#ffcf6e'; c.fillRect(fx - 3 * u, fy + 2 * u, 6 * u, 1);
    }
    c.globalAlpha = 1;
  }

  /** Open sky: rolling hills, a lone tree and far-off village lights. */
  hills(c, r, H) {
    const u = this.u, w = this.w;
    const ridge = (amp, base, f1, f2, ph) => (x) => H - (base + amp * Math.sin(x / (f1 * u) + ph) + amp * 0.45 * Math.sin(x / (f2 * u) + ph * 2)) * u;
    const far = ridge(16, 46, 140, 53, 1.3), near = ridge(10, 20, 90, 37, 4.1);
    c.fillStyle = '#0a0d26'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= w + 8; x += 6) c.lineTo(x, far(x)); c.lineTo(w, H); c.fill();
    c.fillStyle = '#ffcf7a';
    for (let i = 0; i < w / (18 * u); i++) { const x = r() * w; c.globalAlpha = 0.25 + r() * 0.5; c.fillRect(x, far(x) + (3 + r() * 10) * u, 1.3 * u, 1.3 * u); }
    c.globalAlpha = 1;
    c.fillStyle = '#04050c'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= w + 8; x += 6) c.lineTo(x, near(x)); c.lineTo(w, H); c.fill();
    const tx = w * (0.72 + r() * 0.15), ty = near(tx);
    c.fillRect(tx - 2.5 * u, ty - 34 * u, 5 * u, 36 * u);
    for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(tx + (r() - 0.5) * 40 * u, ty - (40 + r() * 16) * u, (12 + r() * 8) * u, 0, Math.PI * 2); c.fill(); }
  }

  /** Texture on the front wall: mud plaster, sandbags, logs, a palace balustrade or snow. */
  wallDetail(c, r, style) {
    const u = this.u, w = this.w, H = this.horizon, wh = this.wallH;
    if (style === 'mud') { c.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < w / (6 * u); i++) c.fillRect(r() * w, H + 3 + r() * (wh - 5), (4 + r() * 10) * u, 1); }
    else if (style === 'sandbag') {
      for (let row = 0; row < 2; row++) for (let x = row ? -9 * u : 0; x < w; x += 18 * u) {
        const y = H + 2 * u + row * wh * 0.48;
        c.fillStyle = row ? '#5c5639' : '#77704f'; c.beginPath(); c.ellipse(x + 9 * u, y + wh * 0.22, 8.6 * u, wh * 0.24, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + 8.6 * u, y + wh * 0.05, 0.8 * u, wh * 0.34);
      }
    } else if (style === 'log') {
      for (let k = 0; k < 2; k++) { c.fillStyle = k ? '#3f2814' : '#5a3a20'; c.fillRect(0, H + k * wh * 0.5, w, wh * 0.46); c.fillStyle = 'rgba(255,220,180,0.08)'; c.fillRect(0, H + k * wh * 0.5 + 1, w, 1); }
      c.fillStyle = '#2b1a0c'; for (let x = 20 * u; x < w; x += 70 * u) c.fillRect(x, H - 4 * u, 4 * u, wh + 4 * u);
    } else if (style === 'balustrade') {
      c.fillStyle = 'rgba(80,60,40,0.45)';
      for (let x = 3 * u; x < w; x += 9 * u) { c.beginPath(); c.ellipse(x + 2.5 * u, H + wh * 0.55, 2.2 * u, wh * 0.32, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#f3e6d0'; c.fillRect(0, H, w, 2.5 * u); c.fillRect(0, H + wh - 2 * u, w, 2 * u);
    } else if (style === 'snow') {
      c.fillStyle = '#f5f9ff';
      c.beginPath(); c.moveTo(0, H + 2 * u); for (let x = 0; x <= w + 6; x += 6) c.lineTo(x, H - (1.5 + Math.sin(x / (13 * u)) * 1.2 + r() * 0.8) * u); c.lineTo(w, H + 2 * u); c.fill();
    }
  }

  pines(c, r, base, n, h0, h1, col, snowy = false) {
    const u = this.u;
    for (let i = 0; i < n; i++) {
      const x = r() * this.w, th = (h0 + r() * (h1 - h0)) * u, tw = th * 0.42;
      c.fillStyle = col;
      for (let k = 0; k < 3; k++) { const y = base - th * (0.25 + k * 0.28); c.beginPath(); c.moveTo(x - tw * (1 - k * 0.25), y + th * 0.3); c.lineTo(x, y - th * 0.18); c.lineTo(x + tw * (1 - k * 0.25), y + th * 0.3); c.fill(); }
      c.fillRect(x - 1.5 * u, base - th * 0.12, 3 * u, th * 0.12);
      if (snowy) { c.fillStyle = 'rgba(235,242,255,0.75)'; for (let k = 0; k < 3; k++) { const y = base - th * (0.25 + k * 0.28); c.beginPath(); c.moveTo(x - tw * 0.3 * (1 - k * 0.25), y + th * 0.06); c.lineTo(x, y - th * 0.18); c.lineTo(x + tw * 0.3 * (1 - k * 0.25), y + th * 0.06); c.fill(); } }
    }
  }
  tent(c, x, base, tw, th, col, glow) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - tw / 2, base); c.lineTo(x, base - th); c.lineTo(x + tw / 2, base); c.fill();
    if (glow) { c.fillStyle = glow; c.beginPath(); c.moveTo(x - tw * 0.12, base); c.lineTo(x, base - th * 0.55); c.lineTo(x + tw * 0.12, base); c.fill(); }
  }
  windowsIn(c, r, x, y, bw, bh, density, near = true) {
    const u = this.u;
    c.save();
    for (let wy = y + 6 * u; wy < y + bh - 6 * u; wy += 11 * u) for (let wx = x + 4 * u; wx < x + bw - 8 * u; wx += 9 * u) {
      if (r() > density) continue;
      c.fillStyle = r() < 0.75 ? '#ffc56b' : '#ffe2a8'; c.globalAlpha = (near ? 0.55 : 0.25) + r() * 0.35; c.fillRect(wx, wy, 4 * u, 5 * u);
    }
    c.restore();
  }
  mountains(c, r, base, peaks, hMin, hMax, col, snowcap) {
    const u = this.u, w = this.w;
    for (let i = 0; i < peaks; i++) {
      const cx = (w / peaks) * (i + 0.5) + (r() - 0.5) * 60 * u, ph = (hMin + r() * (hMax - hMin)) * u, pw = ph * (1.1 + r() * 0.6);
      c.fillStyle = col; c.beginPath(); c.moveTo(cx - pw, base); c.lineTo(cx - pw * 0.15, base - ph * 0.92); c.lineTo(cx, base - ph); c.lineTo(cx + pw * 0.2, base - ph * 0.9); c.lineTo(cx + pw, base); c.fill();
      if (snowcap) { c.fillStyle = snowcap; c.beginPath(); c.moveTo(cx - pw * 0.32, base - ph * 0.68); c.lineTo(cx - pw * 0.15, base - ph * 0.92); c.lineTo(cx, base - ph); c.lineTo(cx + pw * 0.2, base - ph * 0.9); c.lineTo(cx + pw * 0.36, base - ph * 0.66); c.lineTo(cx + pw * 0.12, base - ph * 0.74); c.lineTo(cx - pw * 0.05, base - ph * 0.64); c.fill(); }
    }
  }

  /** Himalaya: snow peaks, snowy pines and a wooden chalet with lights on its eaves. */
  himalaya(c, r, H) {
    const u = this.u, w = this.w;
    this.mountains(c, r, H, Math.max(3, Math.round(w / (160 * u))), 90, 150, '#1a2742', 'rgba(220,232,255,0.55)');
    this.mountains(c, r, H, Math.max(2, Math.round(w / (240 * u))), 50, 80, '#111b30', 'rgba(220,232,255,0.4)');
    this.pines(c, r, H, Math.round(w / (40 * u)), 30, 60, '#0a1222', true);
    const cx = w * (0.55 + r() * 0.25), cw = 70 * u, ch = 26 * u;
    c.fillStyle = '#20140c'; c.fillRect(cx, H - ch, cw, ch);
    c.fillStyle = '#e9f0fa'; c.beginPath(); c.moveTo(cx - 8 * u, H - ch); c.lineTo(cx + cw / 2, H - ch - 24 * u); c.lineTo(cx + cw + 8 * u, H - ch); c.fill();
    c.fillStyle = '#ffc56b'; c.globalAlpha = 0.8; c.fillRect(cx + 10 * u, H - ch + 8 * u, 9 * u, 8 * u); c.fillRect(cx + cw - 19 * u, H - ch + 8 * u, 9 * u, 8 * u); c.globalAlpha = 1;
    for (let k = 0; k <= 14; k++) { const t = k / 14; this.bulbs.push({ x: cx - 8 * u + (cw + 16 * u) * t, y: H - ch - 24 * u * (1 - Math.abs(t - 0.5) * 2) + 2 * u, c: k % TORAN.length, ph: 0 }); }
  }

  /** Thar desert: dunes, a fort on the ridge and a camp of lit tents. */
  desert(c, r, H) {
    const u = this.u, w = this.w;
    const dune = (amp, base, f, ph, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= w + 8; x += 6) c.lineTo(x, H - (base + amp * Math.sin(x / (f * u) + ph) + amp * 0.4 * Math.sin(x / (f * 0.37 * u))) * u); c.lineTo(w, H); c.fill(); };
    dune(14, 50, 120, 0.7, '#2a1c2a');
    // fort with chhatris on the far dune
    const fx = w * (0.15 + r() * 0.2), fw = 120 * u, fb = H - 52 * u;
    c.fillStyle = '#1b1220';
    c.fillRect(fx, fb - 30 * u, fw, 32 * u);
    for (let i = 0; i < 4; i++) { const tx = fx + (fw / 3) * i; c.fillRect(tx - 6 * u, fb - 42 * u, 12 * u, 44 * u); c.beginPath(); c.arc(tx, fb - 42 * u, 7 * u, Math.PI, 0); c.fill(); c.fillRect(tx - 0.6 * u, fb - 54 * u, 1.2 * u, 6 * u); }
    for (let i = 0; i <= 16; i++) this.bulbs.push({ x: fx + (fw * i) / 16, y: fb - 30 * u, c: 1, ph: i });
    dune(10, 22, 80, 2.1, '#1f1416');
    // camels
    const camel = (x, y, s) => {
      c.fillStyle = '#120b0e'; c.save(); c.translate(x, y); c.scale(s * u, s * u);
      c.beginPath(); c.moveTo(-12, -10); c.quadraticCurveTo(-6, -22, 0, -12); c.quadraticCurveTo(5, -20, 10, -11); c.lineTo(14, -16); c.lineTo(16, -24); c.lineTo(20, -24); c.lineTo(18, -14); c.lineTo(12, -6); c.lineTo(-12, -6); c.fill();
      for (const lx of [-10, -5, 5, 10]) c.fillRect(lx, -7, 1.6, 10);
      c.restore();
    };
    camel(w * 0.62, H - 18 * u, 1.1); camel(w * 0.7, H - 16 * u, 0.95);
    for (let i = 0; i < 3; i++) this.tent(c, w * (0.82 + i * 0.07), H - 2, 30 * u, 24 * u, '#2d1a14', 'rgba(255,170,80,0.8)');
  }

  /** Border post: a watchtower with searchlight, barracks, tents and the tricolour. */
  army(c, r, H) {
    const u = this.u, w = this.w;
    this.mountains(c, r, H, Math.max(3, Math.round(w / (180 * u))), 50, 90, '#141c28', 'rgba(210,220,240,0.25)');
    // barracks
    const bx = w * 0.08, bw = Math.min(w * 0.42, 260 * u), bh = 22 * u;
    c.fillStyle = '#0d120d'; c.fillRect(bx, H - bh, bw, bh);
    c.beginPath(); c.moveTo(bx - 4 * u, H - bh); c.lineTo(bx + bw / 2, H - bh - 10 * u); c.lineTo(bx + bw + 4 * u, H - bh); c.fill();
    this.windowsIn(c, r, bx, H - bh, bw, bh, 0.5);
    for (let k = 0; k <= 26; k++) { const t = k / 26; this.bulbs.push({ x: bx + bw * t, y: H - bh - 10 * u * (1 - Math.abs(t - 0.5) * 2) - 1, c: k % TORAN.length, ph: 0 }); }
    // tents
    for (let i = 0; i < 3; i++) this.tent(c, bx + bw + (30 + i * 34) * u, H, 30 * u, 20 * u, '#1d2a18', i === 1 ? 'rgba(255,190,100,0.7)' : null);
    // watchtower
    const tx = w * 0.82, th = 95 * u;
    c.strokeStyle = '#0b0f0b'; c.lineWidth = 2.4 * u;
    c.beginPath(); c.moveTo(tx - 14 * u, H); c.lineTo(tx - 7 * u, H - th); c.moveTo(tx + 14 * u, H); c.lineTo(tx + 7 * u, H - th);
    c.moveTo(tx - 12 * u, H - th * 0.3); c.lineTo(tx + 9 * u, H - th * 0.65); c.moveTo(tx + 12 * u, H - th * 0.3); c.lineTo(tx - 9 * u, H - th * 0.65); c.stroke();
    c.fillStyle = '#0b0f0b'; c.fillRect(tx - 12 * u, H - th - 16 * u, 24 * u, 16 * u);
    c.beginPath(); c.moveTo(tx - 15 * u, H - th - 16 * u); c.lineTo(tx, H - th - 24 * u); c.lineTo(tx + 15 * u, H - th - 16 * u); c.fill();
    this.beams.push({ x: tx, y: H - th - 9 * u });
    // flagpole with the tricolour
    const px = w * 0.62, ph = 110 * u;
    c.fillStyle = '#cfd3d8'; c.fillRect(px - 0.9 * u, H - ph, 1.8 * u, ph);
    const fw = 30 * u, fh = 20 * u, fy = H - ph + 2 * u;
    [['#ff9933', 0], ['#ffffff', 1], ['#138808', 2]].forEach(([col, i]) => { c.fillStyle = col; c.fillRect(px + 1, fy + (fh / 3) * i, fw, fh / 3); });
    c.strokeStyle = '#000080'; c.lineWidth = 0.8 * u; c.beginPath(); c.arc(px + 1 + fw / 2, fy + fh / 2, fh / 7, 0, Math.PI * 2); c.stroke();
  }

  /** Palace: a heritage facade with domes, chhatris and arches outlined in lamps. */
  palace(c, r, H) {
    const u = this.u, w = this.w, pw = Math.min(w * 0.9, 560 * u), px = (w - pw) / 2, ph = 60 * u, top = H - ph;
    this.skyline(c, r, H, 0.4, '#170f2a', 0.1);
    c.fillStyle = '#120b1e'; c.fillRect(px, top, pw, ph);
    // central dome
    const cx = w / 2, dr = Math.min(48 * u, pw * 0.12);
    c.fillRect(cx - dr * 1.3, top - 22 * u, dr * 2.6, 24 * u);
    c.beginPath(); c.moveTo(cx - dr, top - 22 * u); c.bezierCurveTo(cx - dr * 1.25, top - 22 * u - dr * 1.1, cx - dr * 0.2, top - 22 * u - dr * 1.4, cx, top - 22 * u - dr * 1.8);
    c.bezierCurveTo(cx + dr * 0.2, top - 22 * u - dr * 1.4, cx + dr * 1.25, top - 22 * u - dr * 1.1, cx + dr, top - 22 * u); c.fill();
    // chhatris along the roof
    const n = Math.max(4, Math.round(pw / (70 * u)));
    for (let i = 0; i < n; i++) {
      const x = px + (pw / n) * (i + 0.5); if (Math.abs(x - cx) < dr * 1.6) continue;
      c.fillRect(x - 8 * u, top - 12 * u, 16 * u, 12 * u); c.beginPath(); c.arc(x, top - 12 * u, 9 * u, Math.PI, 0); c.fill(); c.fillRect(x - 0.6 * u, top - 25 * u, 1.2 * u, 5 * u);
      for (let k = 0; k <= 8; k++) { const a = Math.PI + (k / 8) * Math.PI; this.bulbs.push({ x: x + Math.cos(a) * 9 * u, y: top - 12 * u + Math.sin(a) * 9 * u, c: 1, ph: k }); }
    }
    // arches, lit inside, with lamps along the outline
    const an = Math.max(5, Math.round(pw / (36 * u))), aw = (pw / an) * 0.6;
    for (let i = 0; i < an; i++) {
      const ax = px + (pw / an) * (i + 0.5), ab = H - 2 * u, ah = ph * 0.62;
      c.fillStyle = 'rgba(255,170,80,0.22)'; c.beginPath(); c.moveTo(ax - aw / 2, ab); c.lineTo(ax - aw / 2, ab - ah * 0.6); c.quadraticCurveTo(ax - aw / 2, ab - ah, ax, ab - ah * 1.05); c.quadraticCurveTo(ax + aw / 2, ab - ah, ax + aw / 2, ab - ah * 0.6); c.lineTo(ax + aw / 2, ab); c.fill();
    }
    for (let k = 0; k <= 30; k++) this.bulbs.push({ x: px + (pw * k) / 30, y: top, c: 1, ph: k });
    for (let k = 0; k <= 16; k++) { const t = k / 16; this.bulbs.push({ x: cx - dr + 2 * dr * t, y: top - 22 * u - Math.sin(t * Math.PI) * dr * 1.45 - (t > 0.35 && t < 0.65 ? dr * 0.25 : 0), c: 1, ph: k }); }
  }

  /** Adventure camp: forest, a mountain, tents and a crackling campfire. */
  camp(c, r, H) {
    const u = this.u, w = this.w;
    this.mountains(c, r, H, 2, 100, 140, '#101a2c', 'rgba(220,232,255,0.3)');
    this.pines(c, r, H, Math.round(w / (22 * u)), 40, 90, '#060b0a');
    const t1 = w * 0.22, t2 = w * 0.36;
    this.tent(c, t1, H, 46 * u, 34 * u, '#2a3a1a', 'rgba(255,190,100,0.75)');
    this.tent(c, t2, H, 38 * u, 28 * u, '#4a2414', null);
    this.fires.push({ x: w * 0.7, y: H - 2 * u });
    c.fillStyle = '#2b1a0c'; c.fillRect(w * 0.7 - 20 * u, H - 6 * u, 40 * u, 4 * u);
  }

  /** Home: the family house with a decorated door, kandil lanterns and the family on the balcony. */
  home(c, r, H) {
    const u = this.u, w = this.w, hw = Math.min(w * 0.82, 480 * u), hx = (w - hw) / 2, f1 = 40 * u, f2 = 34 * u, top = H - f1 - f2;
    this.skyline(c, r, H, 0.55, '#1a0f2c', 0.15);
    c.fillStyle = '#2a1626'; c.fillRect(hx, top, hw, f1 + f2);
    c.fillStyle = '#3a1f30'; c.beginPath(); c.moveTo(hx - 10 * u, top); c.lineTo(hx + hw / 2, top - 26 * u); c.lineTo(hx + hw + 10 * u, top); c.fill();
    c.fillStyle = '#1c0f19'; c.fillRect(hx - 6 * u, H - f1 - 4 * u, hw + 12 * u, 4 * u); // balcony slab
    // door with marigold toran
    const dx = w / 2, dw = 26 * u, dh = 32 * u;
    c.fillStyle = '#ffb45c'; c.globalAlpha = 0.85; c.fillRect(dx - dw / 2, H - dh, dw, dh); c.globalAlpha = 1;
    c.fillStyle = '#5a2a12'; c.fillRect(dx - dw / 2 - 3 * u, H - dh - 3 * u, dw + 6 * u, 3 * u);
    for (let i = 0; i <= 8; i++) { const x = dx - dw / 2 + (dw * i) / 8; c.fillStyle = i % 2 ? '#ff9a1a' : '#ffd23f'; c.beginPath(); c.arc(x, H - dh + 1.5 * u + Math.sin((i / 8) * Math.PI) * 3 * u, 1.8 * u, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2f8f4e'; c.fillRect(x - 0.6 * u, H - dh + 3 * u, 1.2 * u, 4 * u); }
    // windows
    for (const k of [-1, 1]) for (const fl of [0, 1]) {
      const wx = dx + k * hw * 0.3 - 11 * u, wy = fl ? top + 8 * u : H - f1 + 8 * u;
      c.fillStyle = '#ffc56b'; c.globalAlpha = 0.7; c.fillRect(wx, wy, 22 * u, 18 * u); c.globalAlpha = 1;
      c.fillStyle = '#2a1626'; c.fillRect(wx + 10.4 * u, wy, 1.2 * u, 18 * u);
      this.kandils.push({ x: wx + 11 * u, y: wy - 2 * u, col: ['#ff4b4b', '#ffcf3a', '#ff5ec4', '#53ff8f'][(k + 1) + fl] });
    }
    // the family watching from the balcony
    const fam = [[-0.12, 1, 1], [-0.07, 0.75, 0], [-0.03, 0.62, 0], [0.09, 1.05, 1], [0.13, 0.9, 1]];
    c.fillStyle = '#0d0610';
    for (const [ox, s, adult] of fam) {
      const x = dx + ox * hw, b = H - f1 - 4 * u, hgt = (adult ? 22 : 15) * u * s;
      c.beginPath(); c.arc(x, b - hgt, 3.2 * u * (adult ? 1 : 0.85), 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(x - 4.5 * u * s, b); c.quadraticCurveTo(x - 4.5 * u * s, b - hgt * 0.75, x, b - hgt * 0.8); c.quadraticCurveTo(x + 4.5 * u * s, b - hgt * 0.75, x + 4.5 * u * s, b); c.fill();
    }
    for (let k = 0; k <= 30; k++) { const t = k / 30; this.bulbs.push({ x: hx - 10 * u + (hw + 20 * u) * t, y: top - 26 * u * (1 - Math.abs(t - 0.5) * 2), c: k % TORAN.length, ph: 0 }); }
  }

  /** Per-frame living details: campfire, kandils, searchlight, snow or sand. */
  drawLiving(c, now) {
    const u = this.u, t = now / 1000;
    for (const f of this.fires) {
      this.lights.push({ x: f.x, y: f.y, r: 90 * u, colour: 'rgba(255,150,60,1)', a: 0.5 + Math.sin(t * 9) * 0.08 });
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const fh = (16 + Math.sin(t * 11 + i * 2) * 4) * u, fx = f.x + (i - 2) * 4 * u;
        const g = c.createRadialGradient(fx, f.y - fh * 0.3, 0, fx, f.y - fh * 0.3, fh * 0.7);
        g.addColorStop(0, 'rgba(255,240,180,0.9)'); g.addColorStop(0.5, 'rgba(255,140,40,0.6)'); g.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(fx - 4 * u, f.y); c.quadraticCurveTo(fx - 3 * u, f.y - fh * 0.6, fx + Math.sin(t * 7 + i) * 2 * u, f.y - fh); c.quadraticCurveTo(fx + 3 * u, f.y - fh * 0.6, fx + 4 * u, f.y); c.fill();
      }
      c.restore();
    }
    for (const k of this.kandils) {
      const sw = Math.sin(t * 1.6 + k.x) * 0.12, x = k.x + sw * 6 * u, y = k.y;
      c.save(); c.translate(x, y); c.rotate(sw);
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 0.6 * u; c.beginPath(); c.moveTo(0, -8 * u); c.lineTo(0, 0); c.stroke();
      c.globalCompositeOperation = 'lighter'; c.fillStyle = k.col; c.globalAlpha = 0.85;
      c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = (i % 2 ? 3 : 7) * u; c.lineTo(Math.cos(a) * rr, 7 * u + Math.sin(a) * rr); } c.fill();
      c.globalAlpha = 0.25; c.beginPath(); c.arc(0, 7 * u, 14 * u, 0, Math.PI * 2); c.fill();
      c.fillStyle = k.col; c.globalAlpha = 0.7; for (let i = -1; i <= 1; i++) c.fillRect(i * 2 * u, 14 * u, 0.8 * u, 7 * u);
      c.restore();
    }
    for (const b of this.beams) {
      const a = -Math.PI / 2 + Math.sin(t * 0.35) * 1.1, L = this.h * 0.9;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createLinearGradient(b.x, b.y, b.x + Math.cos(a) * L, b.y + Math.sin(a) * L);
      g.addColorStop(0, 'rgba(255,250,220,0.22)'); g.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(b.x, b.y);
      c.lineTo(b.x + Math.cos(a - 0.07) * L, b.y + Math.sin(a - 0.07) * L); c.lineTo(b.x + Math.cos(a + 0.07) * L, b.y + Math.sin(a + 0.07) * L); c.fill();
      c.restore();
    }
    if (this.flakes.length) {
      const snow = (THEMES[this.theme] || {}).weather === 'snow';
      c.fillStyle = snow ? 'rgba(255,255,255,0.85)' : 'rgba(230,190,140,0.35)';
      for (const f of this.flakes) {
        if (snow) { f.y += f.s * 0.6 * u; f.x += Math.sin(t + f.ph) * 0.4 * u; } else { f.x += f.s * 1.8 * u; f.y += Math.sin(t * 2 + f.ph) * 0.2 * u; }
        if (f.y > this.h) { f.y = -4; f.x = Math.random() * this.w; }
        if (f.x > this.w) { f.x = -4; f.y = this.horizon + Math.random() * (this.h - this.horizon); }
        c.beginPath(); c.arc(f.x, f.y, f.s * u * (snow ? 1 : 0.6), 0, Math.PI * 2); c.fill();
      }
    }
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
    this.drawLiving(c, now);
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
  clearMarks() { this.debris = []; this.smoke = []; this.rings = []; this.scorch = []; this.lights.length = 0; }
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
