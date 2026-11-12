import { StyleSheet, View } from "react-native";
import { mobileAdsSDK } from "./sdk";

import { AD_UNITS } from "./config";

export function AdBanner() {
  if (!mobileAdsSDK) return null;
  const { BannerAd, BannerAdSize } = mobileAdsSDK;
  return (
    <View style={styles.wrap}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
  },
});
