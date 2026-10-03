// The cracker catalogue. Each cracker has:
//   plan(r)        a random but reproducible timeline (fuse, blasts, pops…)
//   sound(S, p)    synthesises that timeline (see synth.js)
//   feel           how strongly the phone vibrates for its sound (0..1.5)
// The visuals (visuals.js) read the same plan, so sight, sound and vibration
// always line up.

export const PALETTES = {
  gold: ['#ffd27a', '#ffe9b0', '#ffb347'],
  red: ['#ff4b4b', '#ff7a6b', '#ffd0c4'],
  green: ['#53ff8f', '#a6ffc4', '#e8ffe9'],
  blue: ['#5aa9ff', '#9fd0ff', '#e4f2ff'],
  violet: ['#c77dff', '#e3b8ff', '#fff0ff'],
  silver: ['#ffffff', '#e7eefc', '#cfd8ff'],
  saffron: ['#ff9933', '#ffffff', '#3fd16b'],
};
const COLOURS = ['red', 'green', 'blue', 'violet', 'gold', 'silver'];
const BURSTS = ['peony', 'peony', 'willow', 'crackle', 'ring', 'peony'];

/** Smooth random intensity curve, sampled every 50 ms. */
function burnCurve(r, dur, { rise = 0.5, fall = 1.2, wobble = 0.18, swell = true } = {}) {
  const n = Math.max(2, Math.round(dur * 20)), c = [];
  let w = 0;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * dur;
    w += (r() * 2 - 1) * 0.35; w *= 0.8;
    let v = Math.min(1, t / rise) * Math.min(1, (dur - t) / fall);
    if (swell) v *= 0.82 + 0.18 * Math.sin((t / dur) * Math.PI);
    c.push(Math.max(0, Math.min(1.1, v * (1 + w * wobble))));
  }
  return c;
}
export const sample = (curve, dur, t) => {
  if (t <= 0 || t >= dur) return 0;
  const f = (t / dur) * (curve.length - 1), i = Math.floor(f);
  return curve[i] + (curve[Math.min(curve.length - 1, i + 1)] - curve[i]) * (f - i);
};

function aerial(S, at, p, { far = false } = {}) {
  // sound travels: the bang arrives a little after the flash
  const delay = far ? 0 : 0.1;
  S.bang(at + delay, p.size ?? 0.65, S.out, { dark: far ? 0.7 : 0.15 });
  if (p.type === 'crackle') S.crackle(at + delay + 0.45, 1.1, 90, far ? 0.08 : 0.32, S.out, { f: 3800, curve: (k) => 1 - k * 0.6 });
  if (p.type === 'willow') S.crackle(at + delay + 0.3, 1.6, 22, far ? 0.03 : 0.1, S.out, { f: 6000 });
}

