/** Metro must not traverse native ad view/codegen modules on web, even when
 * config is imported for feed placement. No runtime SDK import on this path. */
export const mobileAdsSDK:
  | typeof import("react-native-google-mobile-ads")
  | null = null;
export const nativeAdsPlatform = "web";
