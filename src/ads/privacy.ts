import { useSyncExternalStore } from "react";
import { mobileAdsSDK } from "./sdk";
import { createAdConsent } from "./consent-controller";
const sdk = mobileAdsSDK;
export const adsPrivacy = createAdConsent(
  sdk
    ? {
        requestInfoUpdate: () => sdk.AdsConsent.requestInfoUpdate(),
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
