export const MONETIZATION = {
  jobInterstitialEnabled: true,
  jobInterstitialInterval: 2,
  jobInterstitialOffset: 1,
  jobInterstitialSoftFallback: true,
  fullScreenMinGapMs: 8 * 1000,
  pendingInterstitialExpiryMs: 10 * 60 * 1000,
  appOpenEnabled: true,
  appOpenCadenceTriggers: [1, 2, 4, 6] as const,
  appOpenCadenceCycleLength: 6,
  nativeFeedFirstAfter: 6,
  nativeFeedIntervalAfterFirst: 8,
  jobDetailNativeEnabled: true,
  bannerEnabled: true,
  rewardedEnabled: true,
} as const;

export function isJobInterstitialEligible(count: number) {
  const { jobInterstitialInterval, jobInterstitialOffset } = MONETIZATION;
  if (count <= 0 || jobInterstitialInterval <= 0) return false;
  return ((count - jobInterstitialOffset) % jobInterstitialInterval + jobInterstitialInterval) % jobInterstitialInterval === 0;
}

export function isAppOpenEligible(count: number) {
  if (count <= 0) return false;
  const position = ((count - 1) % MONETIZATION.appOpenCadenceCycleLength) + 1;
  return MONETIZATION.appOpenCadenceTriggers.includes(position as 1 | 2 | 4 | 6);
}
