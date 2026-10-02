// Firecracker sound synthesis (Web Audio API).
//
// Every cracker is synthesised offline (OfflineAudioContext) from a "plan" of
// timed events, giving one AudioBuffer per variant. Rendering offline means a
// 1000-wala ladi costs nothing at play time, and lets us read the finished
// sound's loudness envelope, which drives the vibration so the phone feels
// exactly what you hear.

export const SR = 44100;

let NOISE = null;
function noiseBuffer() {
  if (!NOISE) {
    NOISE = new AudioBuffer({ length: SR * 3, numberOfChannels: 1, sampleRate: SR });
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return NOISE;
}

// Outdoor impulse response: a terrace among houses. Discrete slap-backs from
// nearby walls, then a diffuse tail that gets darker as it decays.
let IR = null;
function outdoorIR() {
  if (IR) return IR;
  const len = Math.round(SR * 2.4);
  IR = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SR });
  const slaps = [[0.031, 0.55], [0.058, 0.4], [0.097, 0.34], [0.142, 0.26], [0.205, 0.2], [0.29, 0.16], [0.41, 0.1], [0.57, 0.07], [0.78, 0.04]];
  for (let ch = 0; ch < 2; ch++) {
    const d = IR.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const bright = 0.06 + 0.7 * Math.exp(-t * 3);
      lp += (Math.random() * 2 - 1 - lp) * bright;
      d[i] = lp * Math.exp(-t * 2.6) * 0.5 * Math.min(1, t / 0.012);
    }
    for (const [t, a] of slaps) {
      const at = Math.round((t * (ch ? 1.07 : 1) + Math.random() * 0.004) * SR);
      for (let k = 0; k < 90; k++) d[at + k] += a * (ch ? 0.85 : 1) * Math.exp(-k / 18) * (Math.random() * 2 - 1);
    }
  }
  return IR;
}

const curveCache = new Map();
function softClip(amt) {
  const key = Math.round(amt * 10);
  if (curveCache.has(key)) return curveCache.get(key);
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = ((1 + amt) * x) / (1 + amt * Math.abs(x)); }
  curveCache.set(key, c);
  return c;
}

// RBJ biquad coefficients (same filters as Web Audio's BiquadFilterNode).
function coeffs(type, f, q) {
  const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
  else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  const a0 = 1 + al;
  return [b0 / a0, b1 / a0, b2 / a0, (-2 * cs) / a0, (1 - al) / a0];
}
/** Adds one filtered noise burst. `dec` = time to fall by 80 dB (like an exponential ramp to 0.0001). */
function grain(L, R, at, gl, gr, type, f, q, att, dec) {
  const [b0, b1, b2, a1, a2] = coeffs(type, f, q);
  const na = Math.max(1, Math.round(att * SR)), n = na + Math.round(dec * SR), k = Math.exp(-9.2 / (dec * SR));
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, e = 1;
  for (let i = 0; i < n; i++) {
    const idx = at + i;
    if (idx >= L.length) break;
    let env;
    if (i < na) env = i / na; else { env = e; e *= k; }
    const x = (Math.random() * 2 - 1) * env;
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    L[idx] += y * gl; R[idx] += y * gr;
  }
}

/** Seeded random generator, so a plan and its sound always match. */
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}

