import { useSyncExternalStore } from "react";
import { mobileAdsSDK } from "./sdk";
import { createAdConsent } from "./consent-controller";
const sdk = mobileAdsSDK;
export const adsPrivacy = createAdConsent(
  sdk
    ? {
        requestInfoUpdate: () => sdk.AdsConsent.requestInfoUpdate(),
        getConsentInfo: () => sdk.AdsConsent.getConsentInfo(),
        showFormIfRequired: () =>
          sdk.AdsConsent.loadAndShowConsentFormIfRequired(),
        showPrivacyOptions: () => sdk.AdsConsent.showPrivacyOptionsForm(),
        choices: () => sdk.AdsConsent.getUserChoices(),
        initialize: () => sdk.default().initialize(),
      }
    : null,
);
export function useAdsConsent() {
  return useSyncExternalStore(
    adsPrivacy.subscribe,
    adsPrivacy.getSnapshot,
    adsPrivacy.getSnapshot,
  );
}

/** Fail closed when consent/personalization could not be determined. */
export function getRequestOptions() {
  return adsPrivacy.getRequestOptions();
}

// Development diagnostics expose the real blocker without logging consent
// strings, identifiers or tokens. Never enable ads on an error alone.
if (__DEV__ || process.env.EXPO_PUBLIC_ADS_TEST_MODE === "true") {
  let reported: string | null = null;
  adsPrivacy.subscribe(() => {
    const error = adsPrivacy.getSnapshot().errorMessage;
    if (error && error !== reported) console.warn("[FirstJobly ads]", error);
    reported = error;
  });
}