export const CRACKERS = [
  {
    id: 'anar', name: 'Anar', hi: 'अनार', blurb: 'Flower-pot fountain of golden sparks', kind: 'anar', feel: 0.45, free: true,
    plan(r) { return anarPlan(r); },
    sound(S, p) { anarSound(S, p); },
  },
  {
    id: 'chakri', name: 'Chakri', hi: 'चकरी', blurb: 'Ground spinner that whirls a ring of fire', kind: 'chakri', feel: 0.45, free: true,
    plan(r) {
      const fuse = r.range(0.8, 1.2), burn = r.range(5.5, 7);
      return { fuse, burn, end: fuse + burn, curve: burnCurve(r, burn, { rise: 0.9, fall: 1.1, wobble: 0.12 }), rps: r.range(7, 10), tail: 1.6 };
    },
    sound(S, p) {
      S.fuse(0.02, p.fuse, 0.13);
      const t = p.fuse, n = Math.round(p.burn * 200), am = [];
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const k = sample(p.curve, p.burn, (i / n) * p.burn);
        ph += (p.rps * Math.min(1, k * 1.3) * 2 * Math.PI) / 200;
        am.push(k * (0.62 + 0.38 * Math.sin(ph * 2)));
      }
      S.hiss(t, p.burn, am, 0.42, S.out, { f: 3400, q: 0.7 });
      S.hiss(t, p.burn, p.curve, 0.2, S.out, { type: 'lowpass', f: 700, q: 0.5, rate: 0.8 });
      const o = S.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(980, t + p.burn * 0.4); o.frequency.linearRampToValueAtTime(760, t + p.burn);
      S.chain(o, S.filt('bandpass', 1100, 3), S.curveGain(t, p.burn, am, 0.05), S.out); o.start(t); o.stop(t + p.burn + 0.05);
      S.crackle(t, p.burn, 26, 0.18, S.out, { f: 4500, curve: (k) => sample(p.curve, 1, k) });
    },
  },
  {
    id: 'rocket', name: 'Rocket', hi: 'रॉकेट', blurb: 'Whistles up from its bottle and bursts', kind: 'rocket', feel: 0.85, free: true,
    plan(r) {
      const fuse = r.range(0.7, 1.1), flight = r.range(1.05, 1.4);
      const type = r.pick(BURSTS), colour = type === 'willow' || type === 'crackle' ? 'gold' : r.pick(COLOURS);
      return { fuse, launch: fuse, burst: fuse + flight, type, colour, colour2: r() < 0.35 ? r.pick(COLOURS) : null,
        whistle: r() < 0.65, height: r.range(0.55, 0.95), drift: r.range(-0.12, 0.12), size: r.range(0.55, 0.7), end: fuse + flight + 2.4, tail: 1.8 };
    },
    sound(S, p) {
      S.fuse(0.02, p.fuse, 0.12);
      S.chain(S.noise(p.launch, 0.25), S.filt('bandpass', 1500, 0.8), S.env(p.launch, 0.45, 0.002, 0.2), S.out);
      const fl = p.burst - p.launch;
      S.whoosh(p.launch, fl, 0.3);
      if (p.whistle) S.whistle(p.launch + 0.05, fl - 0.08, 1500, 3000, 0.16);
      else S.crackle(p.launch, fl, 70, 0.14, S.out, { f: 4000 });
      aerial(S, p.burst, p);
    },
  },
  {
    id: 'ladi', name: 'Ladi', hi: 'लड़ी', blurb: '100-wala string — rat-a-tat-tat', kind: 'ladi', feel: 0.9, free: true,
    plan(r) { return ladiPlan(r, 100, 0.034, 0.11); },
    sound(S, p) { ladiSound(S, p); },
  },
  {
    id: 'bomb', name: 'Sutli Bomb', hi: 'सुतली बम', blurb: 'Twine-wrapped thunder. Cover your ears!', kind: 'bomb', feel: 1.3, free: true,
    plan(r) { const fuse = r.range(2.2, 3); return { fuse, bang: fuse, size: r.range(0.95, 1.1), end: fuse + 0.4, tail: 3.2, colour: 'jute' }; },
    sound(S, p) { S.fuse(0.02, p.fuse, 0.16); S.bang(p.bang, p.size); },
  },
  {
    id: 'phuljhadi', name: 'Phuljhadi', hi: 'फुलझड़ी', blurb: 'Sparkler — hold and draw with light', kind: 'phuljhadi', feel: 0.12, free: true,
    plan(r) { const burn = r.range(11, 13); return { fuse: 0.25, burn, end: 0.25 + burn, tail: 0.6, curve: burnCurve(r, burn, { rise: 0.4, fall: 0.8, wobble: 0.1, swell: false }) }; },
    sound(S, p) {
      const t = p.fuse;
      S.chain(S.noise(0.02, 0.4), S.filt('bandpass', 3000, 0.7), S.env(0.02, 0.25, 0.05, 0.3), S.out);
      S.crackle(t, p.burn, 140, 0.2, S.out, { f: 6200, spread: 1.1, curve: (k) => sample(p.curve, 1, k) });
      S.crackle(t, p.burn, 18, 0.22, S.out, { f: 2800, curve: (k) => sample(p.curve, 1, k) });
      S.hiss(t, p.burn, p.curve, 0.06, S.out, { type: 'highpass', f: 5000 });
    },
  },
  {
    id: 'bijli', name: 'Bijli', hi: 'बिजली', blurb: 'Little red cracker with a sharp crack', kind: 'bomb', feel: 0.9, free: true,
    plan(r) { const fuse = r.range(1.2, 1.7); return { fuse, bang: fuse, size: r.range(0.5, 0.6), end: fuse + 0.3, tail: 2.2, colour: 'red', tube: true }; },
    sound(S, p) { S.fuse(0.02, p.fuse, 0.12); S.bang(p.bang, p.size); },
  },
  {
    id: 'saanp', name: 'Saanp Goli', hi: 'साँप गोली', blurb: 'Snake tablet: watch the ash snake grow', kind: 'snake', feel: 0, free: true,
    plan(r) {
      const fuse = 0.5, burn = r.range(7, 9);
      return { fuse, burn, end: fuse + burn, tail: 1, seed: Math.floor(r() * 1e9), curve: burnCurve(r, burn, { rise: 0.5, fall: 1, wobble: 0.3, swell: false }) };
    },
    sound(S, p) {
      S.chain(S.noise(0.02, 0.3), S.filt('bandpass', 3000, 0.7), S.env(0.02, 0.15, 0.03, 0.25), S.out);
      S.hiss(p.fuse, p.burn, p.curve, 0.07, S.out, { f: 2200, q: 0.8 });
      S.crackle(p.fuse, p.burn, 10, 0.05, S.out, { f: 2500 });
    },
  },
  {
    id: 'pencil', name: 'Pencil', hi: 'पेंसिल', blurb: 'Colour pencil that burns with a red, green or pink flame', kind: 'phuljhadi', feel: 0.12, free: true,
    plan(r) {
      const burn = r.range(9, 11);
      return { fuse: 0.3, burn, end: 0.3 + burn, tail: 0.6, colour: r.pick(['#ff3b3b', '#3bff6a', '#ff4fd8']), pencil: true, curve: burnCurve(r, burn, { rise: 0.3, fall: 0.6, wobble: 0.08, swell: false }) };
    },
    sound(S, p) {
      S.chain(S.noise(0.02, 0.35), S.filt('bandpass', 2400, 0.7), S.env(0.02, 0.25, 0.04, 0.3), S.out);
      S.hiss(p.fuse, p.burn, p.curve, 0.16, S.out, { f: 1800, q: 0.5 });
      S.hiss(p.fuse, p.burn, p.curve, 0.08, S.out, { type: 'highpass', f: 4500 });
      S.crackle(p.fuse, p.burn, 20, 0.08, S.out, { f: 3500, curve: (k) => sample(p.curve, 1, k) });
    },
  },
  // ---- premium -------------------------------------------------------------
  {
    id: 'rainbow', name: 'Rainbow', hi: 'रंगीन अनार', blurb: 'Rainbow anar: a fountain that changes colour', kind: 'anar', feel: 0.45, free: false,
    plan(r) { return { ...anarPlan(r), colours: ['#ff4b4b', '#ffd27a', '#53ff8f', '#5aa9ff', '#c77dff'] }; },
    sound(S, p) { anarSound(S, p); },
  },
  {
    id: 'hazaar', name: '1000-wala', hi: 'हज़ार वाली', blurb: 'The legendary 1000-cracker ladi', kind: 'ladi', feel: 0.9, free: false,
    plan(r) { return ladiPlan(r, 1000, 0.018, 0.05); },
    sound(S, p) { ladiSound(S, p); },
  },
  {
    id: 'skyshot', name: 'Sky Shot', hi: 'स्काई शॉट', blurb: '12-shot colour cake for the finale', kind: 'skyshot', feel: 0.85, free: false,
    plan(r) {
      const fuse = r.range(1.1, 1.5), shots = [];
      let t = fuse;
      for (let i = 0; i < 12; i++) {
        const type = i === 11 ? 'crackle' : r.pick(BURSTS), flight = r.range(0.75, 0.95);
        shots.push({ launch: t, burst: t + flight, type, colour: type === 'willow' || type === 'crackle' ? 'gold' : COLOURS[i % COLOURS.length],
          height: r.range(0.5, 0.9), drift: r.range(-0.18, 0.18), size: r.range(0.45, 0.6) });
        t += i > 8 ? r.range(0.25, 0.35) : r.range(0.5, 0.75);
      }
      return { fuse, shots, end: shots[11].burst + 2.4, tail: 2 };
    },
    sound(S, p) {
      S.fuse(0.02, p.fuse, 0.13);
      p.shots.forEach((s, i) => {
        const pan = ((i % 3) - 1) * 0.15;
        S.thump(s.launch, 0.55);
        S.crackle(s.launch, s.burst - s.launch, 50, 0.08, S.at(pan), { f: 4000 });
        aerial(S, s.burst, s);
      });
    },
  },
  {
    id: 'atom', name: 'Atom Bomb', hi: 'एटम बम', blurb: 'The biggest bang on the block', kind: 'bomb', feel: 1.5, free: false,
    plan(r) { const fuse = r.range(3, 3.8); return { fuse, bang: fuse, size: r.range(1.35, 1.5), end: fuse + 0.6, tail: 3.8, colour: 'green', big: true }; },
    sound(S, p) {
      S.fuse(0.02, p.fuse, 0.18);
      S.bang(p.bang, p.size);
      S.bang(p.bang + 0.012, p.size * 0.7, S.at(0.2), { dark: 0.4 });
    },
  },
];

