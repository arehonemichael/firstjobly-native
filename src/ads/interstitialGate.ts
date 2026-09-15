import AsyncStorage from "@react-native-async-storage/async-storage";

import { MONETIZATION } from "./monetizationConfig";

const LAST_FULL_SCREEN_AD_KEY = "fj_admob_last_interstitial";

let lastShownInMemory = 0;
let fullScreenShowing = false;
let gateQueue: Promise<void> = Promise.resolve();

export function isFullScreenAdShowing() {
  return fullScreenShowing;
}

export function releaseFullScreenAdSlot() {
  fullScreenShowing = false;
}

export function tryClaimInterstitialSlot(
  source = "unknown",
  cooldownMs = MONETIZATION.fullScreenMinGapMs,
): Promise<boolean> {
  const attempt = gateQueue.then(async () => {
    if (fullScreenShowing) {
      if (__DEV__) console.info("[AdCadence][gate] blocked-active", { source });
      return false;
    }

    const now = Date.now();
    const storedRaw = await AsyncStorage.getItem(LAST_FULL_SCREEN_AD_KEY);
    const stored = Number(storedRaw || 0);
    const lastShown = Math.max(lastShownInMemory, Number.isFinite(stored) ? stored : 0);
    const elapsedMs = now - lastShown;
    const remainingMs = Math.max(0, cooldownMs - elapsedMs);

    if (elapsedMs < cooldownMs) {
      if (__DEV__) {
        console.info("[AdCadence][gate] blocked", {
          source,
          cooldownMs,
          elapsedMs,
          remainingMs,
        });
      }
      return false;
    }

    fullScreenShowing = true;
    lastShownInMemory = now;
    await AsyncStorage.setItem(LAST_FULL_SCREEN_AD_KEY, String(now));

    if (__DEV__) console.info("[AdCadence][gate] claimed", { source, cooldownMs, elapsedMs });
    return true;
  });

  gateQueue = attempt.then(
    () => undefined,
    () => undefined,
  );

  return attempt;
}
