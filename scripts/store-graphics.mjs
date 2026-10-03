// Renders the Play Store graphics into store/ with headless Chromium (Playwright).
//   1. start a local server:  npx http-server -p 8080 -s -c-1 .
//   2. run:                   node scripts/store-graphics.mjs
// Produces store/icon-512.png, store/feature-1024x500.png and store/screenshots/*.png (1920×1080, from the 3D game).
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
let browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

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

// ---- screenshots from the real 3D game (1920×1080). Headless Chromium needs SwiftShader for WebGL.
await browser.close();
browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function shoot(name, map, script) {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 405 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript((m) => { localStorage.setItem('patakha:played3d', 'true'); localStorage.setItem('patakha:settings', JSON.stringify({ map: m, quality: 'high' }));
    // badges already earned, so no pop-up covers the shot
    localStorage.setItem('patakha:impact', JSON.stringify({ count: 120, co2: 3200, smoke: 900, pm: 10390, loud: 40 })); }, map);
  await page.goto(`${BASE}/?storetest&debug`);
  await page.waitForTimeout(2500);
  if (script) {
    await page.evaluate(() => window.__patakha.startGame());
    await page.waitForTimeout(300);
    await script(page);
  }
  await page.screenshot({ path: `store/screenshots/${name}.png` });
  await ctx.close();
}
/** Places and lights crackers in front of the player, then looks up by `pitch`. */
const show = (list, pitch, wait) => async (page) => {
  await page.evaluate(async (list) => {
    const P = window.__patakha, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const [id, yaw] of list) {
      P.player.pitch = -0.5; P.player.yaw = yaw; P.player.apply(); P.select(id); P.setMode('place');
      const n = P.actives().length;
      await sleep(80); P.act();
      for (let i = 0; i < 100 && P.actives().length === n; i++) await sleep(50); // the sound renders first
      await sleep(100); P.act(); await sleep(1800); // slow software GL in headless runs
    }
    P.player.yaw = 0;
  }, list);
  await page.evaluate((p) => { const P = window.__patakha; P.player.pitch = p; P.player.apply(); }, pitch);
  await page.waitForTimeout(wait);
};
await shoot('1-select-map', 'gali');
await shoot('2-gali-anar', 'gali', show([['anar', 0.3], ['chakri', 0], ['anar', -0.3]], -0.1, 2600));
await shoot('3-society-rockets', 'society', show([['rocket', 0.3], ['rocket', -0.3], ['rocket', 0]], 0.62, 2600));
await shoot('4-village-bomb', 'village', show([['ladi', -0.15], ['bomb', 0.3]], -0.2, 3000));
await shoot('5-green-park', 'green', show([['anar', 0.15], ['rocket', -0.15]], 0.2, 3000));
await browser.close();
console.log('store graphics written to store/');