// Distant fireworks from the neighbourhood (ambient), quiet and muffled.
export const DISTANT = {
  id: 'distant', kind: 'distant', feel: 0,
  plan(r) { const type = r.pick(BURSTS); return { type, size: r.range(0.45, 0.6), end: 0.2, tail: 2.4, delay: r.range(0.35, 1.1) }; },
  sound(S, p) { aerial(S, 0.05, p, { far: true }); },
};

function anarPlan(r) {
  const fuse = r.range(1, 1.5), burn = r.range(6.5, 8.5);
  return { fuse, burn, end: fuse + burn, curve: burnCurve(r, burn, { rise: 0.6, fall: 1.4, wobble: 0.22 }), tail: 2 };
}
function anarSound(S, p) {
  S.fuse(0.02, p.fuse, 0.14);
  const t = p.fuse, c = p.curve;
  S.chain(S.noise(t, 0.2), S.filt('bandpass', 2600), S.env(t, 0.35, 0.002, 0.15), S.out);
  S.hiss(t, p.burn, c, 0.42, S.out, { f: 2600, q: 0.55 });
  S.hiss(t, p.burn, c, 0.32, S.out, { type: 'lowpass', f: 520, q: 0.4, rate: 0.7 });
  S.hiss(t, p.burn, c, 0.12, S.out, { type: 'highpass', f: 7000 });
  S.crackle(t, p.burn, 38, 0.28, S.out, { f: 3600, curve: (k) => sample(c, 1, k) });
}

