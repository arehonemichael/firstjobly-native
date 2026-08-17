import { TestIds } from "react-native-google-mobile-ads";

const PROD = {
  banner: "ca-app-pub-1505001993402465/3915348751",
  appOpen: "ca-app-pub-1505001993402465/8648800689",
  interstitial: "ca-app-pub-1505001993402465/4410223100",
  native: "ca-app-pub-1505001993402465/9578738973",
} as const;

export const AD_UNITS = {
  banner: __DEV__ ? TestIds.ADAPTIVE_BANNER : PROD.banner,
  appOpen: __DEV__ ? TestIds.APP_OPEN : PROD.appOpen,
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : PROD.interstitial,
  native: __DEV__ ? TestIds.NATIVE : PROD.native,
} as const;

export const AD_LIMITS = {
  minJobDetailsBeforeInterstitial: 8,
  interstitialCooldownMs: 15 * 60 * 1000,
  minAppLaunchesBeforeAppOpen: 3,
  appOpenCooldownMs: 4 * 60 * 60 * 1000,
} as const;
