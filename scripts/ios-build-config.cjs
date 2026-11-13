// Google's official iOS sample app, for first simulator/TestFlight testing only.
const IOS_SAMPLE_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const skAdNetworkItems = require("./admob-ios-skadnetwork.json");
const unitNames = ["BANNER", "APP_OPEN", "INTERSTITIAL", "NATIVE", "REWARDED"];
const appPattern = /^ca-app-pub-\d{16}~\d{10}$/;
const unitPattern = /^ca-app-pub-\d{16}\/\d{10}$/;
function configureIosAds(config, env, sample = IOS_SAMPLE_APP_ID) {
  const isIosProduction =
    env.EAS_BUILD_PLATFORM === "ios" &&
    ["production", "ios-production"].includes(env.EAS_BUILD_PROFILE);
  const appId = env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim() || sample;
  if (!appPattern.test(appId))
    throw Error(
      "EXPO_PUBLIC_ADMOB_IOS_APP_ID must be an iOS AdMob App ID containing ~.",
    );
  if (isIosProduction) {
    if (env.EXPO_PUBLIC_ADS_TEST_MODE === "true")
      throw Error(
        "Use ios-testflight for test ads; production iOS requires real iOS AdMob configuration.",
      );
    if (
      !env.EXPO_PUBLIC_ADMOB_IOS_APP_ID ||
      appId.startsWith("ca-app-pub-3940256099942544") ||
      appId === "ca-app-pub-1505001993402465~7846151022"
    ) {
      throw Error(
        "Production iOS requires your own iOS AdMob App ID. Create the iOS app in AdMob first; do not reuse Android IDs.",
      );
    }
    const rewardFormat = env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_FORMAT;
    if (
      rewardFormat &&
      !["rewarded", "rewarded-interstitial"].includes(rewardFormat)
    )
      throw Error(
        "EXPO_PUBLIC_ADMOB_IOS_REWARDED_FORMAT must be rewarded or rewarded-interstitial.",
      );
    for (const name of unitNames) {
      const value = env[`EXPO_PUBLIC_ADMOB_IOS_${name}_ID`]?.trim() || "";
      if (
        !unitPattern.test(value) ||
        value.startsWith("ca-app-pub-3940256099942544") ||
        !value.startsWith(appId.split("~")[0] + "/") ||
        ANDROID_UNITS.includes(value)
      ) {
        throw Error(
          `EXPO_PUBLIC_ADMOB_IOS_${name}_ID must be your real iOS ad unit from the same AdMob account (not Android or sample).`,
        );
      }
    }
  }
  return {
    ...config,
    plugins: (config.plugins || []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === "react-native-google-mobile-ads"
        ? [
            plugin[0],
            {
              ...plugin[1],
              iosAppId: appId,
              skAdNetworkItems: [
                ...new Set([
                  ...(plugin[1]?.skAdNetworkItems || []),
                  ...skAdNetworkItems,
                ]),
              ],
            },
          ]
        : plugin,
    ),
  };
}
const ANDROID_UNITS = [
  "3915348751",
  "8648800689",
  "4410223100",
  "9578738973",
  "9710408715",
].map((id) => `ca-app-pub-1505001993402465/${id}`);
module.exports = { IOS_SAMPLE_APP_ID, configureIosAds };