function ladiPlan(r, n, gapLo, gapHi) {
  const fuse = r.range(0.6, 0.9), pops = [];
  let t = fuse;
  for (let i = 0; i < n; i++) {
    const dud = r() < 0.025;
    // pops race along the string, sometimes two at once, sometimes a stutter
    const twin = r() < 0.12;
    pops.push({ i, t, dud, g: r.range(0.5, 0.95) });
    if (!twin) t += r.range(gapLo, gapHi) * (r() < 0.04 ? 3 : 1);
  }
  return { fuse, pops, n, end: t + 0.1, tail: 2 };
}
function ladiSound(S, p) {
  S.fuse(0.02, p.fuse, 0.12);
  // the fuse runs from the right end of the string to the left
  S.pops(p.pops.filter((q) => !q.dud).map((q) => ({ t: q.t, g: q.g * 0.85, pan: (1 - q.i / p.n) - 0.5 })));
  S.crackle(p.fuse, p.end - p.fuse, 12, 0.05, S.out, { f: 3000 });
}

export const byId = Object.fromEntries(CRACKERS.map((c) => [c.id, c]));

// Tray icons (inline SVG, 48×48), drawn to match the in-scene art.
export const ICONS = {
  anar: '<path d="M16 42 L24 12 L32 42 Z" fill="#c8323c"/><path d="M19.5 29 H28.5 L29.6 33 H18.4 Z" fill="#ffcf4a"/><path d="M14 42 H34 V45 H14 Z" fill="#7a3b1a"/><g stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"><path d="M24 10 V3"/><path d="M22 10 L17 4"/><path d="M26 10 L31 4"/><path d="M21 11 L13 8"/><path d="M27 11 L35 8"/></g>',
  chakri: '<circle cx="24" cy="26" r="13" fill="#1f8a5a"/><path d="M24 26 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0" fill="none" stroke="#ffcf4a" stroke-width="2.4" stroke-dasharray="5 3"/><circle cx="24" cy="26" r="4" fill="#c8323c"/><g stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"><path d="M37 26 l6 -3"/><path d="M11 26 l-6 3"/><path d="M24 13 l3 -6"/><path d="M24 39 l-3 6"/></g>',
  rocket: '<path d="M18 46 h12 v-8 q0 -4 -3 -6 v-6 h-6 v6 q-3 2 -3 6 Z" fill="#2c6b4b" opacity=".9"/><path d="M24 4 L28 12 V24 H20 V12 Z" fill="#c8323c"/><path d="M24 4 L28 12 H20 Z" fill="#ffcf4a"/><path d="M24 24 V40" stroke="#c49a6c" stroke-width="1.6"/>',
  ladi: '<g fill="#d9303a" stroke="#7a1a20" stroke-width=".6"><rect x="6" y="10" width="5" height="11" rx="1" transform="rotate(-35 8 15)"/><rect x="14" y="16" width="5" height="11" rx="1" transform="rotate(35 16 21)"/><rect x="22" y="22" width="5" height="11" rx="1" transform="rotate(-35 24 27)"/><rect x="30" y="28" width="5" height="11" rx="1" transform="rotate(35 32 33)"/><rect x="38" y="34" width="5" height="11" rx="1" transform="rotate(-35 40 39)"/></g><path d="M4 8 L44 44" stroke="#c49a6c" stroke-width="1.4" fill="none"/>',
  bomb: '<circle cx="23" cy="28" r="14" fill="#b07a45"/><g stroke="#7a5228" stroke-width="1.4" fill="none"><path d="M10 24 q13 6 26 0"/><path d="M10 32 q13 -6 26 0"/><path d="M19 15 q6 13 0 26"/><path d="M27 15 q-6 13 0 26"/></g><path d="M32 17 q5 -6 9 -8" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="41" cy="8" r="3" fill="#ffd27a"/>',
  phuljhadi: '<path d="M10 44 L34 14" stroke="#6b6f78" stroke-width="2.4" stroke-linecap="round"/><path d="M10 44 L18 34" stroke="#8a5a2b" stroke-width="3.2" stroke-linecap="round"/><g stroke="#fff3c4" stroke-width="1.3" stroke-linecap="round"><path d="M34 14 l6 -8"/><path d="M34 14 l9 0"/><path d="M34 14 l-1 -10"/><path d="M34 14 l8 6"/><path d="M34 14 l-7 -5"/><path d="M40 6 l3 1"/><path d="M43 14 l2 -3"/></g><circle cx="34" cy="14" r="2.6" fill="#fff"/>',
  bijli: '<rect x="18" y="16" width="12" height="26" rx="2" fill="#d9303a"/><rect x="18" y="24" width="12" height="4" fill="#ffcf4a"/><path d="M24 16 q2 -6 7 -9" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="31" cy="7" r="3" fill="#ffd27a"/><path d="M22 34 l4 -6 h-3 l3 -5" stroke="#fff3c9" stroke-width="1.4" fill="none"/>',
  saanp: '<ellipse cx="14" cy="42" rx="7" ry="2.6" fill="#111"/><path d="M14 40 C 10 30, 26 30, 22 22 S 34 12, 36 6" stroke="#3a332d" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M14 40 C 10 30, 26 30, 22 22 S 34 12, 36 6" stroke="#7a6e62" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-dasharray="2 3"/><circle cx="36" cy="6" r="3" fill="#b8ff6b"/>',
  pencil: '<path d="M10 44 L32 14" stroke="#e8e0d0" stroke-width="3" stroke-linecap="round"/><path d="M10 44 L16 36" stroke="#8a5a2b" stroke-width="3.4" stroke-linecap="round"/><path d="M24 25 L32 14" stroke="#c8323c" stroke-width="3.6" stroke-linecap="round"/><circle cx="33" cy="12" r="6" fill="#ff3b3b" opacity=".45"/><circle cx="33" cy="12" r="3" fill="#ffe0e0"/>',
  rainbow: '<path d="M16 42 L24 12 L32 42 Z" fill="#5a2d8a"/><path d="M19.5 29 H28.5 L29.6 33 H18.4 Z" fill="#53ff8f"/><path d="M14 42 H34 V45 H14 Z" fill="#3a1a5a"/><g stroke-width="1.8" stroke-linecap="round"><path d="M24 10 V3" stroke="#ffd27a"/><path d="M22 10 L17 4" stroke="#ff4b4b"/><path d="M26 10 L31 4" stroke="#53ff8f"/><path d="M21 11 L13 8" stroke="#c77dff"/><path d="M27 11 L35 8" stroke="#5aa9ff"/></g>',
  hazaar: '<g fill="#d9303a"><rect x="5" y="6" width="3" height="7" rx="1"/><rect x="11" y="10" width="3" height="7" rx="1"/><rect x="17" y="14" width="3" height="7" rx="1"/><rect x="23" y="18" width="3" height="7" rx="1"/><rect x="29" y="22" width="3" height="7" rx="1"/><rect x="35" y="26" width="3" height="7" rx="1"/><rect x="41" y="30" width="3" height="7" rx="1"/><rect x="5" y="22" width="3" height="7" rx="1"/><rect x="11" y="26" width="3" height="7" rx="1"/><rect x="17" y="30" width="3" height="7" rx="1"/><rect x="23" y="34" width="3" height="7" rx="1"/></g><text x="24" y="46" text-anchor="middle" font-size="9" font-family="Share Tech Mono, monospace" fill="#ffd27a">1000</text>',
  skyshot: '<rect x="9" y="22" width="30" height="22" fill="#5a2d8a"/><path d="M9 22 h30 l-4 -4 h-22 Z" fill="#7b46b3"/><g fill="#1b1030"><circle cx="16" cy="21" r="2"/><circle cx="24" cy="21" r="2"/><circle cx="32" cy="21" r="2"/></g><g stroke-linecap="round" stroke-width="1.6"><path d="M16 17 L12 5" stroke="#53ff8f"/><path d="M24 17 V3" stroke="#ffd27a"/><path d="M32 17 L36 5" stroke="#ff4b4b"/></g><path d="M9 32 h30" stroke="#ffcf4a" stroke-width="2"/>',
  atom: '<circle cx="23" cy="28" r="15" fill="#2f8f4e"/><g stroke="#ffcf4a" stroke-width="1.6" fill="none"><ellipse cx="23" cy="28" rx="11" ry="4.5"/><ellipse cx="23" cy="28" rx="11" ry="4.5" transform="rotate(60 23 28)"/><ellipse cx="23" cy="28" rx="11" ry="4.5" transform="rotate(-60 23 28)"/></g><circle cx="23" cy="28" r="2.5" fill="#ff4b4b"/><path d="M33 16 q5 -6 8 -8" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="41" cy="8" r="3" fill="#ffd27a"/>',
};

