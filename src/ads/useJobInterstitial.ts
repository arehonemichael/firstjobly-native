import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { useInterstitialAd } from "react-native-google-mobile-ads";

import {
  AD_FEATURES,
  AD_JOB_OPEN_TRIGGERS,
  AD_UNITS,
  isAdCadenceTrigger,
} from "./config";
import { tryClaimInterstitialSlot } from "./interstitialGate";

const JOB_DETAIL_OPEN_COUNT_KEY = "fj_admob_job_detail_open_count";

let jobOpensThisSession = 0;
let interstitialAttemptedThisSession = false;

export function useEarlyJobInterstitial() {
  const pendingAction = useRef<(() => void) | null>(null);

  const { isLoaded, isClosed, load, show } = useInterstitialAd(
    AD_UNITS.interstitial,
    { requestNonPersonalizedAdsOnly: true },
  );

  useEffect(() => {
    if (AD_FEATURES.interstitial) load();
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

      if (!AD_FEATURES.interstitial) {
        action();
        return;
      }

      // Preserve the existing Jobs-list opportunity: only the second job tap
      // in an app session is eligible here. Job Detail has its own cadence.
      if (jobOpensThisSession !== 2 || interstitialAttemptedThisSession) {
        action();
        return;
      }

      interstitialAttemptedThisSession = true;

      if (!isLoaded) {
        action();
        load();
        return;
      }

      const claimed = await tryClaimInterstitialSlot();
      if (!claimed) {
        action();
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
    [isLoaded, load, show],
  );

  return { openJobWithEarlyInterstitial };
}

export function useJobInterstitial(jobId?: string) {
  const countedJobId = useRef<string | null>(null);
  const pendingTriggerCount = useRef<number | null>(null);
  const attemptedTriggerCount = useRef<number | null>(null);

  const { isLoaded, isClosed, load, show } = useInterstitialAd(
    AD_UNITS.interstitial,
    { requestNonPersonalizedAdsOnly: true },
  );

  useEffect(() => {
    if (AD_FEATURES.interstitial) load();
  }, [load]);

  useEffect(() => {
    if (isClosed) load();
  }, [isClosed, load]);

  const attemptPendingInterstitial = useCallback(async () => {
    const triggerCount = pendingTriggerCount.current;
    if (
      !AD_FEATURES.interstitial ||
      triggerCount == null ||
      attemptedTriggerCount.current === triggerCount
    ) {
      return;
    }

    if (!isLoaded) {
      load();
      return;
    }

    attemptedTriggerCount.current = triggerCount;
    pendingTriggerCount.current = null;

    const claimed = await tryClaimInterstitialSlot();
    if (!claimed) return;

    try {
      await show();
    } catch {
      load();
    }
  }, [isLoaded, load, show]);

  useEffect(() => {
    if (!jobId || countedJobId.current === jobId) return;
    countedJobId.current = jobId;

    let cancelled = false;

    const countOpen = async () => {
      const currentRaw = await AsyncStorage.getItem(JOB_DETAIL_OPEN_COUNT_KEY);
      const current = Number(currentRaw || 0);
      const nextCount = (Number.isFinite(current) ? current : 0) + 1;

      await AsyncStorage.setItem(JOB_DETAIL_OPEN_COUNT_KEY, String(nextCount));
      if (cancelled) return;

      if (isAdCadenceTrigger(nextCount, AD_JOB_OPEN_TRIGGERS)) {
        pendingTriggerCount.current = nextCount;
        void attemptPendingInterstitial();
      }
    };

    void countOpen();

    return () => {
      cancelled = true;
    };
  }, [attemptPendingInterstitial, jobId]);

  useEffect(() => {
    if (isLoaded && pendingTriggerCount.current != null) {
      void attemptPendingInterstitial();
    }
  }, [attemptPendingInterstitial, isLoaded]);

  const continueWithOptionalAd = useCallback((action: () => void) => {
    action();
  }, []);

  return { continueWithOptionalAd };
}
