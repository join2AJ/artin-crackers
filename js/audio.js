// Realtime playback of pre-rendered cracker sounds, plus the variant cache.

import { render, rng } from './synth.js';

const MAX_VARIANTS = { hazaar: 1, skyshot: 2 };

export const Audio = {
  ctx: null, master: null, volume: 0.9,
  cache: new Map(), // id -> [{ plan, buffer, envelope }]
  rendering: new Map(), // id -> Promise

  /** Must run inside a user gesture the first time (autoplay rules). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -6; comp.knee.value = 4; comp.ratio.value = 6; comp.attack.value = 0.001; comp.release.value = 0.2;
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      this.master.connect(comp); comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; },
  /** Milliseconds between "start now" and the sound reaching the speaker. */
  latencyMs() { const c = this.ctx; return c ? ((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000 : 0; },

  async variant(def, { fresh = false } = {}) {
    const list = this.cache.get(def.id) || [];
    const max = MAX_VARIANTS[def.id] ?? 3;
    if (list.length && (!fresh || list.length >= max)) return list[Math.floor(Math.random() * list.length)];
    return this.renderOne(def);
  },
  renderOne(def) {
    if (this.rendering.has(def.id)) return this.rendering.get(def.id);
    const p = (async () => {
      const plan = def.plan(rng((Math.random() * 2 ** 32) >>> 0));
      const out = await render((S) => def.sound(S, plan), plan.end + plan.tail, { wet: def.kind === 'distant' ? 0.6 : 0.32 });
      const v = { plan, buffer: out.buffer, envelope: out.envelope };
      const list = this.cache.get(def.id) || [];
      list.push(v); if (list.length > (MAX_VARIANTS[def.id] ?? 3)) list.shift();
      this.cache.set(def.id, list);
      return v;
    })();
    this.rendering.set(def.id, p);
    p.finally(() => this.rendering.delete(def.id));
    return p;
  },
  /** Render a second variant in the background so repeats don't sound identical. */
  warm(def) {
    const list = this.cache.get(def.id) || [];
    if (list.length < Math.min(2, MAX_VARIANTS[def.id] ?? 3) && !this.rendering.has(def.id)) {
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
      idle(() => this.renderOne(def));
    }
  },

  /** Plays a rendered buffer. Returns { when (performance.now ms the sound is heard), stop() }. */
  play(buffer, { pan = 0, gain = 1, muffle = 0 } = {}) {
    const c = this.unlock();
    const src = c.createBufferSource(); src.buffer = buffer;
    let node = src;
    if (muffle) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; node.connect(f); node = f; }
    const g = c.createGain(); g.gain.value = gain;
    const sp = c.createStereoPanner(); sp.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(g); g.connect(sp); sp.connect(this.master);
    const lead = 0.025;
    src.start(c.currentTime + lead);
    return {
      when: performance.now() + lead * 1000 + this.latencyMs(),
      stop: (fade = 0.15) => { try { g.gain.setTargetAtTime(0, c.currentTime, fade / 3); src.stop(c.currentTime + fade); } catch { /* already stopped */ } },
    };
  },

  /** A short UI tick (tray selection), synthesised live. */
  tick() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.06);
  },
  /** Match strike for re-lighting diyas. */
  strike() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, n = c.createBufferSource();
    const b = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const k = i / d.length; d[i] = (Math.random() * 2 - 1) * (k < 0.15 ? k / 0.15 : Math.exp(-(k - 0.15) * 9)); }
    n.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.35;
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t);
  },
};
