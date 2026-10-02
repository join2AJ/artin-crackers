// Haptics, flashlight and the spark particle engine.

// Native Android bridge (window.ArtinNative), absent in the browser.
export const NATIVE = typeof window !== 'undefined' && window.ArtinNative ? window.ArtinNative : null;

// ---------------------------------------------------------------- HAPTICS
// Every cracker's vibration is made from its own rendered sound: the loudness
// envelope (one value per 10 ms) becomes motor strength. Several crackers can
// play at once, so their envelopes are mixed into one timeline and streamed to
// the motor in short chunks.
//   - Android app: true amplitude control (0-255) via ArtinNative.vibrateWave.
//   - Browser: on/off only, so loudness becomes pulse width (PWM) in 25 ms slots.
const FRAME = 10, CHUNK = 1400, REFRESH = 1000;
export const Haptics = {
  supported: NATIVE ? NATIVE.hasVibrator() : typeof navigator !== 'undefined' && 'vibrate' in navigator,
  amplitude: NATIVE ? NATIVE.hasAmplitude() : false,
  enabled: true,
  intensity: 1,
  tracks: [],
  timer: 0,

  /** Adds a sound envelope that starts at `when` (performance.now ms). */
  add(envelope, feel, when) {
    if (!this.enabled || !this.supported || !feel) return;
    this.tracks.push({ env: envelope, feel, when });
    this.flush();
  },
  level(t) {
    let v = 0;
    for (const tr of this.tracks) {
      const i = Math.floor((t - tr.when) / FRAME);
      if (i < 0 || i >= tr.env.length) continue;
      const lvl = tr.env[i];
      if (lvl > 0.16) v += Math.pow(Math.min(1, lvl * 1.6), 0.8) * tr.feel; // the gate keeps fuse fizz out
    }
    return Math.min(1, v * this.intensity);
  },
  flush() {
    clearTimeout(this.timer);
    const now = performance.now();
    this.tracks = this.tracks.filter((tr) => now < tr.when + tr.env.length * FRAME);
    if (!this.tracks.length) return;
    if (NATIVE) {
      const t = [], a = [];
      for (let ms = 0; ms < CHUNK; ms += FRAME) {
        const amp = Math.round(255 * this.level(now + ms));
        const v = amp < 14 ? 0 : amp;
        if (a.length && a[a.length - 1] === v) t[t.length - 1] += FRAME; else { t.push(FRAME); a.push(v); }
      }
      if (a.some((v) => v > 0)) NATIVE.vibrateWave(JSON.stringify(t), JSON.stringify(a)); else NATIVE.cancelVibration();
    } else {
      const slot = 25, pat = [];
      // pattern alternates on, off, on… and must start with "on" (0 ms is fine)
      const push = (isOn, ms) => {
        if (!pat.length && !isOn) pat.push(0);
        if (isOn === (pat.length % 2 === 0)) pat.push(ms); else pat[pat.length - 1] += ms;
      };
      for (let ms = 0; ms < CHUNK; ms += slot) {
        const l = Math.max(this.level(now + ms), this.level(now + ms + 10));
        const w = l < 0.06 ? 0 : Math.max(6, Math.round(slot * Math.min(1, l * 1.3)));
        if (w) push(true, w);
        if (slot - w) push(false, slot - w);
      }
      if (pat.length && pat.some((v, i) => i % 2 === 0 && v > 0)) navigator.vibrate(pat.slice(0, 99)); else navigator.vibrate(0);
    }
    this.timer = setTimeout(() => this.flush(), REFRESH);
  },
  /** Short tap for UI feedback. */
  tap(ms = 10) {
    if (!this.enabled || !this.supported) return;
    if (NATIVE) NATIVE.vibrateWave(JSON.stringify([ms]), JSON.stringify([Math.round(120 * this.intensity)]));
    else navigator.vibrate(ms);
  },
  stop() {
    this.tracks = []; clearTimeout(this.timer);
    if (!this.supported) return;
    if (NATIVE) NATIVE.cancelVibration(); else navigator.vibrate(0);
  },
};

