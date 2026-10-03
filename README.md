# Patakha: Diwali Crackers Simulator

**by ARTIN Studios.** A green, smoke-free Diwali: every virtual cracker shows the CO₂ and smoke you kept out of the air, with green badges and a shareable Green Diwali card. Burst anar, chakri, rockets, ladi and sutli bombs on a rooftop on Diwali night, with sound made for each cracker, vibration that follows every blast and flashlight bursts. Set crackers down and light their fuses with an agarbatti, candle or phuljhadi. Draw with a phuljhadi, blow out the diyas through your mic, pick from ten backgrounds (rooftop, home, village, river ghat, palace, Himalaya, desert, border post, camp, open sky), run an auto show, learn about Diwali, see the CO₂ and smoke you saved, and share a greeting card. All the dhamaka, none of the smoke.

- **Web:** static site, no build step, offline PWA (Netlify serves the repo root).
- **Android:** native WebView wrapper (coming next), app ID `com.artinstudios.crackers`.

## Run locally
```bash
npx http-server -p 8080 -s -c-1 .
# open http://localhost:8080        (add ?storetest to simulate the Android store)
```
The microphone and the flashlight in the browser need HTTPS (or localhost).

## Structure
| Path | What |
|---|---|
| `index.html`, `css/`, `fonts/`, `icons/` | App shell, styles, self-hosted fonts, icons |
| `js/crackers.js` | Cracker catalogue: timelines (`plan`) and sound recipes (`sound`) |
| `js/synth.js` | Offline Web Audio synthesis toolkit and outdoor reverb |
| `js/audio.js` | Realtime playback and the variant cache |
| `js/visuals.js` | How each cracker looks and moves, plus flashlight timing |
| `js/scene.js` | Background themes, diyas, toran, rangoli, debris |
| `js/fx.js` | Haptics mixer, flashlight, spark particles |
| `js/mic.js` | Blow detection for the diyas |
| `js/lighter.js` | Agarbatti, candle and phuljhadi for real lighting |
| `js/store.js` | Free/premium, rewarded unlocks, purchases (Android) |
| `js/app.js` | UI, input and the main loop |
| `sw.js`, `manifest.webmanifest` | Offline support |
| `privacy.html`, `store/LISTING.md` | Privacy policy and Play listing text |
| `dev/store.html` | Generates the Play icon and feature graphic |

## Versioning
See [`CHANGELOG.md`](CHANGELOG.md), [`docs/RELEASING.md`](docs/RELEASING.md) and [`CLAUDE.md`](CLAUDE.md).
