import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../components/ui/primitives";
import { Colors, Fonts, Radius } from "../constants/theme";
import { mobileAdsSDK } from "./sdk";
import { adsPrivacy, useAdsConsent } from "./privacy";
import { AD_FEATURES, AD_UNITS } from "./config";

export function AdBanner({
  placement = "detail",
}: { placement?: "home" | "detail" } = {}) {
  const consent = useAdsConsent();
  const [width, setWidth] = useState(0),
    [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!consent.canRequestAds || !width || loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), 12000);
    return () => clearTimeout(timer);
  }, [consent.canRequestAds, width, loaded, failed]);
  if (!mobileAdsSDK || !AD_FEATURES.banner) return null;
  const { BannerAd, BannerAdSize } = mobileAdsSDK;
  return (
    <>
      {consent.canRequestAds && !failed && (
        <View
          testID={
            placement === "home" ? "home-ad-placement" : "detail-ad-placement"
          }
          style={styles.section}
        >
          <Text style={styles.label}>Advertisement</Text>
          <View
            style={styles.inventory}
            onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
          >
            {!loaded && (
              <Text style={styles.loading} accessibilityLiveRegion="polite">
                Loading advertisement…
              </Text>
            )}
            {width > 0 && (
              <View style={{ opacity: loaded ? 1 : 0 }}>
                <BannerAd
                  unitId={AD_UNITS.banner}
                  size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                  width={width}
                  requestOptions={{ requestNonPersonalizedAdsOnly: true }}
                  onAdLoaded={() => setLoaded(true)}
                  onAdFailedToLoad={() => setFailed(true)}
                />
              </View>
            )}
          </View>
        </View>
      )}
      {(consent.privacyRequired || consent.failed) && (
        <Pressable onPress={() => void adsPrivacy.openPrivacy(() => true)}>
          <Text style={styles.privacy}>Ad privacy choices</Text>
        </Pressable>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  section: {
    marginVertical: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  label: {
    fontFamily: Fonts.medium,
    color: Colors.muted,
    fontSize: 11,
    marginBottom: 8,
  },
  inventory: {
    minHeight: 90,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  loading: { position: "absolute", fontSize: 12, color: Colors.muted },
  privacy: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.muted },
});
