// Renders the Play Store graphics into store/ with headless Chromium (Playwright).
//   1. start a local server:  npx http-server -p 8080 -s -c-1 .
//   2. run:                   node scripts/store-graphics.mjs
// Produces store/icon-512.png, store/feature-1024x500.png and store/screenshots/*.png (1080×1920 and 1920×1080).
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let pw;
try { pw = await import('playwright'); } catch {
  const root = execSync('npm root -g').toString().trim();
  pw = await import(pathToFileURL(join(root, 'playwright', 'index.mjs')).href);
}
const BASE = process.env.BASE || 'http://localhost:8080';
mkdirSync('store/screenshots', { recursive: true });
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

// ---- icon + feature graphic
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  await page.goto(`${BASE}/dev/store.html`);
  await page.waitForSelector('body[data-ready="1"]');
  await page.waitForTimeout(300);
  await page.locator('#icon').screenshot({ path: 'store/icon-512.png' });
  await page.locator('#feature').screenshot({ path: 'store/feature-1024x500.png' });
  await page.close();
}

// ---- screenshots from the real app
async function shoot(name, w, h, script) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1080 / Math.min(w, h), isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { localStorage.setItem('patakha:welcomed', 'true'); localStorage.setItem('patakha:settings', JSON.stringify({ realLight: false })); });
  await page.goto(`${BASE}/?storetest`);
  await page.waitForTimeout(1200);
  const g = await page.evaluate(() => { const r = document.querySelector('#tray').getBoundingClientRect(); return { trayTop: r.top }; });
  const ground = (k = 0.5) => Math.round(h * (w > h ? 0.52 : 0.58) + 24 + (g.trayTop - h * (w > h ? 0.52 : 0.58) - 40) * k);
  const light = async (id, x, y) => { await page.click(`.cr[data-id="${id}"]`); await page.mouse.click(x, y); };
  await script({ page, light, ground, w, h });
  await page.screenshot({ path: `store/screenshots/${name}.png` });
  await ctx.close();
}

await shoot('1-anar-rocket', 405, 720, async ({ page, light, ground, w }) => {
  await light('rocket', w * 0.7, ground(0.3));
  await light('anar', w * 0.3, ground(0.5));
  await light('chakri', w * 0.55, ground(0.85));
  await page.waitForTimeout(2350);
});
await shoot('2-sparkler', 405, 720, async ({ page, w, h }) => {
  await page.click('.cr[data-id="phuljhadi"]');
  await page.mouse.move(w * 0.5, h * 0.35); await page.mouse.down();
  await page.waitForTimeout(500);
  for (let i = 0; i <= 64; i++) { // a heart
    const t = (i / 64) * Math.PI * 2, x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    await page.mouse.move(w * 0.42 + x * 7, h * 0.3 - y * 7); await page.waitForTimeout(22);
  }
});
await shoot('3-bomb', 405, 720, async ({ page, light, ground, w }) => {
  await light('ladi', w * 0.5, ground(0.8));
  await page.waitForTimeout(400);
  await light('bomb', w * 0.5, ground(0.35));
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1)));
  await page.waitForTimeout(2550);
});
await shoot('4-skyshot-landscape', 720, 405, async ({ page, light, ground, w }) => {
  await page.click('.cr[data-id="skyshot"]'); await page.waitForTimeout(200);
  await page.click('#btnWatch'); await page.waitForTimeout(500);
  await page.mouse.click(w * 0.5, ground(0.5));
  await light('anar', w * 0.2, ground(0.5));
  await light('rocket', w * 0.82, ground(0.5));
  await page.waitForTimeout(4200);
});
await browser.close();
console.log('store graphics written to store/');
