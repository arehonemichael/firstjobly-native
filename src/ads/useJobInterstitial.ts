import { useCallback, useEffect } from "react";
import { useAdsConsent } from "./privacy";
import { interstitialManager } from "./interstitial-manager";

export function useEarlyJobInterstitial() {
  const { canRequestAds } = useAdsConsent();
  useEffect(() => {
    if (canRequestAds) interstitialManager.prepare();
  }, [canRequestAds]);
  const openJobWithEarlyInterstitial = useCallback(
    async (action: () => void) => {
      interstitialManager.onJobOpen(action);
    },
    [],
  );
  return { openJobWithEarlyInterstitial };
}

// Detail/Apply compatibility: no ad and no waiting.
export function useJobInterstitial(_jobId?: string) {
  const continueWithOptionalAd = useCallback(
    (action: () => void) => action(),
    [],
  );
  return { continueWithOptionalAd };
}
