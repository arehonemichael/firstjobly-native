import { ADS_CONFIG, AD_UNITS } from "./config";
import { adsPrivacy, getRequestOptions } from "./privacy";
import { mobileAdsSDK } from "./sdk";
import { fullscreenLock } from "./fullscreen-lock";

type Ad = {
  load(): void;
  show(): Promise<void>;
  addAdEventListener(event: string, handler: () => void): () => void;
  removeAllListeners(): void;
};
type Port = {
  createAd(): Ad;
  permitted(): boolean;
  events: { LOADED: string; OPENED: string; CLOSED: string; ERROR: string };
};
type Policy = typeof ADS_CONFIG.interstitial;
export function createInterstitialManager(
  port: Port | null,
  policy: Policy = ADS_CONFIG.interstitial,
  lock = fullscreenLock,
) {
  let ad: Ad | null = null,
    loaded = false,
    opened = false;
  let opens = 0,
    shownThisSession = 0,
    lastShownAt: number | null = null;
  let retry = 0,
    retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryExhausted = false;
  let finish: (() => void) | null = null;
  let listeners: (() => void)[] = [];
  const owner = "interstitial";
  function discard() {
    listeners.forEach((remove) => {
      try {
        remove();
      } catch {
        /* Cleanup cannot block navigation. */
      }
    });
    listeners = [];
    const old = ad;
    ad = null;
    loaded = false;
    opened = false;
    try {
      old?.removeAllListeners();
    } catch {
      /* The ad is already discarded. */
    }
  }
  function clearRetry() {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  }
  function loadFailure() {
    discard();
    if (!port?.permitted() || !policy.enabled) return;
    const delay = policy.retryBackoffMs[retry++];
    if (delay === undefined) {
      retryExhausted = true;
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      prepare();
    }, delay);
  }
  function prepare() {
    if (
      !policy.enabled ||
      !port?.permitted() ||
      ad ||
      finish ||
      retryTimer !== null
    )
      return;
    if (retryExhausted) {
      retry = 0;
      retryExhausted = false;
    }
    try {
      const inventory = port.createAd();
      ad = inventory;
      listeners = [
        inventory.addAdEventListener(port.events.LOADED, () => {
          if (ad !== inventory) return;
          loaded = true;
          retry = 0;
        }),
        inventory.addAdEventListener(port.events.OPENED, () => {
          if (ad !== inventory || !finish || opened) return;
          opened = true;
          opens = 0;
          shownThisSession++;
          lastShownAt = Date.now();
        }),
        inventory.addAdEventListener(port.events.CLOSED, () => {
          if (ad !== inventory) return;
          if (finish) finish();
          else {
            discard();
            prepare();
          }
        }),
        inventory.addAdEventListener(port.events.ERROR, () => {
          if (ad !== inventory) return;
          if (finish) finish();
          else loadFailure();
        }),
      ];
      inventory.load();
    } catch {
      loadFailure();
    }
  }
  function onJobOpen(proceed: () => void) {
    // First tap owns this transition. Ignore rapid second taps until completion;
    // they must not navigate beneath the ad or enqueue a second destination.
    if (finish) return;
    opens++;
    prepare();
    if (
      !policy.enabled ||
      !port?.permitted() ||
      !loaded ||
      !ad ||
      opens < policy.everyNthJobOpen ||
      shownThisSession >= policy.maxPerSession ||
      (lastShownAt !== null && Date.now() - lastShownAt < policy.cooldownMs) ||
      !lock.tryAcquire(owner)
    ) {
      proceed();
      return;
    }
    const inventory = ad;
    let done = false;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    finish = () => {
      if (done) return;
      done = true;
      if (startTimer !== null) clearTimeout(startTimer);
      if (safetyTimer !== null) clearTimeout(safetyTimer);
      finish = null;
      lock.release(owner);
      discard();
      prepare();
      proceed();
    };
    const complete = finish;
    startTimer = setTimeout(() => {
      if (!opened) complete();
    }, policy.startTimeoutMs);
    safetyTimer = setTimeout(complete, policy.safetyTimeoutMs);
    try {
      void inventory.show().catch(complete);
    } catch {
      complete();
    }
  }
  function revoke() {
    clearRetry();
    retry = 0;
    retryExhausted = false;
    if (finish) finish();
    else discard();
  }
  return {
    prepare,
    onJobOpen,
    revoke,
    _test: {
      reset() {
        revoke();
        clearRetry();
        discard();
        opens = 0;
        shownThisSession = 0;
        lastShownAt = null;
      },
      state: () => ({
        opens,
        shownThisSession,
        lastShownAt,
        loaded,
        retryExhausted,
      }),
    },
  };
}
const sdk = mobileAdsSDK;
export const interstitialManager = createInterstitialManager(
  sdk
    ? {
        permitted: () => adsPrivacy.getSnapshot().canRequestAds,
        events: sdk.AdEventType,
        createAd: () =>
          sdk.InterstitialAd.createForAdRequest(
            AD_UNITS.interstitial,
            getRequestOptions(),
          ),
      }
    : null,
);
adsPrivacy.subscribe(() => {
  if (!adsPrivacy.getSnapshot().canRequestAds) interstitialManager.revoke();
  else interstitialManager.prepare();
});
export const { prepare, onJobOpen, _test } = interstitialManager;
