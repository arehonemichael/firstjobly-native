import { mobileAdsSDK } from "./sdk";
const TestIds = mobileAdsSDK?.TestIds;

const PROD = {
  banner: "ca-app-pub-1505001993402465/3915348751",
  appOpen: "ca-app-pub-1505001993402465/8648800689",
  interstitial: "ca-app-pub-1505001993402465/4410223100",
  native: "ca-app-pub-1505001993402465/9578738973",
} as const;

export const ADS_TEST_MODE =
  __DEV__ || process.env.EXPO_PUBLIC_ADS_TEST_MODE === "true";

export const AD_UNITS = {
  banner: ADS_TEST_MODE ? (TestIds?.ADAPTIVE_BANNER ?? "") : PROD.banner,
  appOpen: ADS_TEST_MODE ? (TestIds?.APP_OPEN ?? "") : PROD.appOpen,
  interstitial: ADS_TEST_MODE
    ? (TestIds?.INTERSTITIAL ?? "")
    : PROD.interstitial,
  native: ADS_TEST_MODE ? (TestIds?.NATIVE ?? "") : PROD.native,
} as const;

export const AD_FEATURES = {
  banner: true,
  nativeFeed: true,
  nativeDetail: true,
  interstitial: true,
  appOpen: true,
} as const;

export const AD_LIMITS = {
  minJobDetailsBeforeInterstitial: 4,
  interstitialChance: 0.2,
  interstitialCooldownMs: 20 * 60 * 1000,
  minAppLaunchesBeforeAppOpen: 3,
  appOpenCooldownMs: 4 * 60 * 60 * 1000,
} as const;
