# Patakha: Diwali Crackers Simulator

**by ARTIN Studios.** A 3D Diwali crackers game with a green heart. Walk around a low-poly mohalla, society, village chowk or green park on Diwali night, set down anar, chakri, rockets, ladi, sutli bombs and sky shots, and light them with an agarbatti, candle or phuljhadi in your hand. Every cracker has its own sound, the phone vibrates with every blast, and fireworks light up the houses around you. Every virtual cracker shows the CO₂ and smoke you kept out of the air, with green badges and a shareable Green Diwali card. All the dhamaka, none of the smoke.

- **Web:** static site, no build step, offline PWA (Netlify serves the repo root).
- **Android:** native WebView wrapper in `android/`, app ID `com.artinstudios.crackers` (minSdk 26, target 36).

## Build the Android app
```bash
cd android
echo "sdk.dir=/path/to/android-sdk" > local.properties
# signing: android/keystore.properties (git-ignored) with storeFile, storePassword, keyAlias, keyPassword
./gradlew lintRelease assembleRelease bundleRelease
# → app/build/outputs/apk/release/app-release.apk  (install on a phone)
# → app/build/outputs/bundle/release/app-release.aab (upload to Google Play)
```
The web files are copied into the app at build time, so rebuild after any web change. Or run the GitHub *Android build* workflow with the `PATAKHA_*` signing secrets set.

## Run locally
```bash
npx http-server -p 8080 -s -c-1 .
# open http://localhost:8080        (add ?storetest to simulate the Android store, ?debug for window.__patakha)
```
The microphone and the flashlight in the browser need HTTPS (or localhost).

## Structure
| Path | What |
|---|---|
| `index.html`, `css/`, `fonts/`, `icons/` | App shell, styles, self-hosted fonts, icons |
| `js/crackers.js` | Cracker catalogue: timelines (`plan`) and sound recipes (`sound`) |
| `js/synth.js` | Offline Web Audio synthesis toolkit and outdoor reverb |
| `js/audio.js` | Realtime playback (positional pan and distance) and the variant cache |
| `js/w3d/world.js` | 3D renderer, quality presets, lights, particles, flashes, blasts, prop physics |
| `js/w3d/maps.js` | The four maps, built from low-poly blocks in code |
| `js/w3d/crackers3d.js` | 3D model and burn of each cracker kind, plus flashlight timing |
| `js/w3d/player.js` | First-person walking and looking, and the lighter in your hand |
| `js/w3d/art.js` | Toon materials, glows, sky and rangoli textures, static mesh merging |
| `js/vendor/three.module.min.js` | Three.js r170 (MIT) |
| `js/fx.js` | Haptics mixer and the phone flashlight |
| `js/mic.js` | Blow detection for the diyas |
| `js/store.js` | Free/premium, rewarded unlocks, purchases (Android) |
| `js/app.js` | Map select, touch controls, actions, the loop and the sheets |
| `sw.js`, `manifest.webmanifest` | Offline support |
| `privacy.html`, `store/LISTING.md` | Privacy policy and Play listing text |
| `dev/store.html`, `dev/2d/` | Generates the Play icon and feature graphic (with the old 2D renderer) |

## Versioning
See [`CHANGELOG.md`](CHANGELOG.md), [`docs/RELEASING.md`](docs/RELEASING.md) and [`CLAUDE.md`](CLAUDE.md).
