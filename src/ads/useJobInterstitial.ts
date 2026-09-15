import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { useInterstitialAd } from "react-native-google-mobile-ads";

import { AD_FEATURES, AD_UNITS } from "./config";
import { tryClaimInterstitialSlot } from "./interstitialGate";

export const JOB_OPEN_COUNT_KEY = "fj_admob_job_open_count";
const DOUBLE_TAP_WINDOW_MS = 750;

let jobOpenQueue: Promise<number> = Promise.resolve(0);
let globalTapLock = false;
let lastTap: { jobId: string; at: number } | null = null;

async function incrementJobOpenCount() {
  const operation = jobOpenQueue.then(async () => {
    const raw = await AsyncStorage.getItem(JOB_OPEN_COUNT_KEY);
    const parsed = Number(raw || 0);
    const current = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
    const next = current + 1;
    await AsyncStorage.setItem(JOB_OPEN_COUNT_KEY, String(next));
    return next;
  });
  jobOpenQueue = operation.catch(() => 0);
  return operation;
}

export function useJobInterstitial() {
  const pendingNavigation = useRef<(() => void) | null>(null);
  const { isLoaded, isClosed, load, show } = useInterstitialAd(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });

  useEffect(() => {
    if (AD_FEATURES.interstitial) load();
  }, [load]);

  useEffect(() => {
    if (!isClosed) return;
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    if (action) action();
    load();
  }, [isClosed, load]);

  const openJob = useCallback(async (jobId: string, navigate: () => void) => {
    if (!jobId || globalTapLock) return;
    const now = Date.now();
    if (lastTap?.jobId === jobId && now - lastTap.at < DOUBLE_TAP_WINDOW_MS) return;
    lastTap = { jobId, at: now };
    globalTapLock = true;

    let navigated = false;
    const navigateOnce = () => {
      if (navigated) return;
      navigated = true;
      navigate();
      setTimeout(() => { globalTapLock = false; }, DOUBLE_TAP_WINDOW_MS);
    };

    let count: number;
    try {
      count = await incrementJobOpenCount();
    } catch (error) {
      if (__DEV__) console.info("[JobAds] counter failed", error);
      navigateOnce();
      return;
    }

    const eligible = count % 2 === 1;
    if (__DEV__) console.info("[JobAds] job open", { count, eligible, isLoaded });

    if (!AD_FEATURES.interstitial || !eligible) {
      navigateOnce();
      return;
    }
    if (!isLoaded) {
      navigateOnce();
      load();
      return;
    }

    const claimed = await tryClaimInterstitialSlot("job-open");
    if (!claimed) {
      navigateOnce();
      return;
    }

    pendingNavigation.current = navigateOnce;
    try {
      await show();
    } catch (error) {
      if (__DEV__) console.info("[JobAds] show failed", error);
      pendingNavigation.current = null;
      navigateOnce();
      load();
    }
  }, [isLoaded, load, show]);

  const continueWithOptionalAd = useCallback((action: () => void) => action(), []);
  return { openJob, continueWithOptionalAd };
}

// Temporary compatibility for the Jobs screen until its call site is migrated.
// It uses the same global counter and manager logic rather than the removed session cadence.
export function useEarlyJobInterstitial() {
  const { openJob } = useJobInterstitial();
  const openJobWithEarlyInterstitial = useCallback(
    async (action: () => void) => {
      // Legacy caller does not provide the id, so do not consume the new global counter here.
      // The call site is migrated to JobOpenProvider in the same refactor.
      action();
    },
    [],
  );
  void openJob;
  return { openJobWithEarlyInterstitial };
}
