# Google Play listing: Patakha

Everything to paste into Play Console. Character limits are in brackets.

## App identity
- **App ID (package name):** `com.artinstudios.crackers` (permanent; deliberately neutral so the app can be renamed later)
- **Developer name:** ARTIN Studios
- **Contact email:** artinstudios.official@gmail.com
- **Privacy policy URL:** `https://<netlify-site>/privacy.html` (fill in once the site is deployed)
- **Category:** Simulation (alternative: Entertainment)
- **Tags:** Simulation, Festival, Fireworks
- **Free app**, contains ads, offers in-app purchases

## Store text
**App name** [30]
> Patakha: Diwali Crackers Sim

(28 characters. Alternatives: "Patakha – Diwali Crackers" (25), "Diwali Crackers: Patakha" (24).)

**Short description** [80]
> Burst anar, chakri, rockets & bombs with real sound, vibration and flashlight!

(78 characters)

**Full description** [4000]
> Celebrate Diwali on a rooftop under the new-moon sky: all the dhamaka, none of the smoke! 🪔
>
> Patakha is a realistic Diwali crackers simulator. Pick a cracker, tap the terrace and watch it go. Every cracker has its own sound, made for that cracker, your phone vibrates with every blast, and the flashlight flashes with the big ones.
>
> 🎆 CRACKERS
> • Anar (flower pot): a roaring fountain of golden sparks
> • Chakri: a ground spinner that whirls a ring of fire
> • Rocket: whistles up from its bottle and bursts into colour
> • Ladi: the 100-wala string, rat-a-tat-tat!
> • Sutli Bomb: twine-wrapped thunder (cover your ears!)
> • Phuljhadi: hold the sparkler and draw with light
> • Bijli, Saanp Goli (snake tablet) and Colour Pencil
> • Premium: Rainbow Anar, 1000-wala ladi, 12-shot Sky Shot and the Atom Bomb
>
> ✨ FEATURES
> • Realistic sound for every cracker, with echoes off the houses around you
> • Vibration that follows each cracker's sound: a thump for a bomb, a rattle for a ladi
> • Flashlight bursts on every big bang
> • Blow on your phone to put out the diyas, then tap to light them again
> • Draw with your phuljhadi like a long-exposure photo
> • Neighbourhood fireworks bursting over the skyline
> • Four backgrounds: city rooftop, village, river ghat and open sky
> • Auto show: sit back for a 45-second fireworks show
> • Make and share a शुभ दीपावली greeting card from your own fireworks
> • One-tap mute and clear, for when someone walks in
> • Works offline
>
> 🌱 A GREEN DIWALI
> No smoke, no burns, no noise for pets, older people and patients nearby. Burst as many as you like! Patakha also shares simple safety tips for the real thing.
>
> Unlock premium crackers free for 24 hours by watching a short video, or get them all forever with a one-time purchase. No subscriptions.
>
> Patakha is a simulator for entertainment. No real fireworks are involved.
>
> शुभ दीपावली! Made in India by ARTIN Studios.

## Graphics
- **App icon** 512×512 PNG: `store/icon-512.png` (from `dev/store.html`)
- **Feature graphic** 1024×500 PNG: `store/feature-1024x500.png` (from `dev/store.html`)
- **Phone screenshots** (2–8, 16:9 or 9:16, at least 1080 px on the short side recommended): `store/screenshots/`

## In-app products (Monetize → Products → In-app products)
| Product ID | Name | Description | Suggested price |
|---|---|---|---|
| `remove_ads` | Remove ads | No banner ads, ever. Rewarded videos stay optional. | ₹59 |
| `all_crackers` | All crackers | Every premium cracker unlocked forever, including future ones. | ₹79 |
| `festival_pack` | Festival Pack | All crackers and no ads. Best value. | ₹119 |

All are one-time, non-consumable products. Premium crackers can also be unlocked for 24 hours by watching a rewarded video.

## AdMob (to create once the account is approved)
- App: *Patakha* (Android), linked to the Play listing once published
- Ad units: `patakha_banner` (Banner) and `patakha_rewarded` (Rewarded)
- Publisher ID: `pub-5481819768860977`. Send the new ad unit IDs and they go into `android/gradle.properties`. Debug builds always use Google's test ads.

## Data safety (App content → Data safety)
- **Does your app collect or share any of the required user data types?** Yes (through the AdMob SDK).
- **Is all user data encrypted in transit?** Yes.
- **Do you provide a way for users to request that their data is deleted?** No (the app stores nothing on servers; local data is deleted on uninstall).
- **Data types**
  - *Device or other IDs* (advertising ID): **Collected and Shared**. Purposes: Advertising or marketing, Analytics, Fraud prevention, security and compliance. Optional: No (it is processed as part of serving ads).
  - *App activity → App interactions* (ad interactions): Collected. Purposes: Advertising, Analytics.
  - *App info and performance → Diagnostics / Crash logs* (by the AdMob SDK): Collected. Purpose: Analytics.
  - *Location → Approximate location* (derived from IP by AdMob): Collected and Shared. Purpose: Advertising.
  - *Financial info → Purchase history*: handled by Google Play Billing (declare "Collected" with the purpose App functionality, as the Play Billing library recommends).
- **Microphone / audio:** NOT collected. Audio is analysed live on the device to detect blowing and is never stored or transmitted, so no "Audio" data type is declared.

## Content rating (IARC questionnaire)
- Category: **Game** → Simulation / other
- Violence: **No** (fireworks only, no people, animals or weapons harmed)
- Fear, sexuality, language, controlled substances, gambling: **No**
- User interaction / sharing: **No** · Shares location: **No** · Digital purchases: **Yes**
- Expected rating: **Everyone / 3+** (PEGI 3)

## Target audience and content (App content)
- **Target age groups:** 13–15, 16–17, 18+. **Do not** select under-13 groups: the app has ads and is not built for the Families policy.
- **Appeals to children?** Answer that it is not designed for children. Ads are requested as non-child-directed.
- **Ads:** Yes, contains ads.
- **Government app / news / health:** No.

## Release plan (urgent: Diwali is on 8 November 2026)
1. Build the Android wrapper and a signed `.aab` (next step).
2. Upload to **Closed testing** as early as possible and invite the shared tester list. **12+ testers must stay opted in for 14 days** before production access opens.
3. Apply for production straight after day 14, and leave a few days for review before Dhanteras.
4. Backup seasons: New Year's Eve, weddings and cricket wins (an update can add a "New Year" sky).
