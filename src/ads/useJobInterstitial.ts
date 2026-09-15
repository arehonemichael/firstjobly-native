import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useInterstitialAd } from "react-native-google-mobile-ads";

import { AD_UNITS } from "./config";
import { releaseFullScreenAdSlot, tryClaimInterstitialSlot } from "./interstitialGate";
import { MONETIZATION, isJobInterstitialEligible } from "./monetizationConfig";

export const JOB_OPEN_COUNT_KEY = "fj_admob_job_open_count";
const DOUBLE_TAP_WINDOW_MS = 750;
const LOAD_RETRY_MS = 15_000;

let jobOpenQueue: Promise<number> = Promise.resolve(0);
let globalTapLock = false;
let lastTap: { jobId: string; at: number } | null = null;
let pendingCreatedAt = 0;

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

function hasPendingOpportunity(now = Date.now()) {
  if (!pendingCreatedAt) return false;
  if (now - pendingCreatedAt <= MONETIZATION.pendingInterstitialExpiryMs) return true;
  pendingCreatedAt = 0;
  if (__DEV__) console.info("[JobAds] pending expired");
  return false;
}

function createPendingOpportunity() {
  if (!MONETIZATION.jobInterstitialSoftFallback || pendingCreatedAt) return;
  pendingCreatedAt = Date.now();
  if (__DEV__) console.info("[JobAds] pending created");
}

function clearPendingOpportunity() {
  pendingCreatedAt = 0;
}

export function useJobInterstitialManager() {
  const pendingNavigation = useRef<(() => void) | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isLoaded, isClosed, load, show } = useInterstitialAd(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });

  const ensureLoaded = useCallback(() => {
    if (!MONETIZATION.jobInterstitialEnabled || isLoaded) return;
    load();
  }, [isLoaded, load]);

  useEffect(() => {
    ensureLoaded();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") ensureLoaded();
    });
    return () => {
      subscription.remove();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [ensureLoaded]);

  useEffect(() => {
    if (!isClosed) return;
    releaseFullScreenAdSlot();
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    if (action) action();
    ensureLoaded();
  }, [ensureLoaded, isClosed]);

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) return;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      ensureLoaded();
    }, LOAD_RETRY_MS);
  }, [ensureLoaded]);

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

    const baseEligible = isJobInterstitialEligible(count);
    const pending = hasPendingOpportunity();
    const shouldAttempt = MONETIZATION.jobInterstitialEnabled && (baseEligible || pending);

    if (__DEV__) {
      console.info("[JobAds]", {
        count,
        baseEligible,
        pending,
        loaded: isLoaded,
        action: shouldAttempt ? "CHECK" : "NAVIGATE",
      });
    }

    if (!shouldAttempt) {
      navigateOnce();
      return;
    }

    if (!isLoaded) {
      if (baseEligible) createPendingOpportunity();
      if (__DEV__) console.info("[JobAds] action=NAVIGATE_NOT_READY", { count, pending: hasPendingOpportunity() });
      navigateOnce();
      ensureLoaded();
      scheduleRetry();
      return;
    }

    const claimed = await tryClaimInterstitialSlot("job-open");
    if (!claimed) {
      if (baseEligible) createPendingOpportunity();
      if (__DEV__) console.info("[JobAds] action=NAVIGATE_SAFETY", { count, pending: hasPendingOpportunity() });
      navigateOnce();
      return;
    }

    if (pending) clearPendingOpportunity();
    pendingNavigation.current = navigateOnce;

    try {
      if (__DEV__) console.info("[JobAds] action=SHOW", { count, baseEligible, usedPending: pending });
      await show();
    } catch (error) {
      releaseFullScreenAdSlot();
      if (baseEligible || pending) createPendingOpportunity();
      if (__DEV__) console.info("[JobAds] show failed", error);
      pendingNavigation.current = null;
      navigateOnce();
      ensureLoaded();
      scheduleRetry();
    }
  }, [ensureLoaded, isLoaded, scheduleRetry, show]);

  return { openJob };
}

export function useJobInterstitial(_jobId?: string) {
  const continueWithOptionalAd = useCallback((action: () => void) => action(), []);
  return { continueWithOptionalAd };
}

export function useEarlyJobInterstitial() {
  const openJobWithEarlyInterstitial = useCallback(async (action: () => void) => action(), []);
  return { openJobWithEarlyInterstitial };
}
