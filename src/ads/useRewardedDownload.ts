import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Alert } from "react-native";
import { ADS_CONFIG } from "./config";
import { mobileAdsSDK } from "./sdk";
import { useAdsConsent } from "./privacy";
import { rewardedManager } from "./rewarded-manager";
import { adDiagnostics as diag } from "./diagnostics";

/** Call only from the disclosed download action, after validating the form. */
export function useRewardedDownload() {
  const consent = useAdsConsent();
  const alive = useRef(true),
    pending = useRef(false);
  const credit = useSyncExternalStore(
    rewardedManager.subscribeCredit,
    rewardedManager.getCredit,
    rewardedManager.getCredit,
  );
  const canOfferAd =
    !credit &&
    !!mobileAdsSDK &&
    ADS_CONFIG.rewarded.enabled &&
    consent.canRequestAds;
  useEffect(() => {
    alive.current = true;
    if (canOfferAd) rewardedManager.prepare();
    return () => {
      alive.current = false;
    };
  }, [canOfferAd]);
  const beforeDownload = useCallback(async () => {
    if (!alive.current || pending.current) return false;
    pending.current = true;
    try {
      const outcome = await rewardedManager.request();
      if (!alive.current) return false;
      if (outcome === "cancelled") {
        Alert.alert(
          "Download not started",
          "The ad was closed before completion. Your details are still here. Tap download when you're ready to try again.",
        );
        return false;
      }
      if (outcome === "busy") {
        Alert.alert(
          "Ad already open",
          "Try downloading again after the current ad closes.",
        );
        return false;
      }
      return true; // Earned, or explicitly free fallback when inventory is unavailable.
    } catch (error) {
      diag.error("rewarded", "download.fallback", error);
      return alive.current;
    } finally {
      pending.current = false;
    }
  }, []);
  return {
    beforeDownload,
    canOfferAd,
    completeDownload: rewardedManager.consumeReward,
  };
}
