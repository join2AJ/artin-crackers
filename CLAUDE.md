# Patakha: project rules (read before changing anything)

Patakha is a Diwali crackers simulator by **ARTIN Studios**. It's a static web app (Netlify: `index.html`, `css/`, `js/`). A native Android wrapper in `android/` bundles the same files (app ID `com.artinstudios.crackers`). **Android is the main target**: test features with the native bridge in mind (vibration strength, torch, mic permission, share, back button).

**Never put personal names anywhere** (code, docs, store text, commits). The studio name "ARTIN Studios" is the only public name. Public contact: artinstudios.official@gmail.com.

## Mandatory rules for every change
1. **Record every change in `CHANGELOG.md`** (Keep a Changelog: *Added / Changed / Fixed / Removed*). Put it under `## [Unreleased]`, or under a new version section when releasing. No change is too small.
2. **`version.json` is the single source of the version.** Bump `version` (semver) and `versionCode` (+1 for every Android build; it must always increase). The version must have a matching `## [x.y.z]` heading in the CHANGELOG.
3. **Run `scripts/check-changelog.sh` before every commit.** It must print ✓.
4. **Tag every release `vX.Y.Z`.** The *Tag releases* workflow does this on push. After a release, add its commit short hash to its CHANGELOG heading (`· \`abc1234\``).
5. **Never rewrite history** (no force-push, rebase or amend on pushed commits). Undo with `git revert` or `scripts/rollback.sh <tag>`, then record it in the CHANGELOG.
6. **Never commit secrets:** keystores (`*.jks`), `android/keystore.properties`, passwords, personal emails. Ad unit and product IDs are not secret.
7. **Bump the `CACHE` name in `sw.js`** whenever shipped web files change, so the PWA updates.
8. **Test at landscape phone size (844×390), portrait (390×844, shows the turn-sideways screen) and desktop** before committing.
9. One repo per app. Don't create a pull request unless asked.

See `docs/RELEASING.md` for the release and rollback procedure. Update `README.md` / `docs/` when behaviour, structure or setup changes.

## Working on the code
- Run: `npx http-server -p 8080 -s -c-1 .` → http://localhost:8080. Add `?storetest` to simulate the Android store and rewarded ads.
- Desktop: `WASD` walk, drag to look, `Shift` run, `E`/`Space` action, `Q` mode (Place/Hold/Pick), `F` torch, `L` lighter, `1`–`9` crackers, `M` mute, `C` clear, `Esc` back.
- `js/crackers.js`: catalogue. Each cracker has a `plan()` (random but seeded timeline) and a `sound()` that synthesises it. Add a cracker here, plus its icon in `ICONS` and a 3D kind in `js/w3d/crackers3d.js` (`KINDS`, `TORCH`).
- `js/synth.js`: offline synthesis toolkit (bang, pops, crackle, hiss, whistle, fuse…) and the outdoor reverb. Sounds render once per variant in an `OfflineAudioContext`; avoid creating thousands of nodes (use `S.grains`/`S.pops`/`S.crackle` for many small sounds).
- The game is 3D (Three.js r170, vendored in `js/vendor/`). `js/w3d/world.js`: renderer, `QUALITY` presets (low/medium/high), sky, lights (a fixed pool, so shaders never recompile), `Particles` (one Points draw call per system), `burst()`/`bang()`, prop physics (`bodies`, `impulse()`), AABB `collide()`. `js/w3d/maps.js`: `MAPS` + `BUILD` (gali, society, village, green), static meshes merged per material. `js/w3d/crackers3d.js`: one class per kind, reading the same plan as the sound, so visuals, sound, vibration and torch line up. `js/w3d/player.js`: first-person `Player` and the `Lighter` in hand. `js/w3d/art.js`: toon materials and textures. Keep draw calls and particle counts low: the game must run on budget Android phones.
- `js/fx.js`: haptics mixer (sound envelope → vibration) and the phone flashlight. `MANUAL` in `js/crackers.js`: field-manual text, shelf and eco figures (smoke/PM2.5 marked `src: 'study'` are measured; the rest are estimates and must be labelled so). `js/mic.js`: blow detection. `js/store.js`: free/premium, rewarded unlocks, purchases. `js/app.js`: map select, touch controls, Place/Hold/Pick actions, the loop and the sheets.
- Native bridge names (Android): `window.ArtinNative` (vibration, torch, `shareImage(base64Png)` for the greeting card), `window.ArtinStore` (ads and billing; events via `window.artinStoreEvent`), back button calls `window.artinBack()`.
- Android: `cd android && ./gradlew lintRelease assembleRelease bundleRelease` (needs `local.properties` sdk.dir and `keystore.properties`). Lint must report 0 errors. Java bridge: `NativeBridge.java` (ArtinNative), `Monetization.java` (ArtinStore), `MainActivity.java` (WebView, mic permission, back).
- `?debug` exposes `window.__patakha` (world, player, lighter, actives, act, setMode, select, startGame, target) for automated tests. Headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL.
- Art style is comic/cel-shaded: flat fills, a hard shadow tone, ink outlines (`INK` and `toon()` in `js/w3d/art.js`: three-step toon ramp, flat-shaded low-poly). Keep new art in that style.
- Store graphics: `dev/store.html` (icon, feature graphic; uses the old 2D renderer in `dev/2d/`) and `scripts/store-graphics.mjs` (also 3D screenshots).
