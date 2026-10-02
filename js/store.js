// Monetisation for the Android app: free vs premium crackers, 24-hour unlocks
// earned by watching a rewarded ad, and one-time purchases via Google Play.
// The website has no store (everything is open). Add ?storetest to the URL to
// try the store flow in a browser with a simulated backend.
// Native side: window.ArtinStore (Android), events come back via window.artinStoreEvent(json).

import { CRACKERS } from './crackers.js';

const STORE_KEY = 'patakha:';
export const ls = {
  get(k, d) { try { const v = localStorage.getItem(STORE_KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(STORE_KEY + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

export const FREE = new Set(CRACKERS.filter((c) => c.free).map((c) => c.id));
export const UNLOCK_HOURS = 24;

// Product IDs must match Play Console → Monetize → In-app products.
export const PRODUCTS = {
  remove_ads: { name: 'Remove ads', blurb: 'No banner ads, ever. Rewarded videos stay optional.', fallback: '₹59' },
  all_crackers: { name: 'All crackers', blurb: 'Every premium cracker unlocked forever, including all future ones.', fallback: '₹79' },
  festival_pack: { name: 'Festival Pack', blurb: 'Everything: all crackers and no ads. Best value.', fallback: '₹119', best: true },
};

function mockBackend() {
  const fire = (o) => setTimeout(() => window.artinStoreEvent?.(JSON.stringify(o)), 250);
  const owned = new Set(ls.get('mockOwned', []));
  return {
    setBanner(v) { document.documentElement.dataset.mockBanner = v ? '1' : '0'; },
    rewardedReady: () => true,
    loadRewardedNow() {},
    adStatus: () => JSON.stringify({ sdk: 'mock', consent: 'ok', banner: 'showing', rewarded: 'ready' }),
    products: () => JSON.stringify({ type: 'products', products: Object.keys(PRODUCTS).map((id) => ({ id, title: PRODUCTS[id].name, price: PRODUCTS[id].fallback })) }),
    owned: () => JSON.stringify({ type: 'owned', owned: [...owned] }),
    restore() { fire({ type: 'owned', owned: [...owned] }); },
    showRewarded(token) { fire({ type: 'reward', token, earned: true }); return true; },
    buy(id) { owned.add(id); ls.set('mockOwned', [...owned]); fire({ type: 'owned', owned: [...owned] }); return true; },
    privacyOptionsRequired: () => false,
    showPrivacyOptions() {},
  };
}

const BACKEND = typeof window !== 'undefined' && (window.ArtinStore || (new URLSearchParams(location.search).has('storetest') ? mockBackend() : null));

export const Store = {
  enabled: !!BACKEND,
  native: typeof window !== 'undefined' && !!window.ArtinStore,
  owned: new Set(ls.get('owned', [])),
  products: {},
  unlocks: ls.get('unlocks', {}), // 'c:<id>' -> expiry timestamp
  listeners: new Set(),
  pending: new Map(), // rewarded-ad token -> callback
  adError: null, // AdMob error code of the last failed rewarded load (3 = no ad to show yet)

  on(fn) { this.listeners.add(fn); },
  emit() { this.listeners.forEach((fn) => fn()); },

  get premium() { return this.owned.has('all_crackers') || this.owned.has('festival_pack'); },
  get adsRemoved() { return this.owned.has('remove_ads') || this.owned.has('festival_pack'); },
  tempLeft(key) { const t = this.unlocks[key]; return t && t > Date.now() ? t - Date.now() : 0; },
  locked(id) { return this.enabled && !FREE.has(id) && !this.premium && !this.tempLeft('c:' + id); },
  price(id) { return this.products[id]?.price || PRODUCTS[id].fallback; },
  available(id) { return !!this.products[id]; },

  setBanner(show) { if (BACKEND) BACKEND.setBanner(!!show && !this.adsRemoved); },
  rewardedReady() { return !!BACKEND && BACKEND.rewardedReady(); },
  adStatus() { try { return JSON.parse(BACKEND?.adStatus?.() || 'null'); } catch { return null; } },
  loadRewarded() { try { BACKEND?.loadRewardedNow?.(); } catch { /* older app build */ } },

  /** Watch a rewarded ad to unlock cracker `id` for 24 h. */
  unlockWithAd(id, done) {
    if (!BACKEND) return false;
    const token = 'c:' + id + ':' + Date.now();
    this.pending.set(token, done);
    if (!BACKEND.showRewarded(token)) { this.pending.delete(token); return false; }
    return true;
  },
  buy(id) { return !!BACKEND && BACKEND.buy(id); },
  restore() { if (BACKEND) BACKEND.restore(); },
  privacyOptionsRequired() { return !!BACKEND && BACKEND.privacyOptionsRequired(); },
  showPrivacyOptions() { if (BACKEND) BACKEND.showPrivacyOptions(); },

  _handle(msg) {
    if (msg.type === 'products') this.products = Object.fromEntries(msg.products.map((p) => [p.id, p]));
    else if (msg.type === 'rewardedReady') this.adError = msg.ready ? null : (msg.code ?? -1);
    else if (msg.type === 'owned') { this.owned = new Set(msg.owned); ls.set('owned', msg.owned); }
    else if (msg.type === 'reward') {
      const cb = this.pending.get(msg.token); this.pending.delete(msg.token);
      if (msg.earned) {
        const key = msg.token.split(':').slice(0, 2).join(':');
        this.unlocks[key] = Date.now() + UNLOCK_HOURS * 3600e3;
        for (const k of Object.keys(this.unlocks)) if (this.unlocks[k] < Date.now()) delete this.unlocks[k];
        ls.set('unlocks', this.unlocks);
      }
      cb?.(msg.earned);
    }
    this.lastEvent = msg;
    this.emit();
  },
};

if (BACKEND) {
  window.artinStoreEvent = (json) => { try { Store._handle(JSON.parse(json)); } catch { /* ignore */ } };
  try { Store._handle(JSON.parse(BACKEND.products())); Store._handle(JSON.parse(BACKEND.owned())); } catch { /* not ready yet */ }
}

export const fmtLeft = (ms) => { const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3); return h ? `${h}h ${m}m` : `${m}m`; };
