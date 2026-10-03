# Changelog

Every change to Patakha is recorded here, newest first. Versions follow
[Semantic Versioning](https://semver.org): **MAJOR** for big or breaking changes, **MINOR** for new
features, **PATCH** for fixes and small tweaks. Each released version has a git tag `vX.Y.Z` that you can
roll back to (see [docs/RELEASING.md](docs/RELEASING.md)).

`Play build` is the Android `versionCode`. It must increase with every Google Play upload.

## [Unreleased]

## [0.10.0] — 2026-10-03 · Play build 10
### Added
- **35 crackers (26 free), 76 variants in all.** 22 new:
  - Bombs: Lakshmi Bomb, Aloo Bomb, Chocolate Bomb, Bullet Bomb, Pop-Pop snappers.
  - Fountains: Kothi Anar (clay pot), Tiranga Anar (saffron, white and green).
  - Spinner: Zameen Chakkar.
  - Handheld: Twinkling Star, Colour Matches.
  - Rockets: Baby Rocket, Thunder Rocket (a white thunderclap), Golden Rain.
  - Strings: Chatpati.
  - Sky: Roman Candle (coloured balls), Fancy Shell (one big shell from a tube), Chhota Cake (4 shots).
  - Premium: Hydrogen Bomb, Mayur Anar, 2000-wala, Grand Finale (60 shots), Udan Tashtari (a flying spinner that lifts off).
  - Each has its own sound, 3D model, icon and field-manual page with eco estimates.
- **Wait & watch:** pick a 1, 2 or 5-minute show. Crackers are set up and lit around you on their own, with a finale at the end. A timer at the top stops it. Every cracker still counts towards CO₂ saved.
- **Privacy policy inside the app:** it opens in a sheet with a Back button and the app's own colours. The Android back button now returns to the game; before, opening the policy page and pressing back closed the app. The standalone `privacy.html` also got the app's colours and a "Back to Patakha" link.
### Changed
- **No more Place / Hold / Pick modes.** The one action button picks its job by itself:
  - Light when you look at a cracker;
  - Light diya when you look at a diya that is out;
  - Pick up for a ball or can;
  - Throw when you hold one;
  - Hold for a sparkler;
  - otherwise Place.
- **Readable text on start:**
  - the splash title, Hindi name, tagline and studio line have an ink outline and a dark backing;
  - the map-select background is darker;
  - hints sit on a dark pill.
- Shared cracker recipes in `js/crackers.js` (`bombPlan`, `chakriPlan`, `rocketPlan`, `skyPlan` and their sounds). The 3D crackers read new plan fields: bomb shapes (round, box, tube, big, pop), clay anar, big and flying chakri, small and thunder rockets, tube cakes and roman-candle stars.
- Service worker cache `patakha-v10`.
### Removed
- The Place / Hold / Pick switch and the `Q` key.

## [0.9.0] — 2026-10-03 · Play build 9 · `de41efb`
### Added
- **First-run tutorial**, step by step:
  - "Slide on the joystick to walk" and "Slide here to look around", with the other half of the screen dimmed and an animated hand;
  - then Place and Light, with the action button highlighted;
  - then a reminder to step back.

  It ends with a **reward pop-up**: the Rainbow Anar free for 24 hours (when it is locked), the first-cracker and Seedling rewards. You can skip it, and replay it from Settings → Controls.
- **Privacy screen on first launch:** it says what stays on the phone, that the mic is only checked live, and where ads appear, with a link to the Privacy Policy.
- **Easy aim** (on by default; Settings → Controls). Light lights the nearest unlit cracker in front of you or right beside you, so no precise aiming is needed.
- New splash screen: a Diwali-night poster with rooftops, a temple, toran lights, diyas and fireworks.
- `Store.grant()` for free 24-hour unlocks given as rewards.
### Changed
- **No ads while you play.** The banner now shows only on the map-select menu, and never during the game. It used to sit under the game and shrink the screen. Privacy policy and listing updated.
- **Easier movement:**
  - the joystick is always drawn bottom-left with arrows, and you can slide anywhere on the left side to push it;
  - it has a small dead zone and a gentle curve, so small pushes walk slowly;
  - the walk is slower (2.6 m/s);
  - head bob is off by default, and look sensitivity is a little lower.
- Placing no longer needs you to look at the ground: looking level or up puts the cracker about 2 m in front of you.
- Lighter and Torch buttons moved to the top-right, out of the joystick's way.
- First-person hand: a blocky fist with fingers, a thumb and a saffron kurta sleeve.
- Service worker cache `patakha-v9`.

## [0.8.0] — 2026-10-03 · Play build 8 · `4c2378d`
### Added
- **Patakha is now a 3D game.** Walk around a low-poly Indian neighbourhood on Diwali night in first person, set crackers down and light them yourself. Built with Three.js r170 (MIT, vendored in `js/vendor/`) and cel-shaded toon materials for the comic look.
- **Four maps**, each with toran lights, diyas, street lamps and props:
  - Mohalla Gali: a narrow lane of painted houses with a temple at the end.
  - Society: apartment blocks around a courtyard with a rangoli.
  - Village Chowk: huts around a banyan tree on its chabutra.
  - Green Park: wind turbines, solar lamps and trees.
- **Map select screen** with a picture of every map and a START button. The chosen map is shown live behind the menu.
- **Controls:**
  - a floating joystick on the left to walk, and drag on the right to look;
  - on desktop: WASD to walk, Shift to run, drag to look; E or Space for the action, Q to change mode, F for the torch, L for the lighter.
- **Lighter button.** An agarbatti, candle or phuljhadi (chosen in Settings → Controls) in your hand reaches out to the fuse when you press Light.
- **Torch button:** a flashlight for dark corners.
- **Place / Hold / Pick:**
  - Place sets the cracker down where you look; a ladi is laid out across your view.
  - Hold puts a phuljhadi or pencil in your hand. Holding a cracker that bursts is refused, with a safety tip.
  - Pick picks up a football, can, bucket, box or matka to throw, or puts an unlit cracker back in the box.
- **3D crackers with particle fireworks:**
  - anar fountains and skidding chakris;
  - rockets that lean away from you and burst in the sky (peony, willow, crackle, ring);
  - ladi pops racing along the string;
  - sutli, bijli and atom bombs with a flash, sparks, a smoke cloud, flying paper, a shock ring, a scorch mark and a blast that knocks props about;
  - sky shot cakes, sparklers, and the saanp goli with its smoke.
- **Fireworks light up the world:** houses and the street glow in the colour of each burst. Street-lamp lights follow you.
- **Positional sound:** every cracker is panned and gets quieter with distance, and vibration gets weaker the farther away it is.
- **Neighbourhood fireworks** burst over the rooftops around the map.
- **Diyas in 3D:**
  - blow on the mic to put out the ones near you;
  - look at a diya that is out and press Light to light it again.
- **Settings tabs:** Graphic (quality Low/Medium/High, screen shake, head bob, neighbourhood fireworks, FPS), Sound, Controls (look sensitivity, invert, lighter) and More (shop, safety tips, about).
- Landscape only: the Android app locks to landscape, and the web version asks you to turn the phone sideways.
### Changed
- The cracker box is now the **Shop** button. The current cracker and its variant are shown next to the action button; tap it to change the variant.
- Greeting cards and the share image are now taken from the 3D view.
- Badge pop-ups slide in at the top so they don't hide the crosshair.
- `dev/store.html` keeps the 2D renderer (moved to `dev/2d/`) for the icon and feature graphic. `scripts/store-graphics.mjs` now takes 1920×1080 screenshots from the 3D game.
- Service worker cache `patakha-v8`.
### Removed
- The 2D stage, its background themes, the auto show and the long-exposure sparkler drawing (`js/scene.js`, `js/visuals.js` and `js/lighter.js` are no longer shipped).

## [0.7.0] — 2026-10-03 · Play build 7 · `a7177e7`
### Added
- **Android app** (`android/`, app ID `com.artinstudios.crackers`, minSdk 26, target/compile SDK 36, AGP 8.13, Gradle wrapper). A native WebView wrapper bundles the web app from `assets/www` through WebViewAssetLoader, so it works fully offline.
  - `window.ArtinNative`:
    - vibration with real strength control (each cracker's sound envelope becomes a motor-strength curve);
    - the flashlight through CameraManager (no camera permission needed);
    - `shareImage()`, which shares greeting cards through Android's share sheet via a FileProvider;
    - screen orientation.
  - **Microphone for the diyas:** the page's request is passed to Android's runtime permission prompt and granted only if the player allows it.
  - **Back button:** closes open sheets first, then exits.
  - **Look:** a green status bar and splash, and full-screen with the camera notch kept clear.
  - `window.ArtinStore`: AdMob banner and rewarded ads behind UMP consent, with retries on failed loads and the ad status in Settings, plus Play Billing for `remove_ads`, `all_crackers` and `festival_pack`, including restore. Debug builds always use Google's test ads, and so do release builds until the Patakha ad units are added to `android/gradle.properties`.
  - **Launcher icons:** adaptive icon (sparkler-A foreground on a green background), a monochrome icon for Android 13+ themed icons, and legacy square and round icons.
- GitHub workflow `android.yml`: builds a signed AAB and APK when the `PATAKHA_KEYSTORE_BASE64`, `PATAKHA_KEYSTORE_PASSWORD`, `PATAKHA_KEY_ALIAS` and `PATAKHA_KEY_PASSWORD` secrets are set, otherwise a debug APK.
### Changed
- Docs: Android build steps in `README.md`, `CLAUDE.md` and `docs/RELEASING.md`.

## [0.6.0] — 2026-10-03 · Play build 6 · `dbd8e8f`
### Added
- **Cracker variants.** Pick a variant from the chip bar above the tray. Each variant has its own sound and is remembered:
  - Anar: Gold, Silver, Colour, Giant (a taller fountain that lasts longer).
  - Chakri: Gold, Green, Multicolour, Whistling.
  - Rocket: Surprise, Whistling, Colour burst, Golden willow, Crackling, Ring.
  - Ladi: 100-wala, 50-wala, 200-wala.
  - Sutli Bomb: Classic, Double bang, Long fuse.
  - Phuljhadi: Gold, Electric (silver-white), Long.
  - Bijli: Single, Bunch of 5.
  - Pencil: Red, Green, Pink, Blue.
  - Sky Shot: 12-shot, 25-shot, Golden.
- **Greeting cards enhanced.**
  - Two new styles: **Comic** (an ink-bordered panel, halftone dots, a jagged starburst title and a speech bubble) and **Lotus** (a gold line-art lotus in a dotted mandala frame). Seven styles in all.
  - **Message presets:** Happy Diwali, Green Diwali, Lakshmi Puja, New Year (Saal Mubarak) and Dhanteras, each with Hindi and English lines.
  - A **To** field ("Dear …") alongside From.
### Changed
- **Comic, cel-shaded art style**, after a clean vector comic reference: bold ink outlines and flat, hard-edged shading.
  - **Scenery:** a posterised sky in flat bands, sparkle-shaped stars, ink outlines on every building, hill, tree, tent and wall, and a flat shadow side on each building.
  - **Diyas, rangoli and crackers:** cel-shaded diyas with flat layered flames, an ink-outlined rangoli, and crackers with hard shadow bands and ink outlines.
  - **Icons and scale:** cracker icons in the tray and box get an ink outline, and crackers are drawn 30% larger.
- Service-worker cache bumped to `patakha-v6`.

## [0.5.0] — 2026-10-03 · Play build 5 · `9466c21`
### Added
- **Green City background**, now the default for everyone: a deep teal-green night with a soft aurora glow, wind turbines turning on the hills (with blinking red tip lights), rooftop gardens and solar panels on the buildings, tulsi and fern planters along the wall, and fireflies drifting over the terrace. Eleven backgrounds in all.
### Changed
- **A greener look throughout.** Forest-green frosted panels, top bar, tray, sheets, settings rows and pop-ups replace the midnight-blue ones. The splash screen glows green, the logo shield and app icon have a deep green core, and greeting-card shading is green-black.
- Browser theme colour is now `#03100b`.
- Service-worker cache bumped to `patakha-v5`.

## [0.4.0] — 2026-10-03 · Play build 4 · `710ea4d`
### Changed
- **Fresh, eco-first look.** New palette: emerald for the green-Diwali highlight and main actions, warm gold for festive touches and Hindi, on a midnight-teal base. Frosted-glass panels, softer cut corners and a glowing primary button replace the old plum-and-marigold look.
- **Saving the air is now the headline.** The splash says "Green Diwali · Zero smoke", and the welcome reads "Celebrate Diwali. Save the air." The top bar has an **eco meter**: CO₂ saved tonight, crackers lit, and a ring that fills towards your next green badge.
- **Diyas redesigned.** Glazed clay lamps with a painted gold band and dots, a pinched spout, a glowing oil pool and a layered flame (blue base, gold body, white core) that casts a pool of light on the floor. They now stand in pairs along the wall, and eight more sit in a ring around the rangoli.
- **Rangoli redesigned.** A detailed coloured-powder mandala: pink and gold petal rings, bead borders, a teal eight-pointed star, a violet lotus and a glowing centre, with powder grain. It is painted flat and laid on the floor in perspective.
- **Crackers redrawn.** A painted clay anar with a gold zigzag and a glossy highlight, a chakri of turning coloured paper bands with a gold foil hub, a striped rocket with a foil nose cone and fins in a labelled glass bottle, a printed sky-shot box with stars, ladi tubes with gold bands, a shine on the bombs, and soft contact shadows under everything. Firework stars now have a soft glowing halo.
- **Greeting card** opens on the new **Green Diwali** style by default: your CO₂ saved in big type, cigarettes' smoke and car kilometres avoided, crackers lit, your badges, and "Join me: celebrate with light, not smoke". The share message carries the same numbers.
- With real lighting on, tapping a diya toggles it on release, so a lighter drag can start on top of one. The diya touch area is tighter.
- Store feature graphic leads with "Green Diwali · Zero smoke · Save the air".
- Service-worker cache bumped to `patakha-v4`.
### Added
- **Background previews**: each background in the picker shows a real thumbnail painted from that scene.
- **"+60 g CO₂" pops** float up from every cracker you light, and the eco meter pulses.
- **Green badges**: Seedling, Clean-Air Friend, Tree Buddy, Lung Saver, Pet Protector, Earth Guardian, Green Champion and Air Hero, each celebrated with a pop-up when earned.
- **Impact screen redesigned**: a big progress ring, a plain-language summary, four everyday equivalents (cigarettes' smoke, car kilometres, phone charges, tree-days), the badge shelf, the air-quality and noise notes, and a **Share my Green Diwali** button.

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
