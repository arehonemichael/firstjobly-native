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
