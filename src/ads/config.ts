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

export const ADS_CONFIG = {
  interstitial: {
    enabled: true,
    everyNthJobOpen: 3,
    cooldownMs: 240000,
    maxPerSession: 4,
    startTimeoutMs: 1500,
    safetyTimeoutMs: 120000,
    retryBackoffMs: [5000, 15000, 45000],
  },
  appOpen: {
    enabled: true,
    minLaunches: 2,
    cooldownMs: 3 * 60 * 60 * 1000,
    maxAdAgeMs: 3.5 * 60 * 60 * 1000,
  },
  fullscreenMinGapMs: 60000,
  banner: { enabled: true, retryBackoffMs: [30000, 60000, 120000] },
  native: {
    feedEnabled: true,
    detailEnabled: true,
    firstAfterIndex: 3,
    every: 6,
  },
} as const;

/** Zero-based item indices, independent of job IDs or pagination boundaries. */
export function shouldInsertNative(index: number) {
  const policy = ADS_CONFIG.native;
  return (
    policy.feedEnabled &&
    index >= policy.firstAfterIndex &&
    (index - policy.firstAfterIndex) % policy.every === 0
  );
}
