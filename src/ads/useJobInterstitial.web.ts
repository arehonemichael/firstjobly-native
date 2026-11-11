import { useCallback } from "react";

// AdMob is native-only. Web follows the same navigation without invoking the SDK.
export function useEarlyJobInterstitial() {
  const openJobWithEarlyInterstitial = useCallback(
    async (action: () => void) => action(),
    [],
  );
  return { openJobWithEarlyInterstitial };
}
export function useJobInterstitial(_jobId?: string) {
  const continueWithOptionalAd = useCallback(
    (action: () => void) => action(),
    [],
  );
  return { continueWithOptionalAd };
}
