import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import mobileAds, {
  AdEventType,
  AppOpenAd,
  type AppOpenAd as AppOpenAdInstance,
} from "react-native-google-mobile-ads";

import { AD_LIMITS, AD_UNITS } from "./config";

const LAUNCH_COUNT_KEY = "fj_admob_launch_count";
const LAST_APP_OPEN_KEY = "fj_admob_last_app_open";

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
  const loaded = useRef(false);
  const loadedAt = useRef(0);
  const adRef = useRef<AppOpenAdInstance | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    let mounted = true;

    const disposeAd = () => {
      cleanupRef.current.forEach((remove) => remove());
      cleanupRef.current = [];
      adRef.current = null;
      loaded.current = false;
      loadedAt.current = 0;
    };

    const createAndLoad = () => {
      disposeAd();

      const ad = AppOpenAd.createForAdRequest(AD_UNITS.appOpen, {
        requestNonPersonalizedAdsOnly: true,
      });

      adRef.current = ad;

      cleanupRef.current = [
        ad.addAdEventListener(AdEventType.LOADED, () => {
          loaded.current = true;
          loadedAt.current = Date.now();
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          loaded.current = false;
          loadedAt.current = 0;
          if (mounted) createAndLoad();
        }),
        ad.addAdEventListener(AdEventType.ERROR, () => {
          loaded.current = false;
          loadedAt.current = 0;
        }),
      ].map((subscription) => () => subscription.remove());

      ad.load();
    };

    const maybeShow = async () => {
      if (launchCount.current < AD_LIMITS.minAppLaunchesBeforeAppOpen) return;

      const lastShownRaw = await AsyncStorage.getItem(LAST_APP_OPEN_KEY);
      const lastShown = Number(lastShownRaw || 0);
      const now = Date.now();

      if (now - lastShown < AD_LIMITS.appOpenCooldownMs) return;

      const adAge = now - loadedAt.current;
      if (adAge > 3.5 * 60 * 60 * 1000) {
        createAndLoad();
        return;
      }

      if (!loaded.current || !adRef.current) {
        createAndLoad();
        return;
      }

      loaded.current = false;
      await AsyncStorage.setItem(LAST_APP_OPEN_KEY, String(now));
      adRef.current.show();
    };

    const bootstrap = async () => {
      await initializeAdsOnce();
      if (!mounted) return;

      const currentRaw = await AsyncStorage.getItem(LAUNCH_COUNT_KEY);
      const nextCount = Number(currentRaw || 0) + 1;
      launchCount.current = nextCount;
      await AsyncStorage.setItem(LAUNCH_COUNT_KEY, String(nextCount));

      // Preload only. Never show an app-open ad on this cold start.
      createAndLoad();
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
