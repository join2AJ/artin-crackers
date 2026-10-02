// "Blow out the diya": listens to the microphone and reports how hard you are
// blowing. Blowing on a mic makes loud, low-frequency wind noise, which is
// different from speech or music (energy spread across higher frequencies).
// Audio is analysed on the device only. Nothing is recorded or sent anywhere.

export const Mic = {
  stream: null, analyser: null, src: null, td: null, fd: null,
  get on() { return !!this.stream; },
  async start(ctx) {
    if (this.stream) return true;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.3;
    this.src.connect(this.analyser);
    this.td = new Float32Array(this.analyser.fftSize); this.fd = new Uint8Array(this.analyser.frequencyBinCount);
    this.rate = ctx.sampleRate;
    return true;
  },
  stop() {
    if (this.src) this.src.disconnect();
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; this.src = null; this.analyser = null;
  },
  /** 0..1 blow strength. */
  blow() {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.td);
    let sum = 0;
    for (let i = 0; i < this.td.length; i++) sum += this.td[i] * this.td[i];
    const rms = Math.sqrt(sum / this.td.length);
    this.analyser.getByteFrequencyData(this.fd);
    const hz = this.rate / this.analyser.fftSize, cut = Math.round(500 / hz);
    let low = 0, all = 0;
    for (let i = 1; i < this.fd.length; i++) { const v = this.fd[i] * this.fd[i]; all += v; if (i <= cut) low += v; }
    const lowShare = all ? low / all : 0;
    const strength = Math.max(0, Math.min(1, (rms - 0.04) / 0.22));
    return lowShare > 0.45 ? strength : strength * 0.2;
  },
};
