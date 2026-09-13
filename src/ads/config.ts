import { TestIds } from "react-native-google-mobile-ads";

const PROD = {
  banner: "ca-app-pub-1505001993402465/3915348751",
  appOpen: "ca-app-pub-1505001993402465/8648800689",
  interstitial: "ca-app-pub-1505001993402465/4410223100",
  native: "ca-app-pub-1505001993402465/9578738973",
  rewardedDocument: "ca-app-pub-1505001993402465/5757806244",
} as const;

export const AD_UNITS = {
  banner: __DEV__ ? TestIds.ADAPTIVE_BANNER : PROD.banner,
  appOpen: __DEV__ ? TestIds.APP_OPEN : PROD.appOpen,
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : PROD.interstitial,
  native: __DEV__ ? TestIds.NATIVE : PROD.native,
  rewardedDocument: __DEV__ ? TestIds.REWARDED : PROD.rewardedDocument,
} as const;

export const AD_FEATURES = {
  banner: true,
  nativeFeed: true,
  nativeDetail: true,
  interstitial: true,
  rewardedDocument: true,
  appOpen: true,
} as const;

export const AD_APP_OPEN_TRIGGERS = [1, 2, 4, 6] as const;
export const AD_JOB_OPEN_TRIGGERS = [1, 2, 4, 6] as const;
export const AD_CADENCE_CYCLE_LENGTH = 6;

export function isAdCadenceTrigger(
  count: number,
  triggers: readonly number[],
  cycleLength = AD_CADENCE_CYCLE_LENGTH,
) {
  if (count <= 0) return false;
  const position = ((count - 1) % cycleLength) + 1;
  return triggers.includes(position);
}

export const AD_LIMITS = {
  minJobDetailsBeforeInterstitial: 4,
  interstitialChance: 0.2,
  interstitialCooldownMs: 45 * 1000,
  minAppLaunchesBeforeAppOpen: 1,
  appOpenCooldownMs: 45 * 1000,
} as const;
