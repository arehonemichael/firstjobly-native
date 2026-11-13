import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLayoutEffect, useRef } from "react";
import { AppState, Linking } from "react-native";
import { mobileAdsSDK } from "./sdk";
import { adsPrivacy, getRequestOptions, useAdsConsent } from "./privacy";
import { createAppOpenController } from "./app-open-controller";
import { ADS_CONFIG, AD_UNITS } from "./config";
import { setInteractionObserver } from "../lib/user-interaction";
import { getHomeProfile } from "../lib/recommendations/api";

// One controller/subscription per JS app session, including navigator root remounts.
let runtime: ReturnType<typeof createAppOpenController> | null = null;
let subscription: { remove(): void } | null = null;
let privacySubscription: (() => void) | null = null;
let links: { remove(): void } | null = null;
let route = {
  ready: false,
  home: false,
  onboarded: false,
  owner: null as symbol | null,
};
const canPresentConsent = () =>
  route.ready && route.home && AppState.currentState === "active";
function syncContext(preload = true) {
  runtime?.setContext(
    {
      eligible:
        canPresentConsent() &&
        route.onboarded &&
        !adsPrivacy.getSnapshot().presenting &&
        Date.now() - adsPrivacy.getSnapshot().lastUiAt > 1000,
      consent: adsPrivacy.getSnapshot().canRequestAds,
    },
    preload,
  );
}
function ensureRuntime() {
  if (runtime || !mobileAdsSDK) return;
  const sdk = mobileAdsSDK;
  runtime = createAppOpenController({
    storage: AsyncStorage,
    minLaunches: ADS_CONFIG.appOpen.minLaunches,
    cooldownMs: ADS_CONFIG.appOpen.cooldownMs,
    maxAgeMs: ADS_CONFIG.appOpen.maxAdAgeMs,
    createAd: () => {
      const native = sdk.AppOpenAd.createForAdRequest(
        AD_UNITS.appOpen,
        getRequestOptions(),
      );
      return {
        load: () => native.load(),
        show: () => native.show(),
        removeAllListeners: () => native.removeAllListeners(),
        addAdEventListener: (event, handler) =>
          native.addAdEventListener(
            event === "loaded"
              ? sdk.AdEventType.LOADED
              : event === "closed"
                ? sdk.AdEventType.CLOSED
                : sdk.AdEventType.ERROR,
            handler,
          ),
      };
    },
  });
  privacySubscription = adsPrivacy.subscribe(() => syncContext());
  setInteractionObserver(markAdInteraction);
  syncContext();
  void runtime.initialize();
  links = Linking.addEventListener("url", () => runtime?.markInteraction());
  let previousState = AppState.currentState;
  let backgrounded = false;
  subscription = AppState.addEventListener("change", (next) => {
    if (next === "background") backgrounded = true;
    const wasAway = previousState !== "active";
    previousState = next;
    if (next === "active" && wasAway) {
      if (backgrounded) void adsPrivacy.retryOnForeground(canPresentConsent);
      backgrounded = false;
      if (canPresentConsent()) void adsPrivacy.prepare(canPresentConsent);
    }
    syncContext(false);
    runtime?.onState(next);
  });
}
export function markAdInteraction() {
  runtime?.markInteraction();
}
export function disposeAdvertisingRuntime() {
  privacySubscription?.();
  privacySubscription = null;
  setInteractionObserver(null);
  links?.remove();
  links = null;
  subscription?.remove();
  subscription = null;
  runtime?.dispose();
  runtime = null;
  route = { ready: false, home: false, onboarded: false, owner: null };
}
/** Cold launches never wait for ads; inventory is only offered in a bounded guard window on
 * a later real foreground event, before Home interaction and outside sensitive flows. */
export function AdMobLifecycle({
  ready = false,
  pathname = "",
  userId = null,
}: { ready?: boolean; pathname?: string; userId?: string | null } = {}) {
  const consent = useAdsConsent(),
    owner = useRef(Symbol("ad-root"));
  const home =
    pathname === "/" || pathname === "/(tabs)" || pathname === "/(tabs)/index";
  useLayoutEffect(() => {
    if (!mobileAdsSDK) return;
    const token = owner.current;
    let active = true;
    route = { ready, home, onboarded: false, owner: token };
    ensureRuntime();
    syncContext();
    if (canPresentConsent()) void adsPrivacy.prepare(canPresentConsent);
    if (ready && home && userId)
      void getHomeProfile(userId)
        .then((profile) => {
          if (active && route.owner === token) {
            route.onboarded = profile?.onboarding_completed === true;
            syncContext();
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (route.owner === token) {
        route.ready = false;
        syncContext();
      }
    };
  }, [ready, home, userId, consent.canRequestAds]);
  return null;
}
