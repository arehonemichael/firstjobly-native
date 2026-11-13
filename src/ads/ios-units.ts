/** iOS units must be created for the iOS app. Never fall back to Android IDs.
 * Keep direct env references: Expo inlines EXPO_PUBLIC_* only in this form. */
export const IOS_PRODUCTION_UNITS = {
  banner: (process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID ?? "").trim(),
  appOpen: (process.env.EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_ID ?? "").trim(),
  interstitial: (
    process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID ?? ""
  ).trim(),
  native: (process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE_ID ?? "").trim(),
  rewarded: (process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID ?? "").trim(),
};
export const iosAdsConfigured =
  !!process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID &&
  Object.values(IOS_PRODUCTION_UNITS).every((value) =>
    /^ca-app-pub-\d{16}\/\d{10}$/.test(value),
  );
