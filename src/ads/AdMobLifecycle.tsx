import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import mobileAds, { AdEventType, AppOpenAd } from "react-native-google-mobile-ads";

import { AD_UNITS } from "./config";
import { releaseFullScreenAdSlot, tryClaimInterstitialSlot } from "./interstitialGate";
import { MONETIZATION, isAppOpenEligible } from "./monetizationConfig";

const LAUNCH_COUNT_KEY = "fj_admob_launch_count";
const MIN_BACKGROUND_MS = 30_000;

let initializationPromise: Promise<unknown> | null = null;

function initializeAdsOnce() {
  if (!initializationPromise) initializationPromise = mobileAds().initialize();
  return initializationPromise;
}

export function AdMobLifecycle() {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAt = useRef(0);
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
    if (!MONETIZATION.appOpenEnabled) return;

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
        !isAppOpenEligible(currentLaunchCount)
      ) return;

      if (__DEV__) console.info("[AppOpen] eligible", { count: currentLaunchCount, loaded: loaded.current });

      const now = Date.now();
      const adAge = now - loadedAt.current;
      if (loadedAt.current > 0 && adAge > 3.5 * 60 * 60 * 1000) {
        pendingShow.current = true;
        createAndLoad();
        return;
      }

      if (!loaded.current || !adRef.current) {
        pendingShow.current = false;
        if (__DEV__) console.info("[AppOpen] not ready", { count: currentLaunchCount });
        if (!adRef.current) createAndLoad();
        return;
      }

      handledLaunchCount.current = currentLaunchCount;
      const claimed = await tryClaimInterstitialSlot("app-open");
      if (!claimed || !mounted || !adRef.current) {
        if (__DEV__) console.info("[AppOpen] blocked by safety", { count: currentLaunchCount });
        return;
      }

      pendingShow.current = false;
      loaded.current = false;
      try {
        if (__DEV__) console.info("[AppOpen] show", { count: currentLaunchCount });
        await adRef.current.show();
      } catch (error) {
        releaseFullScreenAdSlot();
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
          releaseFullScreenAdSlot();
          loaded.current = false;
          loadedAt.current = 0;
          if (mounted) createAndLoad();
        }),
        ad.addAdEventListener(AdEventType.ERROR, () => {
          releaseFullScreenAdSlot();
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
      const previous = appState.current;
      if (nextState === "background") backgroundedAt.current = Date.now();
      appState.current = nextState;

      if ((previous === "background" || previous === "inactive") && nextState === "active") {
        const backgroundDuration = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        if (backgroundDuration >= MIN_BACKGROUND_MS && !loaded.current && !adRef.current) createAndLoad();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      releaseFullScreenAdSlot();
      disposeAd();
    };
  }, []);

  return null;
}
