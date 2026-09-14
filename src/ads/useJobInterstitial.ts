import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
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

      const claimed = await tryClaimInterstitialSlot("jobs-early");
      if (!claimed) {
        action();
        return;
      }

      pendingAction.current = action;

      try {
        await show();
      } catch (error) {
        console.info("[AdCadence][jobs-early] show failed", error);
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
  const attemptedTriggerCount = useRef<number | null>(null);
  const [pendingTriggerCount, setPendingTriggerCount] = useState<number | null>(null);

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

  // Count each Job Detail view independently of ad loading state. Keeping this
  // effect dependent only on jobId prevents an ad load state change from
  // cancelling the async storage read/write before the trigger is queued.
  useEffect(() => {
    if (!jobId || countedJobId.current === jobId) return;
    countedJobId.current = jobId;

    let active = true;

    const countOpen = async () => {
      try {
        const currentRaw = await AsyncStorage.getItem(JOB_DETAIL_OPEN_COUNT_KEY);
        const current = Number(currentRaw || 0);
        const nextCount = (Number.isFinite(current) ? current : 0) + 1;
        const shouldTrigger = isAdCadenceTrigger(nextCount, AD_JOB_OPEN_TRIGGERS);

        await AsyncStorage.setItem(JOB_DETAIL_OPEN_COUNT_KEY, String(nextCount));

        console.info("[AdCadence][job-detail] counter", {
          key: JOB_DETAIL_OPEN_COUNT_KEY,
          previous: currentRaw,
          count: nextCount,
          triggers: AD_JOB_OPEN_TRIGGERS,
          shouldTrigger,
          jobId,
        });

        if (!active) return;

        if (shouldTrigger) {
          attemptedTriggerCount.current = null;
          setPendingTriggerCount(nextCount);
          console.info("[AdCadence][job-detail] trigger queued", { count: nextCount, jobId });
        } else {
          setPendingTriggerCount(null);
        }
      } catch (error) {
        console.info("[AdCadence][job-detail] counter read/write failed", {
          key: JOB_DETAIL_OPEN_COUNT_KEY,
          jobId,
          error,
        });
      }
    };

    void countOpen();

    return () => {
      active = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (
      !AD_FEATURES.interstitial ||
      pendingTriggerCount == null ||
      attemptedTriggerCount.current === pendingTriggerCount
    ) {
      return;
    }

    if (!isLoaded) {
      console.info("[AdCadence][job-detail] eligible but ad not loaded yet", {
        count: pendingTriggerCount,
        jobId,
      });
      load();
      return;
    }

    attemptedTriggerCount.current = pendingTriggerCount;
    const triggerCount = pendingTriggerCount;

    const showPendingInterstitial = async () => {
      console.info("[AdCadence][job-detail] attempting show", {
        count: triggerCount,
        jobId,
        isLoaded,
      });

      const claimed = await tryClaimInterstitialSlot("job-detail");
      if (!claimed) {
        console.info("[AdCadence][job-detail] suppressed by shared cooldown", {
          count: triggerCount,
          jobId,
        });
        setPendingTriggerCount(null);
        return;
      }

      try {
        console.info("[AdCadence][job-detail] show reached", { count: triggerCount, jobId });
        await show();
      } catch (error) {
        console.info("[AdCadence][job-detail] show failed", {
          count: triggerCount,
          jobId,
          error,
        });
        load();
      } finally {
        setPendingTriggerCount(null);
      }
    };

    void showPendingInterstitial();
  }, [isLoaded, jobId, load, pendingTriggerCount, show]);

  const continueWithOptionalAd = useCallback((action: () => void) => {
    action();
  }, []);

  return { continueWithOptionalAd };
}
