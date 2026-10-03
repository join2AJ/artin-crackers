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
  if (p.type === 'thunder') S.bang(at + delay + 0.04, (p.size ?? 1) * 0.8, S.out, { dark: 0.6 });
}

export const CRACKERS = [
  {
    id: 'anar', name: 'Anar', hi: 'अनार', blurb: 'Flower-pot fountain of golden sparks', kind: 'anar', feel: 0.45, free: true,
    variants: [{ id: 'gold', name: 'Gold', sw: '#ffcf6e' }, { id: 'silver', name: 'Silver', sw: '#e6efff' }, { id: 'colour', name: 'Colour', sw: '#53ff8f' }, { id: 'giant', name: 'Giant', sw: '#ff9a3c' }],
    plan(r, v = 'gold') {
      const p = anarPlan(r, v === 'giant');
      if (v === 'silver') Object.assign(p, { colours: ['#ffffff', '#e6efff', '#cfe0ff'], bodyCols: ['#4a6fa5', '#9cc3ff', '#253e66'] });
      if (v === 'colour') Object.assign(p, { colours: ['#53ff8f', '#ff4b4b', '#ffd27a'], bodyCols: ['#1fae6a', '#7dffb4', '#0e5a36'] });
      if (v === 'giant') Object.assign(p, { big: true, bodyCols: ['#d4a020', '#ffe58a', '#7a5a10'] });
      return p;
    },
    sound(S, p) { anarSound(S, p); },
  },
  {
    id: 'chakri', name: 'Chakri', hi: 'चकरी', blurb: 'Ground spinner that whirls a ring of fire', kind: 'chakri', feel: 0.45, free: true,
    variants: [{ id: 'gold', name: 'Gold', sw: '#ffd27a' }, { id: 'green', name: 'Green', sw: '#7dff8a' }, { id: 'multi', name: 'Multicolour', sw: '#5aa9ff' }, { id: 'whistle', name: 'Whistling', sw: '#ffffff' }],
    plan(r, v = 'gold') {
      const fuse = r.range(0.8, 1.2), burn = r.range(5.5, 7);
      return { fuse, burn, end: fuse + burn, curve: burnCurve(r, burn, { rise: 0.9, fall: 1.1, wobble: 0.12 }), rps: r.range(7, 10), tail: 1.6,
        colours: v === 'green' ? ['#7dff8a', '#c9ffb0', '#ffffff'] : v === 'multi' ? ['#ff4b4b', '#53ff8f', '#5aa9ff', '#ffd27a'] : null, whistle: v === 'whistle' };
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
      if (p.whistle) S.whistle(t + 0.2, p.burn - 0.6, 2100, 2700, 0.09);
    },
  },
  {
    id: 'rocket', name: 'Rocket', hi: 'रॉकेट', blurb: 'Whistles up from its bottle and bursts', kind: 'rocket', feel: 0.85, free: true,
    variants: [{ id: 'mixed', name: 'Surprise', sw: '#ffffff' }, { id: 'whistle', name: 'Whistling', sw: '#9fd0ff' }, { id: 'peony', name: 'Colour burst', sw: '#ff4b4b' }, { id: 'willow', name: 'Golden willow', sw: '#ffcf6e' }, { id: 'crackle', name: 'Crackling', sw: '#ffe9b0' }, { id: 'ring', name: 'Ring', sw: '#c77dff' }],
    plan(r, v = 'mixed') {
      const fuse = r.range(0.7, 1.1), flight = r.range(1.05, 1.4);
      const type = ['peony', 'willow', 'crackle', 'ring'].includes(v) ? v : r.pick(BURSTS), colour = type === 'willow' || type === 'crackle' ? 'gold' : r.pick(COLOURS);
      return { fuse, launch: fuse, burst: fuse + flight, type, colour, colour2: r() < 0.35 || v === 'peony' ? r.pick(COLOURS) : null,
        whistle: v === 'whistle' || (v === 'mixed' && r() < 0.65), height: r.range(0.55, 0.95), drift: r.range(-0.12, 0.12), size: r.range(0.55, 0.7), end: fuse + flight + 2.4, tail: 1.8 };
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
    id: 'ladi', name: 'Ladi', hi: 'लड़ी', blurb: 'String of crackers: rat-a-tat-tat', kind: 'ladi', feel: 0.9, free: true,
    variants: [{ id: '100', name: '100-wala', sw: '#d9303a' }, { id: '50', name: '50-wala', sw: '#ff7a6b' }, { id: '200', name: '200-wala', sw: '#8e1d26' }],
    plan(r, v = '100') { const n = +v || 100; return ladiPlan(r, n, n > 150 ? 0.028 : 0.034, n > 150 ? 0.08 : 0.11); },
    sound(S, p) { ladiSound(S, p); },
  },
  {
    id: 'bomb', name: 'Sutli Bomb', hi: 'सुतली बम', blurb: 'Twine-wrapped thunder. Cover your ears!', kind: 'bomb', feel: 1.3, free: true,
    variants: [{ id: 'classic', name: 'Classic', sw: '#c48a50' }, { id: 'double', name: 'Double bang', sw: '#ff9a3c' }, { id: 'delay', name: 'Long fuse', sw: '#c49a6c' }],
    plan(r, v = 'classic') {
      const fuse = v === 'delay' ? r.range(5, 6.5) : r.range(2.2, 3), extra = v === 'double' ? [fuse + r.range(0.3, 0.5)] : [];
      return { fuse, bang: fuse, extra, size: r.range(0.95, 1.1), end: fuse + 0.4 + (extra.length ? 0.5 : 0), tail: 3.2, colour: 'jute' };
    },
    sound(S, p) { S.fuse(0.02, p.fuse, 0.16); S.bang(p.bang, p.size); for (const t of p.extra || []) S.bang(t, p.size * 0.9); },
  },
  {
    id: 'phuljhadi', name: 'Phuljhadi', hi: 'फुलझड़ी', blurb: 'Sparkler — hold and draw with light', kind: 'phuljhadi', feel: 0.12, free: true,
    variants: [{ id: 'gold', name: 'Gold', sw: '#ffd27a' }, { id: 'electric', name: 'Electric', sw: '#e6efff' }, { id: 'long', name: 'Long', sw: '#ffb347' }],
    plan(r, v = 'gold') {
      const burn = v === 'long' ? r.range(19, 22) : r.range(11, 13);
      return { fuse: 0.25, burn, end: 0.25 + burn, tail: 0.6, curve: burnCurve(r, burn, { rise: 0.4, fall: 0.8, wobble: 0.1, swell: false }),
        colours: v === 'electric' ? ['#ffffff', '#dbe8ff', '#b8d4ff'] : null };
    },
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
    variants: [{ id: 'single', name: 'Single', sw: '#d9303a' }, { id: 'bunch', name: 'Bunch of 5', sw: '#ffcf4a' }],
    plan(r, v = 'single') {
      const fuse = r.range(1.2, 1.7), extra = [];
      if (v === 'bunch') { let t = fuse; for (let i = 0; i < 4; i++) { t += r.range(0.15, 0.4); extra.push(t); } }
      return { fuse, bang: fuse, extra, size: r.range(0.5, 0.6), end: (extra.at(-1) || fuse) + 0.3, tail: 2.2, colour: 'red', tube: true };
    },
    sound(S, p) { S.fuse(0.02, p.fuse, 0.12); S.bang(p.bang, p.size); for (const t of p.extra || []) S.bang(t, p.size * (0.85 + Math.random() * 0.2)); },
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
    variants: [{ id: 'red', name: 'Red', sw: '#ff3b3b' }, { id: 'green', name: 'Green', sw: '#3bff6a' }, { id: 'pink', name: 'Pink', sw: '#ff4fd8' }, { id: 'blue', name: 'Blue', sw: '#4f8cff' }],
    plan(r, v = 'red') {
      const burn = r.range(9, 11);
      return { fuse: 0.3, burn, end: 0.3 + burn, tail: 0.6, colour: { red: '#ff3b3b', green: '#3bff6a', pink: '#ff4fd8', blue: '#4f8cff' }[v] || '#ff3b3b', pencil: true, curve: burnCurve(r, burn, { rise: 0.3, fall: 0.6, wobble: 0.08, swell: false }) };
    },
    sound(S, p) {
      S.chain(S.noise(0.02, 0.35), S.filt('bandpass', 2400, 0.7), S.env(0.02, 0.25, 0.04, 0.3), S.out);
      S.hiss(p.fuse, p.burn, p.curve, 0.16, S.out, { f: 1800, q: 0.5 });
      S.hiss(p.fuse, p.burn, p.curve, 0.08, S.out, { type: 'highpass', f: 4500 });
      S.crackle(p.fuse, p.burn, 20, 0.08, S.out, { f: 3500, curve: (k) => sample(p.curve, 1, k) });
    },
  },

  // ---- more free crackers (v0.10) -------------------------------------------
  {
    id: 'lakshmi', name: 'Lakshmi Bomb', hi: 'लक्ष्मी बम', blurb: 'Red-and-gold paper bomb with a big boom', kind: 'bomb', feel: 1.2, free: true,
    variants: [{ id: 'classic', name: 'Classic', sw: '#c8323c' }, { id: 'double', name: 'Double bang', sw: '#ffcf4a' }],
    plan(r, v = 'classic') { return bombPlan(r, { size: [0.9, 1.0], double: v === 'double', shape: 'box', body: '#c8323c', band: '#ffcf4a', paper: '#c8323c' }); },
    sound(S, p) { bombSound(S, p); },
  },
  {
    id: 'aloo', name: 'Aloo Bomb', hi: 'आलू बम', blurb: 'Round little paper ball, round little thud', kind: 'bomb', feel: 0.9, free: true,
    variants: [{ id: 'single', name: 'Single', sw: '#9a7448' }, { id: 'three', name: 'Bunch of 3', sw: '#c49a6c' }],
    plan(r, v = 'single') { return bombPlan(r, { size: [0.65, 0.75], bunch: v === 'three' ? 2 : 0, shape: 'round', body: '#9a7448', band: '#5a3a22', paper: '#c49a6c' }); },
    sound(S, p) { bombSound(S, p); },
  },
  {
    id: 'chocolate', name: 'Chocolate Bomb', hi: 'चॉकलेट बम', blurb: 'Small brown bomb that cracks sharp', kind: 'bomb', feel: 0.8, free: true,
    variants: [{ id: 'single', name: 'Single', sw: '#5a3020' }, { id: 'five', name: 'Bunch of 5', sw: '#8a5a2b' }],
    plan(r, v = 'single') { return bombPlan(r, { size: [0.55, 0.65], bunch: v === 'five' ? 4 : 0, shape: 'round', body: '#5a3020', band: '#ffcf4a', paper: '#8a5a2b', small: true }); },
    sound(S, p) { bombSound(S, p); },
  },
  {
    id: 'bullet', name: 'Bullet Bomb', hi: 'बुलेट बम', blurb: 'Long blue tube, short fuse, sharp crack', kind: 'bomb', feel: 1.0, free: true,
    variants: [{ id: 'single', name: 'Single', sw: '#2f6fb0' }, { id: 'double', name: 'Double', sw: '#5aa9ff' }],
    plan(r, v = 'single') { return bombPlan(r, { size: [0.75, 0.85], fuse: [1.0, 1.4], double: v === 'double', shape: 'tube', body: '#2f6fb0', band: '#ffffff', paper: '#2f6fb0' }); },
    sound(S, p) { bombSound(S, p); },
  },
  {
    id: 'poppop', name: 'Pop-Pop', hi: 'पॉप-पॉप', blurb: 'Tiny paper twists that snap: safe fun for little ones', kind: 'bomb', feel: 0.2, free: true,
    variants: [{ id: 'six', name: 'Handful', sw: '#f5e6c8' }, { id: 'twelve', name: 'Big handful', sw: '#ffffff' }],
    plan(r, v = 'six') { return bombPlan(r, { size: [0.2, 0.26], fuse: [0.3, 0.4], bunch: v === 'twelve' ? 11 : 5, gap: [0.08, 0.25], shape: 'pop', body: '#f5e6c8', band: '#ff5ec4', paper: '#f5e6c8', small: true }); },
    sound(S, p) { S.bang(p.bang, p.size); for (const t of p.extra) S.bang(t, p.size * (0.8 + Math.random() * 0.4)); },
  },
  {
    id: 'kothi', name: 'Kothi Anar', hi: 'कोठी', blurb: 'Clay-pot fountain: taller and longer than a paper anar', kind: 'anar', feel: 0.5, free: true,
    variants: [{ id: 'gold', name: 'Gold', sw: '#ffcf6e' }, { id: 'silver', name: 'Silver', sw: '#e6efff' }],
    plan(r, v = 'gold') { return { ...anarPlan(r, true), clay: true, bodyCols: ['#b4552a', '#e8c48a', '#6a2a14'], colours: v === 'silver' ? ['#ffffff', '#e6efff', '#cfe0ff'] : null }; },
    sound(S, p) { anarSound(S, p); },
  },
  {
    id: 'tiranga', name: 'Tiranga Anar', hi: 'तिरंगा अनार', blurb: 'Saffron, white and green fountain', kind: 'anar', feel: 0.45, free: true,
    plan(r) { return { ...anarPlan(r), colours: ['#ff9933', '#ffffff', '#3fd16b'], bodyCols: ['#ff9933', '#ffffff', '#138808'] }; },
    sound(S, p) { anarSound(S, p); },
  },
  {
    id: 'bhoochakri', name: 'Zameen Chakkar', hi: 'ज़मीन चक्कर', blurb: 'Big ground wheel that spins longer and louder', kind: 'chakri', feel: 0.55, free: true,
    variants: [{ id: 'gold', name: 'Gold', sw: '#ffd27a' }, { id: 'multi', name: 'Multicolour', sw: '#ff5ec4' }],
    plan(r, v = 'gold') { return chakriPlan(r, { burn: [8.5, 10.5], big: true, colours: v === 'multi' ? ['#ff4b4b', '#53ff8f', '#5aa9ff', '#ffd27a', '#ff5ec4'] : null }); },
    sound(S, p) { chakriSound(S, p, 1.15); },
  },
  {
    id: 'star', name: 'Twinkling Star', hi: 'टिमटिमाता तारा', blurb: 'Handheld star that twinkles in colours', kind: 'phuljhadi', feel: 0.12, free: true,
    variants: [{ id: 'multi', name: 'Multicolour', sw: '#ff5ec4' }, { id: 'silver', name: 'Silver', sw: '#e6efff' }],
    plan(r, v = 'multi') {
      const burn = r.range(9, 11);
      return { fuse: 0.25, burn, end: 0.25 + burn, tail: 0.6, twinkle: true, curve: burnCurve(r, burn, { rise: 0.4, fall: 0.8, wobble: 0.2, swell: false }),
        colours: v === 'silver' ? ['#ffffff', '#e6efff', '#cfd8ff'] : ['#ff4b4b', '#53ff8f', '#5aa9ff', '#ffd27a', '#ff5ec4'] };
    },
    sound(S, p) {
      S.chain(S.noise(0.02, 0.4), S.filt('bandpass', 3000, 0.7), S.env(0.02, 0.25, 0.05, 0.3), S.out);
      S.crackle(p.fuse, p.burn, 60, 0.2, S.out, { f: 5000, curve: (k) => sample(p.curve, 1, k) });
      S.hiss(p.fuse, p.burn, p.curve, 0.05, S.out, { type: 'highpass', f: 5000 });
    },
  },
  {
    id: 'matches', name: 'Colour Matches', hi: 'रंगीन माचिस', blurb: 'Tiny matchsticks that burn in colour', kind: 'phuljhadi', feel: 0.08, free: true,
    variants: [{ id: 'red', name: 'Red', sw: '#ff3b3b' }, { id: 'green', name: 'Green', sw: '#3bff6a' }, { id: 'violet', name: 'Violet', sw: '#c77dff' }],
    plan(r, v = 'red') {
      const burn = r.range(4, 5);
      return { fuse: 0.15, burn, end: 0.15 + burn, tail: 0.4, pencil: true, small: true, colour: { red: '#ff3b3b', green: '#3bff6a', violet: '#c77dff' }[v] || '#ff3b3b', curve: burnCurve(r, burn, { rise: 0.15, fall: 0.5, wobble: 0.1, swell: false }) };
    },
    sound(S, p) {
      S.chain(S.noise(0.02, 0.3), S.filt('bandpass', 3200, 0.8), S.env(0.02, 0.2, 0.02, 0.2), S.out);
      S.hiss(p.fuse, p.burn, p.curve, 0.1, S.out, { f: 2200, q: 0.6 });
    },
  },
  {
    id: 'babyrocket', name: 'Baby Rocket', hi: 'बेबी रॉकेट', blurb: 'Small rocket with a small, bright pop', kind: 'rocket', feel: 0.5, free: true,
    variants: [{ id: 'colour', name: 'Colour', sw: '#53ff8f' }, { id: 'whistle', name: 'Whistling', sw: '#9fd0ff' }],
    plan(r, v = 'colour') { return rocketPlan(r, { small: true, whistle: v === 'whistle', size: [0.4, 0.5], type: r.pick(['peony', 'peony', 'ring']) }); },
    sound(S, p) { rocketSound(S, p); },
  },
  {
    id: 'thunder', name: 'Thunder Rocket', hi: 'थंडर रॉकेट', blurb: 'Climbs fast and bursts with a thunderclap', kind: 'rocket', feel: 1.0, free: true,
    plan(r) { return rocketPlan(r, { type: 'thunder', size: [0.95, 1.05], whistle: false }); },
    sound(S, p) { rocketSound(S, p); },
  },
  {
    id: 'goldrain', name: 'Golden Rain', hi: 'सुनहरी बारिश', blurb: 'Rocket that hangs a slow shower of gold', kind: 'rocket', feel: 0.7, free: true,
    variants: [{ id: 'gold', name: 'Gold', sw: '#ffcf6e' }, { id: 'silver', name: 'Silver', sw: '#e6efff' }],
    plan(r, v = 'gold') { return { ...rocketPlan(r, { type: 'willow', size: [0.7, 0.8], whistle: r() < 0.5 }), colour: v === 'silver' ? 'silver' : 'gold', tail: 3.2 }; },
    sound(S, p) { rocketSound(S, p); },
  },
  {
    id: 'chatpati', name: 'Chatpati', hi: 'चटपटी', blurb: 'Short crackling string: quick and snappy', kind: 'ladi', feel: 0.6, free: true,
    variants: [{ id: '28', name: '28-wala', sw: '#ff7a6b' }, { id: '56', name: '56-wala', sw: '#d9303a' }],
    plan(r, v = '28') { return ladiPlan(r, +v || 28, 0.04, 0.09); },
    sound(S, p) { ladiSound(S, p); },
  },
  {
    id: 'roman', name: 'Roman Candle', hi: 'रोमन कैंडल', blurb: 'Tube that pops coloured balls into the sky', kind: 'skyshot', feel: 0.4, free: true,
    variants: [{ id: '8', name: '8-ball', sw: '#53ff8f' }, { id: '12', name: '12-ball', sw: '#ff5ec4' }],
    plan(r, v = '8') { return skyPlan(r, +v || 8, { star: true, tube: true, gap: [0.6, 0.9] }); },
    sound(S, p) { skySound(S, p); },
  },
  {
    id: 'fancy', name: 'Fancy Shell', hi: 'फैंसी', blurb: 'One big shell fired from a tube', kind: 'skyshot', feel: 1.0, free: true,
    variants: [{ id: 'peony', name: 'Colour', sw: '#ff4b4b' }, { id: 'willow', name: 'Willow', sw: '#ffcf6e' }, { id: 'ring', name: 'Ring', sw: '#c77dff' }, { id: 'crackle', name: 'Crackling', sw: '#ffe9b0' }],
    plan(r, v = 'peony') { return skyPlan(r, 1, { tube: true, big: true, types: [v] }); },
    sound(S, p) { skySound(S, p); },
  },
  {
    id: 'chhota', name: 'Chhota Cake', hi: 'छोटा केक', blurb: 'Mini 4-shot cake', kind: 'skyshot', feel: 0.7, free: true,
    plan(r) { return skyPlan(r, 4, {}); },
    sound(S, p) { skySound(S, p); },
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
    variants: [{ id: '12', name: '12-shot', sw: '#7b46b3' }, { id: '25', name: '25-shot', sw: '#ff5ec4' }, { id: 'gold', name: 'Golden', sw: '#ffcf6e' }],
    plan(r, v = '12') {
      const fuse = r.range(1.1, 1.5), shots = [], n = v === '25' ? 25 : 12;
      let t = fuse;
      for (let i = 0; i < n; i++) {
        const type = i === n - 1 ? 'crackle' : v === 'gold' ? r.pick(['willow', 'crackle', 'willow']) : r.pick(BURSTS), flight = r.range(0.75, 0.95);
        shots.push({ launch: t, burst: t + flight, type, colour: type === 'willow' || type === 'crackle' || v === 'gold' ? 'gold' : COLOURS[i % COLOURS.length],
          height: r.range(0.5, 0.9), drift: r.range(-0.18, 0.18), size: r.range(0.45, 0.6) });
        t += i > n - 4 ? r.range(0.25, 0.35) : r.range(0.45, 0.7);
      }
      return { fuse, shots, end: shots[n - 1].burst + 2.4, tail: 2 };
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
  {
    id: 'hydrogen', name: 'Hydrogen Bomb', hi: 'हाइड्रोजन बम', blurb: 'Even bigger than the atom bomb', kind: 'bomb', feel: 1.5, free: false,
    plan(r) { return bombPlan(r, { size: [1.5, 1.6], fuse: [3.5, 4.2], shape: 'big', body: '#2f6fb0', band: '#ffffff', paper: '#5aa9ff', big: true }); },
    sound(S, p) { S.fuse(0.02, p.fuse, 0.18); S.bang(p.bang, p.size); S.bang(p.bang + 0.015, p.size * 0.75, S.at(-0.2), { dark: 0.4 }); },
  },
  {
    id: 'mayur', name: 'Mayur Anar', hi: 'मयूर अनार', blurb: 'Peacock fountain in blue, green and gold', kind: 'anar', feel: 0.5, free: false,
    plan(r) { return { ...anarPlan(r, true), colours: ['#1fb5c9', '#3fd16b', '#ffd27a', '#2f6fb0'], bodyCols: ['#1a6aa0', '#3fd16b', '#0e3a5a'] }; },
    sound(S, p) { anarSound(S, p); },
  },
  {
    id: 'dohazaar', name: '2000-wala', hi: 'दो हज़ार वाली', blurb: 'Two thousand crackers on one fuse', kind: 'ladi', feel: 0.95, free: false,
    plan(r) { return ladiPlan(r, 2000, 0.012, 0.035); },
    sound(S, p) { ladiSound(S, p); },
  },
  {
    id: 'grand', name: 'Grand Finale', hi: 'ग्रैंड फिनाले', blurb: '60-shot cake that ends the night', kind: 'skyshot', feel: 0.9, free: false,
    plan(r) { return skyPlan(r, 60, { gap: [0.18, 0.35] }); },
    sound(S, p) { skySound(S, p); },
  },
  {
    id: 'udan', name: 'Udan Tashtari', hi: 'उड़न तश्तरी', blurb: 'Flying saucer: spins, then lifts into the air', kind: 'chakri', feel: 0.5, free: false,
    variants: [{ id: 'gold', name: 'Gold', sw: '#ffd27a' }, { id: 'colour', name: 'Colour', sw: '#53ff8f' }],
    plan(r, v = 'gold') { return { ...chakriPlan(r, { burn: [5, 6], colours: v === 'colour' ? ['#53ff8f', '#5aa9ff', '#ff5ec4'] : null }), fly: r.range(4, 7) }; },
    sound(S, p) { chakriSound(S, p, 0.9); S.whistle(p.fuse + 0.5, p.burn - 1, 1800, 2600, 0.07); },
  },
];

// Distant fireworks from the neighbourhood (ambient), quiet and muffled.
export const DISTANT = {
  id: 'distant', kind: 'distant', feel: 0,
  plan(r) { const type = r.pick(BURSTS); return { type, size: r.range(0.45, 0.6), end: 0.2, tail: 2.4, delay: r.range(0.35, 1.1) }; },
  sound(S, p) { aerial(S, 0.05, p, { far: true }); },
};

// ------------------------------------------------------------------ shared recipes
function bombPlan(r, { size = [0.95, 1.1], fuse = [2.2, 3], double = false, bunch = 0, gap = [0.15, 0.4], shape = 'round', body, band, paper, big = false, small = false } = {}) {
  const f = r.range(...fuse), extra = [];
  if (double) extra.push(f + r.range(0.3, 0.5));
  let t = f; for (let i = 0; i < bunch; i++) { t += r.range(...gap); extra.push(t); }
  return { fuse: f, bang: f, extra, size: r.range(...size), end: (extra.at(-1) || f) + 0.4, tail: big ? 3.8 : small ? 2 : 3, shape, body, band, paper, big, small };
}
function bombSound(S, p) { S.fuse(0.02, p.fuse, 0.15); S.bang(p.bang, p.size); for (const t of p.extra || []) S.bang(t, p.size * (0.85 + Math.random() * 0.2)); }
function chakriPlan(r, { burn = [5.5, 7], big = false, colours = null, whistle = false } = {}) {
  const fuse = r.range(0.8, 1.2), b = r.range(...burn);
  return { fuse, burn: b, end: fuse + b, curve: burnCurve(r, b, { rise: 0.9, fall: 1.1, wobble: 0.12 }), rps: r.range(7, 10) * (big ? 0.8 : 1), tail: 1.6, colours, whistle, big };
}
function chakriSound(S, p, gain = 1) {
  S.fuse(0.02, p.fuse, 0.13);
  const t = p.fuse, n = Math.round(p.burn * 200), am = [];
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const k = sample(p.curve, p.burn, (i / n) * p.burn);
    ph += (p.rps * Math.min(1, k * 1.3) * 2 * Math.PI) / 200;
    am.push(k * (0.62 + 0.38 * Math.sin(ph * 2)));
  }
  S.hiss(t, p.burn, am, 0.42 * gain, S.out, { f: p.big ? 2600 : 3400, q: 0.7 });
  S.hiss(t, p.burn, p.curve, 0.2 * gain, S.out, { type: 'lowpass', f: 700, q: 0.5, rate: 0.8 });
  S.crackle(t, p.burn, 26, 0.18 * gain, S.out, { f: 4500, curve: (k) => sample(p.curve, 1, k) });
}
function rocketPlan(r, { small = false, whistle = r() < 0.6, size = [0.55, 0.7], type = r.pick(BURSTS) } = {}) {
  const fuse = r.range(0.7, 1.1), flight = small ? r.range(0.7, 0.9) : r.range(1.05, 1.4);
  const colour = type === 'willow' || type === 'crackle' ? 'gold' : type === 'thunder' ? 'silver' : r.pick(COLOURS);
  return { fuse, launch: fuse, burst: fuse + flight, type, colour, colour2: null, whistle, small, height: small ? r.range(0.2, 0.35) : r.range(0.55, 0.95), drift: r.range(-0.12, 0.12), size: r.range(...size), end: fuse + flight + 2.4, tail: 1.8 };
}
function rocketSound(S, p) {
  S.fuse(0.02, p.fuse, 0.12);
  S.chain(S.noise(p.launch, 0.25), S.filt('bandpass', 1500, 0.8), S.env(p.launch, 0.45, 0.002, 0.2), S.out);
  const fl = p.burst - p.launch;
  S.whoosh(p.launch, fl, p.small ? 0.2 : 0.3);
  if (p.whistle) S.whistle(p.launch + 0.05, fl - 0.08, 1500, 3000, 0.16); else S.crackle(p.launch, fl, 70, 0.14, S.out, { f: 4000 });
  aerial(S, p.burst, p);
}
function skyPlan(r, n, { star = false, tube = false, big = false, types = null, gap = [0.45, 0.7] } = {}) {
  const fuse = r.range(1.1, 1.5), shots = [];
  let t = fuse;
  for (let i = 0; i < n; i++) {
    const type = star ? 'star' : types ? r.pick(types) : i === n - 1 && n > 3 ? 'crackle' : r.pick(BURSTS), flight = star ? r.range(0.9, 1.2) : r.range(0.75, 0.95) * (big ? 1.3 : 1);
    shots.push({ launch: t, burst: t + flight, type, colour: type === 'willow' || type === 'crackle' ? 'gold' : COLOURS[(i + Math.floor(r() * 6)) % COLOURS.length],
      height: big ? r.range(0.9, 1) : r.range(0.5, 0.9), drift: r.range(-0.18, 0.18), size: big ? r.range(0.85, 0.95) : r.range(0.45, 0.6) });
    t += i > n - 4 && n > 6 ? r.range(0.12, 0.25) : r.range(...gap);
  }
  return { fuse, shots, tube, big, end: shots[n - 1].burst + (star ? 0.8 : 2.4), tail: 2 };
}
function skySound(S, p) {
  S.fuse(0.02, p.fuse, 0.13);
  p.shots.forEach((s, i) => {
    const pan = ((i % 3) - 1) * 0.15;
    S.thump(s.launch, s.type === 'star' ? 0.35 : p.big ? 0.8 : 0.55);
    S.crackle(s.launch, s.burst - s.launch, s.type === 'star' ? 20 : 50, 0.08, S.at(pan), { f: 4000 });
    if (s.type !== 'star') aerial(S, s.burst, s);
  });
}

function anarPlan(r, giant = false) {
  const fuse = r.range(1, 1.5), burn = giant ? r.range(10, 12) : r.range(6.5, 8.5);
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
  lakshmi: '<rect x="10" y="16" width="26" height="26" rx="3" fill="#c8323c"/><rect x="10" y="26" width="26" height="6" fill="#ffcf4a"/><circle cx="23" cy="22" r="3" fill="#ffcf4a"/><path d="M30 16 q5 -6 9 -8" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="41" cy="8" r="3" fill="#ffd27a"/>',
  aloo: '<circle cx="23" cy="28" r="14" fill="#9a7448"/><path d="M9 28 h28" stroke="#5a3a22" stroke-width="3"/><path d="M32 17 q5 -6 9 -8" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="41" cy="8" r="3" fill="#ffd27a"/>',
  chocolate: '<circle cx="18" cy="30" r="10" fill="#5a3020"/><circle cx="30" cy="30" r="10" fill="#6a3a24"/><path d="M8 30 h32" stroke="#ffcf4a" stroke-width="2"/><path d="M32 17 q5 -6 9 -8" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="41" cy="8" r="3" fill="#ffd27a"/>',
  bullet: '<rect x="8" y="22" width="32" height="10" rx="5" fill="#2f6fb0"/><rect x="20" y="22" width="5" height="10" fill="#fff"/><path d="M40 27 q4 -6 6 -12" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="46" cy="14" r="2.6" fill="#ffd27a"/>',
  poppop: '<g fill="#f5e6c8" stroke="#07120d" stroke-width="1"><path d="M10 30 q4 -10 8 0 l-2 4 h-4z"/><path d="M22 26 q4 -10 8 0 l-2 4 h-4z"/><path d="M33 31 q4 -10 8 0 l-2 4 h-4z"/></g><g stroke="#ff5ec4" stroke-width="1.6" stroke-linecap="round"><path d="M14 22 v-4"/><path d="M26 18 v-4"/><path d="M37 23 v-4"/></g>',
  kothi: '<ellipse cx="24" cy="34" rx="13" ry="10" fill="#b4552a"/><path d="M18 26 h12 l-2 -6 h-8 z" fill="#8a3a1a"/><path d="M11 34 h26" stroke="#e8c48a" stroke-width="2"/><g stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"><path d="M24 18 V6"/><path d="M22 18 L15 8"/><path d="M26 18 L33 8"/></g>',
  tiranga: '<path d="M16 42 L24 12 L32 42 Z" fill="#ff9933"/><path d="M19.5 29 H28.5 L29.6 33 H18.4 Z" fill="#ffffff"/><path d="M14 42 H34 V45 H14 Z" fill="#138808"/><g stroke-width="1.8" stroke-linecap="round"><path d="M24 10 V3" stroke="#ff9933"/><path d="M22 10 L17 4" stroke="#ffffff"/><path d="M26 10 L31 4" stroke="#3fd16b"/></g>',
  mayur: '<path d="M16 42 L24 12 L32 42 Z" fill="#1a6aa0"/><path d="M19.5 29 H28.5 L29.6 33 H18.4 Z" fill="#3fd16b"/><path d="M14 42 H34 V45 H14 Z" fill="#0e3a5a"/><g stroke-width="1.8" stroke-linecap="round"><path d="M24 10 V3" stroke="#1fb5c9"/><path d="M22 10 L17 4" stroke="#3fd16b"/><path d="M26 10 L31 4" stroke="#ffd27a"/></g>',
  bhoochakri: '<circle cx="24" cy="26" r="15" fill="#c8323c"/><path d="M24 26 m-11 0 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0" fill="none" stroke="#ffcf4a" stroke-width="2.6" stroke-dasharray="5 3"/><circle cx="24" cy="26" r="4" fill="#c8323c"/><g stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"><path d="M39 26 l6 -3"/><path d="M9 26 l-6 3"/></g>',
  udan: '<ellipse cx="24" cy="28" rx="17" ry="7" fill="#5aa9ff"/><ellipse cx="24" cy="24" rx="8" ry="6" fill="#9fd0ff"/><g stroke="#ffd27a" stroke-width="1.6" stroke-linecap="round"><path d="M10 34 l-4 6"/><path d="M24 36 v7"/><path d="M38 34 l4 6"/></g>',
  star: '<path d="M10 44 L30 18" stroke="#6b6f78" stroke-width="2.4" stroke-linecap="round"/><path d="M33 4 l3 8 8 1 -6 5 2 8 -7 -4 -7 4 2 -8 -6 -5 8 -1z" fill="#ff5ec4"/><circle cx="33" cy="15" r="2.6" fill="#fff"/>',
  matches: '<g stroke-linecap="round"><path d="M12 42 L22 12" stroke="#e8e0d0" stroke-width="2.6"/><path d="M22 42 L28 12" stroke="#e8e0d0" stroke-width="2.6"/><path d="M32 42 L34 12" stroke="#e8e0d0" stroke-width="2.6"/></g><circle cx="22" cy="11" r="3.4" fill="#ff3b3b"/><circle cx="28" cy="11" r="3.4" fill="#3bff6a"/><circle cx="34" cy="11" r="3.4" fill="#c77dff"/>',
  babyrocket: '<path d="M24 12 L27 18 V28 H21 V18 Z" fill="#53ff8f"/><path d="M24 12 L27 18 H21 Z" fill="#ffcf4a"/><path d="M24 26 V44" stroke="#c49a6c" stroke-width="1.6"/><g stroke="#53ff8f" stroke-width="1.6" stroke-linecap="round"><path d="M36 10 l6 -4"/><path d="M37 15 h7"/><path d="M36 20 l6 4"/></g>',
  thunder: '<path d="M24 4 L28 12 V26 H20 V12 Z" fill="#2b2d33"/><path d="M24 4 L28 12 H20 Z" fill="#ffffff"/><path d="M24 26 V44" stroke="#c49a6c" stroke-width="1.6"/><g stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"><path d="M36 10 l6 -4"/><path d="M37 15 h7"/><path d="M36 20 l6 4"/></g><path d="M8 30 l6 -6 -2 5 5 -1 -6 7 2 -5z" fill="#ffd23f"/>',
  goldrain: '<path d="M24 4 L28 12 V26 H20 V12 Z" fill="#c49a20"/><path d="M24 4 L28 12 H20 Z" fill="#ffe58a"/><path d="M24 26 V44" stroke="#c49a6c" stroke-width="1.6"/><g stroke="#ffcf6e" stroke-width="1.6" stroke-linecap="round"><path d="M36 10 l6 -4"/><path d="M37 15 h7"/><path d="M36 20 l6 4"/></g><g fill="#ffcf6e"><circle cx="38" cy="30" r="1.6"/><circle cx="42" cy="36" r="1.6"/><circle cx="36" cy="40" r="1.6"/></g>',
  chatpati: '<g fill="#ff7a6b" stroke="#7a1a20" stroke-width=".6"><rect x="8" y="18" width="5" height="9" rx="1" transform="rotate(-35 10 22)"/><rect x="18" y="22" width="5" height="9" rx="1" transform="rotate(35 20 26)"/><rect x="28" y="26" width="5" height="9" rx="1" transform="rotate(-35 30 30)"/></g><path d="M6 16 L40 38" stroke="#c49a6c" stroke-width="1.4"/><g stroke="#ffd27a" stroke-width="1.4"><path d="M38 12 l4 -4"/><path d="M42 18 h5"/></g>',
  dohazaar: '<g fill="#b8242c"><rect x="5" y="6" width="3" height="7" rx="1"/><rect x="11" y="10" width="3" height="7" rx="1"/><rect x="17" y="14" width="3" height="7" rx="1"/><rect x="23" y="18" width="3" height="7" rx="1"/><rect x="29" y="22" width="3" height="7" rx="1"/><rect x="35" y="26" width="3" height="7" rx="1"/><rect x="41" y="30" width="3" height="7" rx="1"/></g><text x="24" y="46" text-anchor="middle" font-size="9" font-family="Share Tech Mono, monospace" fill="#ffd27a">2000</text>',
  roman: '<rect x="20" y="16" width="8" height="30" fill="#c8323c"/><rect x="20" y="24" width="8" height="3" fill="#ffcf4a"/><rect x="20" y="34" width="8" height="3" fill="#ffcf4a"/><circle cx="24" cy="10" r="3.4" fill="#53ff8f"/><circle cx="30" cy="4" r="2.6" fill="#ff5ec4"/>',
  fancy: '<rect x="17" y="24" width="14" height="22" fill="#2f6fb0"/><rect x="15" y="22" width="18" height="4" fill="#ffcf4a"/><g stroke="#ff4b4b" stroke-width="1.8" stroke-linecap="round"><path d="M24 12 V4"/><path d="M24 12 L17 6"/><path d="M24 12 L31 6"/><path d="M24 12 L15 13"/><path d="M24 12 L33 13"/></g><circle cx="24" cy="12" r="2.4" fill="#fff"/>',
  chhota: '<rect x="9" y="22" width="30" height="22" fill="#ff5ec4"/><path d="M9 22 h30 l-4 -4 h-22 Z" fill="#ff5ec4" opacity=".75"/><circle cx="14.0" cy="21" r="2" fill="#1b1030"/><circle cx="20.666666666666668" cy="21" r="2" fill="#1b1030"/><circle cx="27.333333333333336" cy="21" r="2" fill="#1b1030"/><circle cx="34.0" cy="21" r="2" fill="#1b1030"/><path d="M9 32 h30" stroke="#ffcf4a" stroke-width="2"/><g stroke-linecap="round" stroke-width="1.6"><path d="M18 17 L14 5" stroke="#53ff8f"/><path d="M30 17 L34 5" stroke="#ff4b4b"/></g>',
  grand: '<rect x="9" y="22" width="30" height="22" fill="#c8323c"/><path d="M9 22 h30 l-4 -4 h-22 Z" fill="#c8323c" opacity=".75"/><circle cx="14.0" cy="21" r="2" fill="#1b1030"/><circle cx="18.0" cy="21" r="2" fill="#1b1030"/><circle cx="22.0" cy="21" r="2" fill="#1b1030"/><circle cx="26.0" cy="21" r="2" fill="#1b1030"/><circle cx="30.0" cy="21" r="2" fill="#1b1030"/><circle cx="34.0" cy="21" r="2" fill="#1b1030"/><path d="M9 32 h30" stroke="#ffcf4a" stroke-width="2"/><g stroke-linecap="round" stroke-width="1.6"><path d="M18 17 L14 5" stroke="#53ff8f"/><path d="M30 17 L34 5" stroke="#ff4b4b"/></g><text x="24" y="42" text-anchor="middle" font-size="8" font-family="Share Tech Mono, monospace" fill="#fff">60</text>',
  hydrogen: '<circle cx="23" cy="28" r="16" fill="#2f6fb0"/><circle cx="23" cy="28" r="9" fill="none" stroke="#fff" stroke-width="2"/><text x="23" y="32" text-anchor="middle" font-size="11" font-weight="700" font-family="Chakra Petch, sans-serif" fill="#fff">H</text><path d="M32 17 q5 -6 9 -8" stroke="#c49a6c" stroke-width="2" fill="none"/><circle cx="41" cy="8" r="3" fill="#ffd27a"/>',
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
  lakshmi: { cat: 'loud', eco: { co2: 60, smoke: 45, db: 125 },
    how: 'Flash powder packed tight in a paper-wrapped block. The tight wrapping makes the bang sharp and loud.',
    safety: "A classic loud bomb: light it at arm's length and walk away. Never relight a dud." },
  aloo: { cat: 'loud', eco: { co2: 30, smoke: 25, db: 115 },
    how: 'A round ball of paper and clay around a little flash powder. It bursts with a deep thud.',
    safety: 'Small, but still a bomb. Light it on the ground only.' },
  chocolate: { cat: 'loud', eco: { co2: 20, smoke: 18, db: 112 },
    how: 'A small brown paper bomb with flash powder inside, often sold in strings or bunches.',
    safety: 'Keep the whole bunch away from your hands and face.' },
  bullet: { cat: 'loud', eco: { co2: 25, smoke: 20, db: 118 },
    how: 'A tight paper tube of flash powder with a short fuse, so it goes off quickly.',
    safety: 'The short fuse gives you less time: step back at once.' },
  poppop: { cat: 'ground', eco: { co2: 1, smoke: 1, db: 70 },
    how: 'A pinch of sand and a tiny amount of silver fulminate twisted in paper. It snaps when thrown down; there is no fuse.',
    safety: 'Even snappers can hurt eyes. Never throw them at people or animals.' },
  kothi: { cat: 'ground', eco: { co2: 90, smoke: 45, db: 85 },
    how: 'An anar packed in a clay pot (kothi). The thick pot lets it burn longer and throw sparks higher.',
    safety: 'The clay can crack: stand it on flat ground and step well back.' },
  tiranga: { cat: 'ground', eco: { co2: 60, smoke: 34, db: 85 },
    how: 'An anar in three colour layers: sodium and calcium salts for saffron, magnesium for white, and barium salts for green.',
    safety: "Treat it like any anar: flat ground, arm's length, then step back." },
  mayur: { cat: 'ground', eco: { co2: 80, smoke: 45, db: 85 },
    how: "A big anar with copper and barium salts that colour the sparks blue and green, like a peacock's tail.",
    safety: 'Big fountains throw sparks far: keep a wide circle clear.' },
  bhoochakri: { cat: 'ground', eco: { co2: 40, smoke: 80, db: 92 },
    how: 'A larger ground wheel with more powder, so it spins longer and with a deeper whoosh.',
    safety: 'It can skid a long way: light it on hard, open ground away from feet.' },
  udan: { cat: 'ground', eco: { co2: 35, smoke: 70, db: 95 },
    how: 'A spinner with angled vents: once it spins fast enough, the thrust lifts it off the ground like a flying saucer.',
    safety: 'It flies where it likes. Use it only in a wide, open space.' },
  star: { cat: 'hand', eco: { co2: 8, smoke: 74, db: 50 },
    how: 'A sparkler coated with metal salts so the sparks twinkle in different colours.',
    safety: "Hold it at arm's length and drop used wires into water." },
  matches: { cat: 'hand', eco: { co2: 2, smoke: 10, db: 40 },
    how: 'Matchsticks with a coloured head: strontium burns red, barium green and potassium violet.',
    safety: 'Strike away from you, and never let children hold them near clothes.' },
  babyrocket: { cat: 'sky', eco: { co2: 10, smoke: 15, db: 100 },
    how: 'A small rocket with a little star charge on top. It goes up only a short way.',
    safety: 'Launch it only from a bottle, pointing straight up, in the open.' },
  thunder: { cat: 'sky', eco: { co2: 25, smoke: 30, db: 120 },
    how: 'A rocket that carries a flash-powder charge instead of stars, so it bursts with a loud bang.',
    safety: 'Very loud overhead. Keep it far from homes, hospitals and animals.' },
  goldrain: { cat: 'sky', eco: { co2: 25, smoke: 30, db: 105 },
    how: 'A rocket with charcoal-rich stars that burn slowly, so the gold sparks hang and fall like rain.',
    safety: 'Burning bits can drift down: launch it away from roofs and dry leaves.' },
  chatpati: { cat: 'strings', eco: { co2: 18, smoke: 10, db: 115 },
    how: 'A short ladi of small crackers. It finishes in a few seconds.',
    safety: 'Lay it flat on the ground and step back; it jumps as it pops.' },
  dohazaar: { cat: 'strings', eco: { co2: 1200, smoke: 550, db: 125 },
    how: 'Two thousand small crackers braided on one fuse, firing for about a minute.',
    safety: 'One of the smokiest things you can light. Never light it near people or vehicles.' },
  roman: { cat: 'sky', eco: { co2: 40, smoke: 40, db: 95 },
    how: 'A tube packed with stacked coloured stars and lift charges, so it pops balls of colour one after another.',
    safety: 'Never hold it in your hand. Push it into the ground, pointing straight up.' },
  fancy: { cat: 'sky', eco: { co2: 60, smoke: 40, db: 115 },
    how: 'A single aerial shell fired from a tube. It bursts high with one big flower.',
    safety: 'Set the tube on firm ground and never look into it.' },
  chhota: { cat: 'sky', eco: { co2: 60, smoke: 40, db: 105 },
    how: 'A small cake of four tubes linked by one fuse.',
    safety: 'Set it on level ground before lighting.' },
  grand: { cat: 'sky', eco: { co2: 900, smoke: 500, db: 120 },
    how: 'Sixty tubes linked by one fuse for a long finale.',
    safety: 'A cake this big must be on firm, level ground with plenty of space around it.' },
  hydrogen: { cat: 'loud', eco: { co2: 100, smoke: 70, db: 130 },
    how: "A very large flash-powder bomb. Often above India's noise limit.",
    safety: 'Never light it near homes, hospitals, animals or people. It can damage hearing.' },
};
