import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLayoutEffect, useRef } from "react";
import Constants from "expo-constants";
import { isExpoGo, supportsNativeAds } from "../lib/runtime-environment";
import { adDiagnostics as diag } from "./diagnostics";
import { AppState, Linking, Platform } from "react-native";
import { mobileAdsSDK } from "./sdk";
import { adsPrivacy, getRequestOptions, useAdsConsent } from "./privacy";
import { createAppOpenController } from "./app-open-controller";
import { ADS_CONFIG, ADS_TEST_MODE, AD_UNITS } from "./config";
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
  const consent = adsPrivacy.getSnapshot();
  const consentUiBlocked =
    consent.presenting || Date.now() - consent.lastUiAt <= 1000;
  const eligible = canPresentConsent() && route.onboarded && !consentUiBlocked;
  diag.record(
    "placement",
    {
      format: "app-open",
      eligible: eligible && consent.canRequestAds,
      reason: !route.ready
        ? "startup"
        : !route.home
          ? "not-home"
          : AppState.currentState !== "active"
            ? "not-active"
            : !route.onboarded
              ? "onboarding-unconfirmed"
              : !consent.canRequestAds
                ? "consent"
                : consentUiBlocked
                  ? "consent-ui-guard"
                  : "guarded-foreground-only",
    },
    true,
  );
  runtime?.setContext({ eligible, consent: consent.canRequestAds }, preload);
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
                : event === "opened"
                  ? sdk.AdEventType.OPENED
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
    diag.record(
      "runtime",
      {
        platform: Platform.OS,
        build: isExpoGo
          ? "expo-go"
          : __DEV__
            ? "development-client"
            : "release",
        supported: supportsNativeAds,
        sdkAvailable: !!mobileAdsSDK,
        testMode: ADS_TEST_MODE,
        appVersion: Constants.nativeAppVersion || "unknown",
        nativeBuildVersion: Constants.nativeBuildVersion || "unknown",
      },
      true,
    );
    for (const [format, enabled, unit] of [
      ["banner", ADS_CONFIG.banner.enabled, AD_UNITS.banner],
      ["native-feed", ADS_CONFIG.native.feedEnabled, AD_UNITS.native],
      ["native-detail", ADS_CONFIG.native.detailEnabled, AD_UNITS.native],
      ["interstitial", ADS_CONFIG.interstitial.enabled, AD_UNITS.interstitial],
      ["app-open", ADS_CONFIG.appOpen.enabled, AD_UNITS.appOpen],
    ] as const)
      diag.record(
        "format",
        {
          format,
          enabled,
          unitMode: ADS_TEST_MODE ? "official-test" : "production",
          hasUnit: !!unit,
        },
        true,
      );
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
