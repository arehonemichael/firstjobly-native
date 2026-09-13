import AsyncStorage from "@react-native-async-storage/async-storage";

import { AD_LIMITS } from "./config";

const LAST_FULL_SCREEN_AD_KEY = "fj_admob_last_interstitial";

let lastShownInMemory = 0;
let gateQueue: Promise<void> = Promise.resolve();

export function tryClaimInterstitialSlot(
  cooldownMs = AD_LIMITS.interstitialCooldownMs,
): Promise<boolean> {
  const attempt = gateQueue.then(async () => {
    const now = Date.now();
    const storedRaw = await AsyncStorage.getItem(LAST_FULL_SCREEN_AD_KEY);
    const stored = Number(storedRaw || 0);
    const lastShown = Math.max(lastShownInMemory, Number.isFinite(stored) ? stored : 0);

    if (now - lastShown < cooldownMs) return false;

    lastShownInMemory = now;
    await AsyncStorage.setItem(LAST_FULL_SCREEN_AD_KEY, String(now));
    return true;
  });

  gateQueue = attempt.then(
    () => undefined,
    () => undefined,
  );

  return attempt;
}