// ------------------------------------------------------------------ field manual + green impact
// cat: cracker-box shelf. eco: what one real cracker would have cost the air.
//   co2   grams of CO₂, rough estimate (about 1 g per gram of powder and paper burnt)
//   smoke cigarettes' worth of smoke. src 'study' = measured in a 2016 study by the Chest
//         Research Foundation and the University of Pune; otherwise our estimate
//   pm    peak PM2.5 (µg/m³) measured where people stand when lighting it (same study)
//   db    typical loudness near the cracker, estimate
export const CATS = { ground: 'Ground', sky: 'Sky', loud: 'Loud', strings: 'Strings', hand: 'Handheld' };
export const MANUAL = {
  anar: { cat: 'ground', eco: { co2: 60, smoke: 34, src: 'study', pm: 4860, db: 85 },
    how: 'A clay or paper cone packed with a slow-burning mix of potassium nitrate, charcoal and sulphur, plus aluminium or iron grains. It burns from the top down, and the metal grains glow white-gold as they are thrown up as sparks.',
    safety: 'Stand it on flat ground and never hold it. An old or damp anar can burst instead of fountaining.' },
  chakri: { cat: 'ground', eco: { co2: 25, smoke: 68, src: 'study', pm: 9490, db: 90 },
    how: 'A paper tube wound round a small disc, open at one end. Hot gas escaping sideways pushes the wheel round, like a tiny rocket bent into a circle.',
    safety: 'Light it on hard, flat ground away from feet. A spinning chakri skids where it likes.' },
  rocket: { cat: 'sky', eco: { co2: 20, smoke: 30, db: 110 },
    how: 'A tube of propellant on a balancing stick. The burning powder lifts it; a delay fuse then fires the bursting charge and the coloured stars at the top. Whistling rockets add a whistle mix that screams as it burns.',
    safety: 'Launch only from a bottle on open ground, pointing straight up, far from buildings, wires and trees.' },
  ladi: { cat: 'strings', eco: { co2: 60, smoke: 28, db: 120 },
    how: 'Small paper tubes of flash powder braided on one fuse. Each pop lights the next, so the whole string rattles through in seconds.',
    safety: 'Lay it straight on the ground and step well back. A ladi jumps and scatters burning paper.' },
  bomb: { cat: 'loud', eco: { co2: 40, smoke: 40, db: 125 },
    how: 'Flash powder packed into a ball and wrapped in many layers of jute twine (sutli). The tight wrapping holds the gas in until it bursts all at once, which is why it is so loud.',
    safety: 'One of the loudest crackers. Keep far away, and never relight a dud: wait, then soak it in water.' },
  phuljhadi: { cat: 'hand', eco: { co2: 8, smoke: 74, src: 'study', pm: 10390, db: 50 },
    how: 'A wire coated with a paste of oxidiser, fuel and iron or steel dust. The iron burns as it flies off, branching into the familiar star-shaped sparks.',
    safety: 'The wire stays hot enough to burn skin after the sparks stop. Drop used sticks into a bucket of water.' },
  bijli: { cat: 'loud', eco: { co2: 6, smoke: 10, db: 110 },
    how: 'A tiny paper tube of flash powder: aluminium powder and an oxidiser that burn almost instantly, giving a sharp crack.',
    safety: 'Small does not mean safe. Never light one in your hand.' },
  saanp: { cat: 'ground', eco: { co2: 3, smoke: 464, src: 'study', pm: 64500, db: 40 },
    how: 'A small tablet that burns slowly while gas puffs up the residue into a long, light ash "snake".',
    safety: 'It looks harmless, but it gave the highest smoke peak of all crackers measured: the smoke of 464 cigarettes in about nine seconds. Children usually light it just a foot away.' },
  pencil: { cat: 'hand', eco: { co2: 10, smoke: 50, db: 50 },
    how: 'A thin stick coated with a colour mix: strontium salts burn red, barium salts burn green, and blends give pink and purple.',
    safety: 'Hold it at arm\'s length, pointing away from people, hair and clothes.' },
  rainbow: { cat: 'ground', eco: { co2: 70, smoke: 40, db: 85 },
    how: 'An anar packed in coloured layers. As it burns down it reaches each new layer, so the fountain changes colour.',
    safety: 'Treat it like any anar: flat ground, light it at arm\'s length, then step back.' },
  hazaar: { cat: 'strings', eco: { co2: 600, smoke: 277, src: 'study', pm: 38540, db: 125 },
    how: 'A thousand small crackers braided on one long fuse, firing for half a minute or more.',
    safety: 'Measured near the people lighting it, a 1000-wala produced one of the highest smoke peaks of any common cracker, about 277 cigarettes\' worth.' },
  skyshot: { cat: 'sky', eco: { co2: 200, smoke: 120, db: 115 },
    how: 'A cake of tubes linked by a single fuse. Each tube in turn fires a shell into the sky: a lift charge throws it up and a time fuse bursts it.',
    safety: 'Set it on firm, level ground before lighting. A cake that tips over fires sideways.' },
  atom: { cat: 'loud', eco: { co2: 80, smoke: 60, db: 130 },
    how: 'A large flash-powder bomb in a hard casing. Among the loudest crackers sold, and often above India\'s noise limit.',
    safety: 'Never light it near homes, hospitals, animals or people. Its bang can damage hearing.' },
};
