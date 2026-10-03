// The lighter you hold to a fuse: an agarbatti (incense stick), a candle or a
// phuljhadi. It follows your finger, with the burning tip a little above it so
// your finger never hides the fuse.

export const LIGHTERS = {
  agarbatti: { name: 'Agarbatti', hi: 'अगरबत्ती', catch: 0.35 },
  candle: { name: 'Candle', hi: 'मोमबत्ती', catch: 0.25 },
  phuljhadi: { name: 'Phuljhadi', hi: 'फुलझड़ी', catch: 0.12 },
};

export class Lighter {
  constructor() { this.kind = 'agarbatti'; this.active = false; this.shown = false; this.x = 0; this.y = 0; this.smoke = []; }
  /** The burning tip, offset up and to the left of the finger. */
  tip(u) { return { x: this.x - 20 * u, y: this.y - 40 * u }; }
  get catchTime() { return LIGHTERS[this.kind].catch; }

  /** Draws the lighter when `visible`; its smoke keeps drifting either way. */
  draw(c, now, u, st, visible) {
    const t = now / 1000, tp = this.tip(u), hx = this.x, hy = this.y;
    // smoke wisps keep drifting up after you let go
    for (const s of this.smoke) { s.age += 1 / 60; s.y -= 0.5 * u; s.x += Math.sin(s.age * 3 + s.ph) * 0.3 * u; }
    this.smoke = this.smoke.filter((s) => s.age < 1.6);
    c.save();
    for (const s of this.smoke) { c.globalAlpha = 0.18 * (1 - s.age / 1.6); c.fillStyle = '#c8c4d4'; c.beginPath(); c.arc(s.x, s.y, (1.5 + s.age * 4) * u, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
    if (!visible) { c.restore(); return; }
    c.lineCap = 'round';
    if (this.kind === 'agarbatti') {
      c.strokeStyle = '#6b4a2b'; c.lineWidth = 1.2 * u; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tp.x, tp.y); c.stroke();
      c.strokeStyle = '#3b2a20'; c.lineWidth = 2.6 * u; c.beginPath(); c.moveTo(hx + (tp.x - hx) * 0.3, hy + (tp.y - hy) * 0.3); c.lineTo(tp.x, tp.y); c.stroke();
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, 9 * u);
      g.addColorStop(0, 'rgba(255,120,60,0.9)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = g; c.fillRect(tp.x - 9 * u, tp.y - 9 * u, 18 * u, 18 * u);
      c.fillStyle = `rgba(255,${140 + Math.round(Math.sin(t * 7) * 40)},60,1)`; c.beginPath(); c.arc(tp.x, tp.y, 1.8 * u, 0, Math.PI * 2); c.fill();
      if (Math.random() < 0.3) this.smoke.push({ x: tp.x, y: tp.y - 2 * u, age: 0, ph: Math.random() * 6 });
    } else if (this.kind === 'candle') {
      const bx = tp.x, by = tp.y + 6 * u;
      c.fillStyle = '#f3ead8'; c.beginPath(); c.moveTo(hx - 3 * u, hy); c.lineTo(bx - 3 * u, by); c.lineTo(bx + 3 * u, by); c.lineTo(hx + 3 * u, hy); c.fill();
      c.strokeStyle = '#222'; c.lineWidth = 0.8 * u; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, by - 2.5 * u); c.stroke();
      c.globalCompositeOperation = 'lighter';
      const fh = 11 * u * (1 + Math.sin(t * 14) * 0.06);
      const g = c.createRadialGradient(bx, by - fh * 0.45, 0, bx, by - fh * 0.45, fh * 0.75);
      g.addColorStop(0, '#fffbe6'); g.addColorStop(0.4, '#ffd36b'); g.addColorStop(1, 'rgba(255,110,30,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(bx - 3 * u, by - 1 * u); c.quadraticCurveTo(bx - 3.4 * u, by - fh * 0.5, bx, by - fh); c.quadraticCurveTo(bx + 3.4 * u, by - fh * 0.5, bx + 3 * u, by - 1 * u); c.fill();
      st.scene.lights.push({ x: bx, y: by - 5 * u, r: 60 * u, colour: 'rgba(255,200,120,1)', a: 0.35 });
    } else {
      c.strokeStyle = '#7d828c'; c.lineWidth = 1.3 * u; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tp.x, tp.y); c.stroke();
      c.strokeStyle = '#4b4741'; c.lineWidth = 2.6 * u; c.beginPath(); c.moveTo(hx + (tp.x - hx) * 0.3, hy + (tp.y - hy) * 0.3); c.lineTo(tp.x, tp.y); c.stroke();
      c.globalCompositeOperation = 'lighter'; c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(tp.x, tp.y, 2.4 * u, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2, sp = (70 + Math.random() * 160) * u;
        st.sparks.add({ x: tp.x, y: tp.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.08 + Math.random() * 0.2, colour: Math.random() < 0.6 ? '#fff6e0' : '#ffd27a', size: 1.1 * u, drag: 2.2, grav: 140 * u, split: Math.random() < 0.25 ? 3 : 0 });
      }
      st.scene.lights.push({ x: tp.x, y: tp.y, r: 80 * u, colour: 'rgba(255,225,170,1)', a: 0.4 });
    }
    c.restore();
  }
}
