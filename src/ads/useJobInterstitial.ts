import { useCallback, useEffect, useRef } from "react";
import { useAdsConsent } from "./privacy";
import { mobileAdsSDK } from "./sdk";
import { AD_UNITS } from "./config";
const noop = () => {};
const disabledAd = {
  isLoaded: false,
  isClosed: false,
  load: noop,
  show: async () => {},
};
function useDisabledInterstitialAd() {
  return disabledAd;
}
const useInterstitialAd =
  mobileAdsSDK?.useInterstitialAd ?? useDisabledInterstitialAd;

let jobOpensThisSession = 0;
let interstitialAttemptedThisSession = false;

export function useEarlyJobInterstitial() {
  const { canRequestAds } = useAdsConsent();
  const pendingAction = useRef<(() => void) | null>(null);

  const { isLoaded, isClosed, load, show } = useInterstitialAd(
    AD_UNITS.interstitial,
    { requestNonPersonalizedAdsOnly: true },
  );

  useEffect(() => {
    if (canRequestAds) load();
  }, [load, canRequestAds]);

  useEffect(() => {
    if (!isClosed || !pendingAction.current) return;

    const action = pendingAction.current;
    pendingAction.current = null;
    action();
    if (canRequestAds) load();
  }, [isClosed, load, canRequestAds]);

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

      if (!canRequestAds || !isLoaded) {
        action();
        if (canRequestAds) load();
        return;
      }

      pendingAction.current = action;

      try {
        await show();
      } catch {
        pendingAction.current = null;
        action();
        if (canRequestAds) load();
      }
    },
    [isLoaded, load, show, canRequestAds],
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
