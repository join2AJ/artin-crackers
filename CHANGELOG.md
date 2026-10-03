# Changelog

Every change to Patakha is recorded here, newest first. Versions follow
[Semantic Versioning](https://semver.org): **MAJOR** for big or breaking changes, **MINOR** for new
features, **PATCH** for fixes and small tweaks. Each released version has a git tag `vX.Y.Z` that you can
roll back to (see [docs/RELEASING.md](docs/RELEASING.md)).

`Play build` is the Android `versionCode`. It must increase with every Google Play upload.

## [Unreleased]

## [0.3.0] — 2026-10-03 · Play build 3 · `5997852`
### Added
- **Real lighting.** Tap the ground to set a cracker down unlit, then press and drag your lighter to its fuse. Hold it there a moment and the fuse catches with a fizz of sparks, then it goes off. Choose the lighter from the rail: **agarbatti** (glowing tip and incense smoke), **candle** or **phuljhadi**. The old tap-to-light-at-once way is still in Settings (*Real lighting* off).
- **Six new backgrounds**, ten in all: **Home** (the family house with a marigold toran, swaying kandil lanterns and the family on the balcony), **Palace** (domes, chhatris and arches outlined in lamps), **Himalaya** (snow peaks, snowy pines, a lit chalet and falling snow), **Desert** (dunes, a fort, camels, tents and drifting sand), **Border Post** (barracks, a watchtower with a sweeping searchlight, tents and the tricolour) and **Camp** (forest, tents and a crackling campfire).
- **Background button** on the rail opens a strip of every background over the tray, so you can switch on the spot.
- **About Diwali**: why it is celebrated (Rama's return, Lakshmi Puja, Krishna and Narakasura, Kali Puja, Mahavira's nirvana, Bandi Chhor Divas), which calendar it follows (Kartik Amavasya in the Hindu lunisolar calendar), the five days with 2026 dates, the main date up to 2030, how it is celebrated, why it is good for us, and a green-Diwali note. It also shows a countdown to Diwali.
- **Your green Diwali** (tap the tally): for tonight and all time, the CO₂ kept out of the air (with phone-charge and tree-day equivalents), the cigarettes' worth of smoke nobody had to breathe, and how far the dirtiest cracker would have pushed PM2.5 past India's AQI *Severe* line and safe limit. Smoke and PM2.5 for five crackers come from a 2016 study by the Chest Research Foundation and the University of Pune; everything else is labelled as an estimate. The tally now reads "N lit · X g CO₂ saved".
- **Cracker box**: the "All" button at the start of the tray opens every cracker sorted onto shelves (Ground, Sky, Loud, Strings, Handheld).
- **Field manual** for every cracker (the ⓘ in the box): how it works, how to stay safe, and what one real cracker costs in smoke, PM2.5, CO₂ and noise.
- **Greeting card styles**: Classic, Rangoli (petal corners and a gold frame), Diya (a row of lamps), Green Diwali (your smoke-free stats) and Minimal. Cards use whichever background you're on.
- **Shake phone to light** (Settings).
- Privacy policy: a section on the motion sensor.
### Changed
- **New logo**: the "A" is now two phuljhadis leaning together, their tips meeting in a sparkle star, with a glowing light trail as the crossbar. Splash animation, app icon and store graphics updated.
- Narrow phones show just the logo mark in the top bar, so the tally always fits.
- Service-worker cache bumped to `patakha-v3`.

## [0.2.0] — 2026-10-03 · Play build 2 · `6d295c3`
### Changed
- **New logo.** The ARTIN "A" is now a lamp: a diya flame glows inside the A, a clay bowl forms its crossbar, and three stars twinkle above. The old spark fountain from the A's tip could be misread, so it is gone. The splash animation, app icon and store graphics are updated to match.
- **Blowing out the diyas is far more sensitive.** The detector now learns your room's background noise and reacts to any breath clearly above it, instead of needing a loud, fixed level. A light breath now counts and a harder blow puts the diyas out faster. The meter glows while it hears you, and the app's own bangs coming out of the speaker are ignored. A new **Blow sensitivity** slider in Settings defaults to high.
- The flashlight button moved from the top bar to the new quick-action rail.
- Service-worker cache bumped to `patakha-v2`.
### Added
- **Mute button** in the top bar: instant silence, for example when someone walks in. Vibration and lights keep working. It is remembered, and `M` toggles it on desktop.
- **Clear button**: stops every cracker, sound, vibration and flashlight burst at once and sweeps away sparks, smoke and debris. `C` on desktop.
- **Background themes** in Settings: Rooftop (city), Village (huts, coconut palms, a banyan and earth courtyard), River Ghat (temples outlined in lamps, reflections and floating diyas on the water) and Open Sky (hills, the Milky Way and grass). The choice is remembered.
- **Auto show**: a 45-second fireworks show that lights crackers by itself and ends with a volley of rockets. Tap again to stop.
- **Diwali greeting card**: makes a 1080×1350 card from the sky you just lit, with "शुभ दीपावली · Happy Diwali" and an optional "with love from" name, then shares it (or saves it where sharing isn't available). The name is only drawn on the image.
- **Four new crackers:** Bijli (little red cracker with a sharp crack), Saanp Goli (snake tablet with a growing ash snake) and Colour Pencil (red, green or pink flame) are free; Rainbow Anar (a fountain that changes colour) is premium. 13 crackers in total.
- Quick-action rail on the right: flashlight, clear, auto show, greeting card.
- Privacy policy: a section on the greeting card.

## [0.1.0] — 2026-10-02 · Play build 1 · `7e2923f`
### Added
- First version of the Patakha web app (Diwali Crackers Simulator) by ARTIN Studios.
- **Nine crackers:** Anar, Chakri, Rocket, Ladi (100-wala), Sutli Bomb and Phuljhadi are free. 1000-wala, Sky Shot (12 shots) and Atom Bomb are premium.
- **Synthesised sound** for every cracker (Web Audio, rendered offline per variant): fuse fizz, blast with sub-bass punch, paper-tube pops, anar roar, chakri whirr, whistling rockets, crackling stars, and outdoor reverb with echoes off the houses. Sky bursts are heard a moment after the flash, like real distance.
- **Vibration made from each cracker's own sound.** Several crackers mix into one vibration track, which is silent during the fuse and thumps on the blast. Android gets real strength control; browsers use pulse width.
- **Flashlight bursts** on blasts, bursts and ladi pops (Chrome on Android with camera permission; the app will drive the LED directly).
- **Night scene:** a moonless Amavasya sky, rooftops with lit windows, water tanks and a temple, toran lights, diyas on the parapet and a rangoli on the terrace. Blasts light up the scene, shake the screen and leave scorch marks and paper debris.
- **Phuljhadi light painting:** hold the sparkler and draw with light. Its trail glows for a few seconds.
- **Blow out the diyas** through the microphone (analysed on the device only). Tap a diya to light it again or to put it out by hand.
- **Neighbourhood fireworks:** far-off bursts over the skyline with a delayed, muffled boom. Can be turned off.
- Pollution-free angle: tally "N lit · 0 g smoke", the welcome line "All the dhamaka. None of the smoke.", and green and safe Diwali tips in Settings.
- Settings: volume, vibration on/off and strength, flashlight, neighbourhood fireworks, screen shake, version line.
- Store groundwork (`js/store.js`) for the Android app: free/premium crackers, 24-hour unlock by rewarded video, products `remove_ads`, `all_crackers` and `festival_pack`, restore, and an ad status line. Buttons read "Soon" until Play returns the products. `?storetest` simulates it in a browser. On the website everything is free.
- ARTIN look: an app logo where the ARTIN "A" is an anar fountain inside the shield, a 0.7 s splash, cut-corner panels, marigold accent. Self-hosted fonts (Chakra Petch, Barlow, Share Tech Mono, Yatra One for Hindi).
- Offline PWA (`sw.js` cache `patakha-v1`), web manifest, icons, `netlify.toml`.
- Version control system: this CHANGELOG, `version.json`, `scripts/check-changelog.sh`, `scripts/rollback.sh`, `scripts/tag-releases.sh`, GitHub workflows for the changelog check and release tags, `CLAUDE.md` and `docs/RELEASING.md`.
- `privacy.html`, `store/LISTING.md` (names, descriptions, Data safety, content rating, product IDs) and `dev/store.html` for store graphics.