// ---------------------------------------------------------------- TORCH
// Rear flashlight bursts on every big blast. In the app the LED is driven
// natively (no permission). In Chrome on Android it uses the camera's `torch`
// constraint, which needs camera permission and HTTPS.
export const Torch = {
  track: null, stream: null, busyUntil: 0,
  get possible() { return NATIVE ? NATIVE.hasTorch() : !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
  get active() { return !!this.track; },
  async enable() {
    if (this.track) return true;
    if (NATIVE) {
      if (!NATIVE.hasTorch()) throw new Error('This phone has no rear flashlight.');
      this.track = 'native';
      return true;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('This browser does not expose the flashlight. Try Chrome on Android, or the app.');
    }
    this.stream = stream; this.track = track;
    return true;
  },
  disable() {
    if (NATIVE && this.track) NATIVE.torchPattern('[0]');
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; this.track = null;
  },
  async set(on) { if (this.track && this.track !== 'native') { try { await this.track.applyConstraints({ advanced: [{ torch: on }] }); } catch { /* ignore */ } } },
  /** One flash of `ms` milliseconds (ignored while a flash is still on). */
  async flash(ms) {
    if (!this.track) return;
    const now = performance.now();
    if (now < this.busyUntil) return;
    this.busyUntil = now + ms + 60;
    if (NATIVE) { NATIVE.torchPattern(JSON.stringify([ms])); return; }
    await this.set(true);
    setTimeout(() => this.set(false), ms);
  },
};

// ---------------------------------------------------------------- SPARKS
// Additive-blended streaks on a canvas that fades a little every frame, so
// fast sparks leave glowing trails like a long-exposure photo.
const CAP = 2600;
export class Sparks {
  constructor(canvas) {
    this.cv = canvas; this.cx = canvas.getContext('2d'); this.list = []; this.pool = [];
  }
  resize(w, h, dpr) {
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cx.setTransform(dpr, 0, 0, dpr, 0, 0); this.w = w; this.h = h;
  }
  get count() { return this.list.length; }
  /**
   * Adds a spark. o: x, y, vx, vy (px/s), life (s), colour, size (px), drag (1/s),
   * grav (px/s²), floor (y where it dies or bounces), split (children on death),
   * crackle (white pop on death), trail (sheds embers), alpha, flicker.
   */
  add(o) {
    if (this.list.length >= CAP) return null;
    const p = this.pool.pop() || {};
    p.x = o.x; p.y = o.y; p.px = o.x; p.py = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.age = 0; p.life = o.life || 1; p.colour = o.colour || '#ffd27a'; p.size = o.size || 1.5;
    p.drag = o.drag ?? 1; p.grav = o.grav ?? 200; p.floor = o.floor ?? Infinity; p.bounce = o.bounce ?? 0;
    p.split = o.split || 0; p.crackle = !!o.crackle; p.trail = o.trail || 0; p.alpha = o.alpha ?? 1; p.flicker = !!o.flicker;
    p.tcol = o.tcol || '#ffb347'; p.dot = !!o.dot;
    this.list.push(p);
    return p;
  }
  update(dt) {
    const out = [];
    for (const p of this.list) {
      p.px = p.x; p.py = p.y;
      p.age += dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > p.floor) {
        if (p.bounce && Math.abs(p.vy) > 40) { p.y = p.floor; p.vy *= -p.bounce; p.vx *= 0.6; p.py = p.y; }
        else p.age = p.life;
      }
      if (p.trail && Math.random() < p.trail * dt * 60) {
        out.push({ x: p.x, y: p.y, vx: p.vx * 0.1 + (Math.random() - 0.5) * 20, vy: p.vy * 0.1 + 10, life: 0.35 + Math.random() * 0.5, colour: p.tcol, size: p.size * 0.6, drag: 2, grav: 60, alpha: p.alpha * 0.7 });
      }
      if (p.age >= p.life) {
        if (p.split) {
          for (let i = 0; i < p.split; i++) {
            const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 90;
            out.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.08 + Math.random() * 0.14, colour: '#fff6dd', size: p.size * 0.7, drag: 3, grav: 40, alpha: p.alpha });
          }
        }
        if (p.crackle) out.push({ x: p.x, y: p.y, life: 0.07, colour: '#ffffff', size: p.size * 3.2, drag: 0, grav: 0, alpha: p.alpha, dot: true });
      }
    }
    const keep = [];
    for (const p of this.list) { if (p.age < p.life) keep.push(p); else this.pool.push(p); }
    this.list = keep;
    for (const o of out) this.add(o);
  }
  draw(dt) {
    const c = this.cx;
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = 1;
    c.fillStyle = `rgba(0,0,0,${Math.min(1, 1 - Math.exp(-dt / 0.07))})`;
    c.fillRect(0, 0, this.w, this.h);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (const p of this.list) {
      const k = 1 - p.age / p.life;
      let a = p.alpha * Math.min(1, k * 2.2);
      if (p.flicker) a *= Math.random() < 0.35 ? 0.15 : 1;
      if (a <= 0.01) continue;
      c.globalAlpha = a;
      if (p.dot) {
        c.fillStyle = p.colour; c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + k), 0, Math.PI * 2); c.fill();
        continue;
      }
      c.strokeStyle = p.colour; c.lineWidth = p.size;
      c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(p.x + 0.01, p.y); c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
  clear() { this.pool.push(...this.list); this.list = []; this.cx.clearRect(0, 0, this.w, this.h); }
}