/** Synthesis toolkit bound to one (offline) context. */
function toolkit(ctx, out) {
  const R = Math.random;
  const S = {
    ctx, out,
    /** A stereo position: -1 left … 1 right. */
    at(p = 0) {
      if (!p) return out;
      const sp = ctx.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, p)); sp.connect(out); return sp;
    },
    noise(t, dur, rate = 1) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; s.playbackRate.value = rate;
      s.start(t, R() * 2.5); s.stop(t + dur + 0.05); return s;
    },
    filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; },
    env(t, peak, a, d) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
      return g;
    },
    curveGain(t, dur, curve, scale = 1) {
      const g = ctx.createGain(); g.gain.value = 0;
      const c = Float32Array.from(curve, (v) => Math.max(0, v * scale));
      g.gain.setValueCurveAtTime(c, t, dur);
      return g;
    },
    chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; },

    /** A big blast: sharp crack, a fat noise body, a sub-bass punch and a rumbling tail. */
    bang(t, size = 1, dest = out, { dark = 0 } = {}) {
      const sh = ctx.createWaveShaper(); sh.curve = softClip(1.2 + size * 1.6); sh.oversample = '2x';
      const post = ctx.createGain(); post.gain.value = 0.9; S.chain(sh, post, dest);
      const crackF = 1400 * (1 - dark * 0.6);
      S.chain(S.noise(t, 0.1), S.filt('highpass', crackF), S.env(t, 0.85 * (1 - dark * 0.5), 0.0004, 0.022 + 0.018 * size), sh);
      S.chain(S.noise(t, 0.45 * size + 0.25, 0.85), S.filt('lowpass', (1900 / Math.sqrt(size)) * (1 - dark * 0.6), 0.5), S.env(t, 1.05 * Math.sqrt(size), 0.0015, 0.2 * size + 0.07), sh);
      S.chain(S.noise(t, 0.3), S.filt('bandpass', 520 + R() * 160, 1.1), S.env(t, 0.55 * size, 0.001, 0.09 * size + 0.04), sh);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(115 + R() * 20, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.32 * size + 0.05);
      S.chain(o, S.env(t, 0.95, 0.002, 0.4 * size + 0.08), sh); o.start(t); o.stop(t + size + 0.4);
      S.chain(S.noise(t, 1.6 * size + 0.4, 0.5), S.filt('lowpass', 230, 0.4), S.env(t + 0.01, 0.32 * size, 0.04, 1.1 * size), dest);
    },

    /**
     * Many tiny sounds at once (ladi pops, crackle, sparkler fizz). Building
     * thousands of audio nodes is slow, so these are synthesised straight into
     * one buffer as "grains": filtered noise bursts with an exponential decay.
     * Each grain: { t, g, pan, parts: [[type 'bp'|'lp'|'hp', freq, q, attack s, decay s, gain]] }
     */
    grains(list, dest = out) {
      if (!list.length) return;
      let t0 = Infinity, t1 = 0;
      for (const e of list) { t0 = Math.min(t0, e.t); t1 = Math.max(t1, e.t); }
      const len = Math.ceil((t1 - t0 + 0.12) * SR);
      const buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SR });
      const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
      for (const e of list) {
        const at = Math.round((e.t - t0) * SR), pan = e.pan || 0;
        const gl = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2, gr = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
        for (const [type, f, q, att, dec, gm] of e.parts) grain(L, Rr, at, gl * e.g * gm, gr * e.g * gm, type, f, q, att, dec);
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(dest); src.start(t0);
    },

    /** A string of small paper-tube "tak"s (ladi). list: [{ t, g, pan }] */
    pops(list, dest = out) {
      S.grains(list.map((e) => ({ ...e, parts: [
        ['bp', 1900 + R() * 2200, 0.8, 0.0003, 0.01 + R() * 0.014, 1],
        ['lp', 800 + R() * 400, 0.707, 0.0008, 0.025 + R() * 0.02, 0.7],
        ['hp', 6000, 0.707, 0.0002, 0.004, 0.35],
      ] })), dest);
    },

    /** Random micro-pops: sparkler fizz, crackling stars, anar spit. */
    crackle(t0, dur, rate, g, dest = out, { f = 5200, spread = 0.9, curve = null } = {}) {
      const list = [];
      let t = t0;
      while (true) {
        const k = curve ? curve((t - t0) / dur) : 1;
        t += -Math.log(1 - R()) / Math.max(1, rate * Math.max(0.05, k));
        if (t >= t0 + dur) break;
        const lvl = g * (0.25 + R() * 0.75) * (curve ? curve((t - t0) / dur) : 1);
        if (lvl < 0.004) continue;
        list.push({ t, g: lvl, pan: (R() - 0.5) * 0.3, parts: [['bp', f * (1 - spread / 2 + R() * spread), 1.4, 0.0002, 0.0018 + R() * 0.006, 1]] });
      }
      S.grains(list, dest);
    },

    /** Filtered noise following a loudness curve (roar of an anar, hiss of a chakri). */
    hiss(t0, dur, curve, g, dest = out, { type = 'bandpass', f = 3000, q = 0.6, rate = 1 } = {}) {
      S.chain(S.noise(t0, dur, rate), S.filt(type, f, q), S.curveGain(t0, dur, curve, g), dest);
    },

    /** The rising "seeee" of a whistling rocket. */
    whistle(t0, dur, f0, f1, g, dest = out) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 22 + R() * 8;
      const lg = ctx.createGain(); lg.gain.value = f0 * 0.025; S.chain(lfo, lg, o.frequency);
      const h = ctx.createOscillator(); h.type = 'triangle';
      h.frequency.setValueAtTime(f0 * 2.01, t0); h.frequency.exponentialRampToValueAtTime(f1 * 2.01, t0 + dur);
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0.0001, t0); g1.gain.exponentialRampToValueAtTime(g, t0 + 0.08);
      g1.gain.setValueAtTime(g, t0 + dur - 0.06); g1.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const hg = ctx.createGain(); hg.gain.value = 0.18;
      o.connect(g1); h.connect(hg); hg.connect(g1); g1.connect(dest);
      [o, lfo, h].forEach((n) => { n.start(t0); n.stop(t0 + dur + 0.02); });
      S.chain(S.noise(t0, dur), S.filt('bandpass', (f0 + f1) / 2, 2), S.env(t0, g * 0.4, dur * 0.4, dur * 0.6), dest);
    },

    /** Burning fuse: sputtering fizz. */
    fuse(t0, dur, g = 0.12, dest = out) {
      if (dur <= 0) return;
      const n = Math.max(2, Math.round(dur * 30));
      S.hiss(t0, dur, Array.from({ length: n }, () => 0.4 + R() * 0.6), g * 0.5, dest, { f: 5500, q: 1.2 });
      S.crackle(t0, dur, 40, g, dest, { f: 4200 });
    },

    /** Launch "thoomp" of a sky-shot tube or a rocket leaving its bottle. */
    thump(t, g = 0.6, dest = out) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
      S.chain(o, S.env(t, g, 0.002, 0.12), dest); o.start(t); o.stop(t + 0.2);
      S.chain(S.noise(t, 0.15), S.filt('lowpass', 520), S.env(t, g * 0.8, 0.002, 0.08), dest);
      S.chain(S.noise(t, 0.4), S.filt('bandpass', 1800, 0.7), S.env(t + 0.01, g * 0.25, 0.03, 0.22), dest);
    },

    /** Upward whoosh. */
    whoosh(t0, dur, g = 0.35, dest = out) {
      const f = S.filt('bandpass', 700, 0.9);
      f.frequency.setValueAtTime(600, t0); f.frequency.exponentialRampToValueAtTime(2600, t0 + dur);
      S.chain(S.noise(t0, dur), f, S.env(t0, g, dur * 0.25, dur * 0.75), dest);
    },
  };
  return S;
}

