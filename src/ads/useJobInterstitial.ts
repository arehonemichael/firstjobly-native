import { useCallback, useEffect, useRef } from "react";
import { useInterstitialAd } from "react-native-google-mobile-ads";

import { AD_UNITS } from "./config";

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

      // Only the first job tap in this app session is eligible.
      if (jobOpensThisSession !== 1 || interstitialAttemptedThisSession) {
        action();
        return;
      }

      // Attempt only once per app session. Never block job navigation if the ad is not ready.
      interstitialAttemptedThisSession = true;

      if (!isLoaded) {
        action();
        load();
        return;
      }

      pendingAction.current = action;

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

// Backward-compatible no-ad wrapper for Job Details while the trigger lives in Jobs.
export function useJobInterstitial(_jobId?: string) {
  const continueWithOptionalAd = useCallback((action: () => void) => {
    action();
  }, []);

  return { continueWithOptionalAd };
}
