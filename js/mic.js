// "Blow out the diya": listens to the microphone and reports how hard you are
// blowing. The detector learns the room's background noise level and reacts to
// anything clearly louder; the low "whoosh" of breath on the mic counts extra.
// Audio is analysed on the device only. Nothing is recorded or sent anywhere.

export const Mic = {
  stream: null, analyser: null, src: null, sink: null, td: null, fd: null,
  sensitivity: 0.8, // 0 = low … 1 = very high
  floor: 0.01, // learnt background level (RMS)
  get on() { return !!this.stream; },
  async start(ctx) {
    if (this.stream) return true;
    // noise suppression would filter out the breath noise we want to hear
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.2;
    // keep the analyser running on every browser by connecting it to a silent output
    this.sink = ctx.createGain(); this.sink.gain.value = 0;
    this.src.connect(this.analyser); this.analyser.connect(this.sink); this.sink.connect(ctx.destination);
    this.td = new Float32Array(this.analyser.fftSize); this.fd = new Uint8Array(this.analyser.frequencyBinCount);
    this.rate = ctx.sampleRate; this.floor = 0.01; this.warm = 0;
    return true;
  },
  stop() {
    try { this.src?.disconnect(); this.analyser?.disconnect(); this.sink?.disconnect(); } catch { /* already gone */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; this.src = null; this.analyser = null; this.sink = null;
  },
  /** 0..1 blow strength; call once per frame. */
  blow(dt = 1 / 60) {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.td);
    let sum = 0;
    for (let i = 0; i < this.td.length; i++) sum += this.td[i] * this.td[i];
    const rms = Math.sqrt(sum / this.td.length);
    this.analyser.getByteFrequencyData(this.fd);
    const hz = this.rate / this.analyser.fftSize, cut = Math.round(700 / hz);
    let low = 0, all = 0;
    for (let i = 1; i < this.fd.length; i++) { const v = this.fd[i] * this.fd[i]; all += v; if (i <= cut) low += v; }
    const lowShare = all ? low / all : 0;

    const s = Math.max(0, Math.min(1, this.sensitivity));
    const thr = Math.max(0.0035 + (1 - s) * 0.03, this.floor * (1.5 + (1 - s) * 2.5));
    // learn the background quickly at first, then slowly, and never from a blow
    this.warm += dt;
    if (rms < thr) this.floor += (rms - this.floor) * Math.min(1, dt * (this.warm < 1 ? 6 : 0.8));
    if (rms <= thr) return 0;
    const strength = Math.min(1, (rms - thr) / (thr * (2 - s)));
    return Math.min(1, strength * (lowShare > 0.25 ? 1.25 : 0.75) + 0.08);
  },
};
