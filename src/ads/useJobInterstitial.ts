import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { useInterstitialAd } from "react-native-google-mobile-ads";

import { AD_LIMITS, AD_UNITS } from "./config";

const LAST_INTERSTITIAL_KEY = "fj_admob_last_interstitial";

let jobOpensThisSession = 0;
let interstitialAttemptedThisSession = false;

export function useEarlyJobInterstitial() {
  const pendingAction = useRef<(() => void) | null>(null);

  const { isLoaded, isClosed, load, show } = useInterstitialAd(
    AD_UNITS.interstitial,
    { requestNonPersonalizedAdsOnly: true }
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isClosed || !pendingAction.current) return;

    const action = pendingAction.current;
    pendingAction.current = null;
    action();
    load();
  }, [isClosed, load]);

  const openJobWithEarlyInterstitial = useCallback(
    async (action: () => void) => {
      jobOpensThisSession += 1;

      // First job always opens normally. Only the second job open is eligible.
      if (jobOpensThisSession !== 2 || interstitialAttemptedThisSession) {
        action();
        return;
      }

      // This session gets one early opportunity only, even if the ad is not ready.
      interstitialAttemptedThisSession = true;

      const lastRaw = await AsyncStorage.getItem(LAST_INTERSTITIAL_KEY);
      const lastShown = Number(lastRaw || 0);
      const now = Date.now();

      if (now - lastShown < AD_LIMITS.interstitialCooldownMs || !isLoaded) {
        action();
        if (!isLoaded) load();
        return;
      }

      pendingAction.current = action;
      await AsyncStorage.setItem(LAST_INTERSTITIAL_KEY, String(now));

      try {
        await show();
      } catch {
        pendingAction.current = null;
        action();
        load();
      }
    },
    [isLoaded, load, show]
  );

  return { openJobWithEarlyInterstitial };
}
