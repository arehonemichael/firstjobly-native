import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import mobileAds, {
  AdEventType,
  AppOpenAd,
} from "react-native-google-mobile-ads";

import {
  AD_APP_OPEN_TRIGGERS,
  AD_FEATURES,
  AD_UNITS,
  isAdCadenceTrigger,
} from "./config";
import { tryClaimInterstitialSlot } from "./interstitialGate";

const LAUNCH_COUNT_KEY = "fj_admob_launch_count";

let initializationPromise: Promise<unknown> | null = null;

function initializeAdsOnce() {
  if (!initializationPromise) {
    initializationPromise = mobileAds().initialize();
  }

  return initializationPromise;
}

export function AdMobLifecycle() {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const launchCount = useRef(0);
  const handledLaunchCount = useRef(0);
  const pendingShow = useRef(false);
  const loaded = useRef(false);
  const loadedAt = useRef(0);
  const adRef = useRef<ReturnType<typeof AppOpenAd.createForAdRequest> | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    void initializeAdsOnce().catch((error) => {
      if (__DEV__) console.warn("AdMob initialization failed", error);
    });

    if (!AD_FEATURES.appOpen) return;

    let mounted = true;

    const disposeAd = () => {
      cleanupRef.current.forEach((unsubscribe) => unsubscribe());
      cleanupRef.current = [];
      adRef.current?.removeAllListeners();
      adRef.current = null;
      loaded.current = false;
      loadedAt.current = 0;
    };

    async function maybeShow() {
      const currentLaunchCount = launchCount.current;
      if (
        currentLaunchCount <= 0 ||
        handledLaunchCount.current === currentLaunchCount ||
        !isAdCadenceTrigger(currentLaunchCount, AD_APP_OPEN_TRIGGERS)
      ) {
        return;
      }

      const now = Date.now();
      const adAge = now - loadedAt.current;
      if (loadedAt.current > 0 && adAge > 3.5 * 60 * 60 * 1000) {
        pendingShow.current = true;
        createAndLoad();
        return;
      }

      if (!loaded.current || !adRef.current) {
        pendingShow.current = true;
        if (!adRef.current) createAndLoad();
        return;
      }

      pendingShow.current = false;
      handledLaunchCount.current = currentLaunchCount;

      const claimed = await tryClaimInterstitialSlot();
      if (!claimed || !mounted || !adRef.current) return;

      loaded.current = false;

      try {
        await adRef.current.show();
      } catch (error) {
        if (__DEV__) console.warn("App-open ad show failed", error);
        if (mounted) createAndLoad();
      }
    }

    function createAndLoad() {
      disposeAd();

      const ad = AppOpenAd.createForAdRequest(AD_UNITS.appOpen, {
        requestNonPersonalizedAdsOnly: true,
      });

      adRef.current = ad;
      cleanupRef.current = [
        ad.addAdEventListener(AdEventType.LOADED, () => {
          loaded.current = true;
          loadedAt.current = Date.now();
          if (pendingShow.current) void maybeShow();
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          loaded.current = false;
          loadedAt.current = 0;
          if (mounted) createAndLoad();
        }),
        ad.addAdEventListener(AdEventType.ERROR, () => {
          loaded.current = false;
          loadedAt.current = 0;
          pendingShow.current = false;
        }),
      ];

      ad.load();
    }

    const bootstrap = async () => {
      await initializeAdsOnce();
      if (!mounted) return;

      const currentRaw = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
      const current = Number(currentRaw || 0);
      const nextCount = (Number.isFinite(current) ? current : 0) + 1;

      launchCount.current = nextCount;
      await AsyncStorage.setItem(LAUNCH_COUNT_KEY, String(nextCount));

      createAndLoad();
      void maybeShow();
    };

    void bootstrap();

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground =
        appState.current === "background" || appState.current === "inactive";

      appState.current = nextState;

      if (wasBackground && nextState === "active") {
        void maybeShow();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      disposeAd();
    };
  }, []);

  return null;
}
