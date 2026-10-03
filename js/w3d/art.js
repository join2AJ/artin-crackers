// Shared 3D art: comic toon materials, glow textures and the rangoli texture.
// Everything is built in code, so the game needs no image or model files.

import * as THREE from '../vendor/three.module.min.js';
import { rng } from '../synth.js';

export const INK = '#07120d';

// Three-step toon ramp: dark, mid, lit. Gives the flat, cel-shaded comic look.
let ramp = null;
export function toonRamp() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([60, 150, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}
const toonCache = new Map();
/** Shared toon material for a colour. */
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!toonCache.has(key)) toonCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...opts }));
  return toonCache.get(key);
}
const glowCache = new Map();
/** Unlit, bright material for lamps, windows and flames. */
export function glow(color, opacity = 1) {
  const key = color + opacity;
  if (!glowCache.has(key)) glowCache.set(key, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false, fog: true }));
  return glowCache.get(key);
}

/** Faceted low-poly look: unshare vertices so every face gets its own normal. */
export function flat(geom) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** Ink outline: a slightly larger back-facing copy in near-black ("inverted hull"). */
const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
export function outline(mesh, thickness = 0.04) {
  const o = new THREE.Mesh(mesh.geometry, inkMat);
  o.scale.setScalar(1 + thickness);
  o.renderOrder = -1;
  mesh.add(o);
  return mesh;
}

let dotTex = null;
/** Soft round dot for particles and halos. */
export function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  dotTex.colorSpace = THREE.SRGBColorSpace;
  return dotTex;
}
const haloCache = new Map();
/** Additive glow sprite (lamps, diya flames, bursts). */
export function halo(color, size, opacity = 0.8) {
  const key = color + opacity;
  if (!haloCache.has(key)) haloCache.set(key, new THREE.SpriteMaterial({ map: dotTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const s = new THREE.Sprite(haloCache.get(key));
  s.scale.setScalar(size);
  return s;
}

/** Night sky: a vertical gradient painted on a big inverted sphere. */
export function skyTexture(stops) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  stops.forEach(([t, col]) => gr.addColorStop(t, col));
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The coloured-powder rangoli, painted flat into a texture. */
export function rangoliTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), R = S * 0.4;
  g.translate(S / 2, S / 2);
  const petals = (n, r1, r2, wide, c1, c2, rot = 0) => {
    for (let i = 0; i < n; i++) {
      g.save(); g.rotate((i / n) * Math.PI * 2 + rot);
      const gr = g.createLinearGradient(r1, 0, r2, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); g.moveTo(r1, 0); g.bezierCurveTo(r1 + (r2 - r1) * 0.3, -wide, r1 + (r2 - r1) * 0.75, -wide * 0.9, r2, 0);
      g.bezierCurveTo(r1 + (r2 - r1) * 0.75, wide * 0.9, r1 + (r2 - r1) * 0.3, wide, r1, 0); g.fill();
      g.strokeStyle = INK; g.lineWidth = R * 0.014; g.stroke();
      g.restore();
    }
  };
  const dots = (n, r, size, col) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, size, 0, Math.PI * 2); g.fill(); } };
  g.fillStyle = '#3b1650'; g.beginPath(); g.arc(0, 0, R * 1.06, 0, Math.PI * 2); g.fill();
  petals(16, R * 0.66, R * 1.02, R * 0.13, '#ff2e7e', '#ff6fa6');
  petals(16, R * 0.7, R * 0.92, R * 0.06, '#ffb300', '#ffd84d', Math.PI / 16);
  dots(32, R * 1.12, R * 0.024, '#fff4dc'); dots(16, R * 1.04, R * 0.03, '#ffd23f');
  for (const rot of [0, Math.PI / 4]) {
    g.save(); g.rotate(rot);
    g.fillStyle = rot ? '#14c3a6' : '#0e9c86'; g.fillRect(-R * 0.42, -R * 0.42, R * 0.84, R * 0.84);
    g.strokeStyle = INK; g.lineWidth = R * 0.02; g.strokeRect(-R * 0.42, -R * 0.42, R * 0.84, R * 0.84);
    g.restore();
  }
  petals(8, R * 0.1, R * 0.4, R * 0.1, '#5b5bff', '#8f7dff');
  petals(8, R * 0.12, R * 0.3, R * 0.07, '#ff7a1a', '#ffb347', Math.PI / 8);
  g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(0, 0, R * 0.14, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.stroke();
  dots(8, R * 0.2, R * 0.018, '#ffffff');
  const r = rng(77);
  for (let i = 0; i < 2600; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 1.05; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.16)'; g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 2, 2); }
  g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R * 1.07, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Merges many static meshes into one mesh per material (far fewer draw calls).
 * Every geometry must carry position + normal only.
 */
export function mergeStatic(meshes) {
  const groups = new Map();
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m.matrixWorld);
    if (!groups.has(m.material)) groups.set(m.material, []);
    groups.get(m.material).push(g);
  }
  const out = [];
  for (const [mat, geoms] of groups) {
    let n = 0; for (const g of geoms) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of geoms) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geom.computeBoundingSphere();
    out.push(new THREE.Mesh(geom, mat));
  }
  return out;
}