/**
 * Renders `build(S)` into a stereo AudioBuffer of `dur` seconds and measures its
 * loudness envelope (peak per 10 ms frame, 0..1).
 */
export async function render(build, dur, { wet = 0.32 } = {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * dur), SR);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
  comp.connect(ctx.destination);
  const dry = ctx.createGain(); dry.connect(comp);
  const conv = ctx.createConvolver(); conv.buffer = outdoorIR();
  const wg = ctx.createGain(); wg.gain.value = wet;
  dry.connect(conv); conv.connect(wg); wg.connect(comp);
  build(toolkit(ctx, dry));
  const buffer = await ctx.startRendering();
  let peak = 0;
  const L = buffer.getChannelData(0), Rc = buffer.getChannelData(1);
  for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(Rc[i])); if (v > peak) peak = v; }
  if (peak > 0.97) { const k = 0.97 / peak; for (let i = 0; i < L.length; i++) { L[i] *= k; Rc[i] *= k; } }
  return { buffer, envelope: envelope(buffer, 10) };
}

export function envelope(buffer, frameMs) {
  const L = buffer.getChannelData(0), Rc = buffer.getChannelData(1);
  const step = Math.round((buffer.sampleRate * frameMs) / 1000), n = Math.ceil(L.length / step);
  const e = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let m = 0;
    for (let i = f * step, end = Math.min(L.length, i + step); i < end; i += 2) { const v = Math.abs(L[i]) + Math.abs(Rc[i]); if (v > m) m = v; }
    e[f] = Math.min(1, m / 2);
  }
  return e;
}
