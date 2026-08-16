import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { useInterstitialAd } from "react-native-google-mobile-ads";

import { AD_LIMITS, AD_UNITS } from "./config";

const JOB_VIEW_COUNT_KEY = "fj_admob_job_detail_views";
const LAST_INTERSTITIAL_KEY = "fj_admob_last_interstitial";

export function useJobInterstitial(jobId?: string) {
  const pendingAction = useRef<(() => void) | null>(null);
  const countedJob = useRef<string | null>(null);

  const {
    isLoaded,
    isClosed,
    load,
    show,
  } = useInterstitialAd(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!jobId || countedJob.current === jobId) return;
    countedJob.current = jobId;

    void (async () => {
      const raw = await AsyncStorage.getItem(JOB_VIEW_COUNT_KEY);
      const next = Number(raw || 0) + 1;
      await AsyncStorage.setItem(JOB_VIEW_COUNT_KEY, String(next));
    })();
  }, [jobId]);

  useEffect(() => {
    if (!isClosed || !pendingAction.current) return;

    const action = pendingAction.current;
    pendingAction.current = null;
    action();
    load();
  }, [isClosed, load]);

  const continueWithOptionalAd = useCallback(
    async (action: () => void) => {
      const viewsRaw = await AsyncStorage.getItem(JOB_VIEW_COUNT_KEY);
      const views = Number(viewsRaw || 0);

      const eligibleByCount =
        views >= AD_LIMITS.minJobDetailsBeforeInterstitial &&
        views % AD_LIMITS.minJobDetailsBeforeInterstitial === 0;

      if (!eligibleByCount) {
        action();
        return;
      }

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
    [isLoaded, load, show],
  );

  return { continueWithOptionalAd };
}
