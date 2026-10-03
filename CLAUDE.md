# Patakha: project rules (read before changing anything)

Patakha is a Diwali crackers simulator by **ARTIN Studios**. It's a static web app (Netlify: `index.html`, `css/`, `js/`). A native Android wrapper will live in `android/` and bundle the same files (app ID `com.artinstudios.crackers`).

**Never put personal names anywhere** (code, docs, store text, commits). The studio name "ARTIN Studios" is the only public name. Public contact: artinstudios.official@gmail.com.

## Mandatory rules for every change
1. **Record every change in `CHANGELOG.md`** (Keep a Changelog: *Added / Changed / Fixed / Removed*). Put it under `## [Unreleased]`, or under a new version section when releasing. No change is too small.
2. **`version.json` is the single source of the version.** Bump `version` (semver) and `versionCode` (+1 for every Android build; it must always increase). The version must have a matching `## [x.y.z]` heading in the CHANGELOG.
3. **Run `scripts/check-changelog.sh` before every commit.** It must print ✓.
4. **Tag every release `vX.Y.Z`.** The *Tag releases* workflow does this on push. After a release, add its commit short hash to its CHANGELOG heading (`· \`abc1234\``).
5. **Never rewrite history** (no force-push, rebase or amend on pushed commits). Undo with `git revert` or `scripts/rollback.sh <tag>`, then record it in the CHANGELOG.
6. **Never commit secrets:** keystores (`*.jks`), `android/keystore.properties`, passwords, personal emails. Ad unit and product IDs are not secret.
7. **Bump the `CACHE` name in `sw.js`** whenever shipped web files change, so the PWA updates.
8. **Test at landscape phone size (844×390), portrait (390×844) and desktop** before committing.
9. One repo per app. Don't create a pull request unless asked.

See `docs/RELEASING.md` for the release and rollback procedure. Update `README.md` / `docs/` when behaviour, structure or setup changes.

## Working on the code
- Run: `npx http-server -p 8080 -s -c-1 .` → http://localhost:8080. Add `?storetest` to simulate the Android store and rewarded ads.
- Desktop shortcuts: keys `1`–`9` pick a cracker, `Space` lights it, `M` mutes, `C` clears, `Esc` closes sheets.
- `js/crackers.js`: catalogue. Each cracker has a `plan()` (random but seeded timeline) and a `sound()` that synthesises it. Add a cracker here, plus its icon in `ICONS`.
- `js/synth.js`: offline synthesis toolkit (bang, pops, crackle, hiss, whistle, fuse…) and the outdoor reverb. Sounds render once per variant in an `OfflineAudioContext`; avoid creating thousands of nodes (use `S.grains`/`S.pops`/`S.crackle` for many small sounds).
- `js/visuals.js`: one class per cracker kind; reads the same plan so visuals, sound, vibration and torch line up. `static torch(plan)` lists flashlight bursts.
- `js/fx.js`: haptics mixer (sound envelope → vibration), flashlight, spark particles. `js/scene.js`: background themes (`THEMES`: green (default), city, home, village, ghat, palace, snow, desert, army, camp, open), diyas, toran, rangoli, weather, debris. `js/lighter.js`: the agarbatti/candle/phuljhadi held to fuses (real lighting). `MANUAL` in `js/crackers.js`: field-manual text, shelf and eco figures (smoke/PM2.5 marked `src: 'study'` are measured; the rest are estimates and must be labelled so). `js/mic.js`: blow detection. `js/store.js`: free/premium, rewarded unlocks, purchases. `js/app.js`: UI and loop.
- Native bridge names (Android): `window.ArtinNative` (vibration, torch, `shareImage(base64Png)` for the greeting card), `window.ArtinStore` (ads and billing; events via `window.artinStoreEvent`), back button calls `window.artinBack()`.
- `?debug` exposes `window.__patakha` (actives, scene, lighter) for automated tests.
- Store graphics generator: `dev/store.html` (icon, feature graphic).
