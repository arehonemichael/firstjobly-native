import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../components/ui/primitives";
import { Colors, Fonts, Radius } from "../constants/theme";
import { mobileAdsSDK } from "./sdk";
import { adsPrivacy, getRequestOptions, useAdsConsent } from "./privacy";
import { ADS_CONFIG, AD_UNITS } from "./config";
import { createBannerController } from "./recovery";

export function AdBanner({
  placement = "detail",
}: { placement?: "home" | "detail" | "hot" | "saved" } = {}) {
  const consent = useAdsConsent();
  const [width, setWidth] = useState(0);
  // Key the authorized child by permission, width and choices. Regrant/resize
  // gets fresh state instead of inheriting permanent no-fill from the old unit.
  if (!mobileAdsSDK || !ADS_CONFIG.banner.enabled) return null;
  return (
    <>
      {consent.canRequestAds && (
        <View
          onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
        >
          {width > 0 && (
            <AuthorizedBanner
              key={`${width}:${consent.personalized}`}
              width={width}
              placement={placement}
            />
          )}
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
function AuthorizedBanner({
  width,
  placement,
}: {
  width: number;
  placement: string;
}) {
  const [{ loaded, failed, generation }, setState] = useState({
    loaded: false,
    failed: false,
    generation: 0,
  });
  const [controller] = useState(() =>
    createBannerController(ADS_CONFIG.banner.retryBackoffMs, setState),
  );
  useEffect(() => {
    controller.start();
    return () => controller.dispose();
  }, [controller]);
  if (failed || !mobileAdsSDK || !ADS_CONFIG.banner.enabled) return null;
  const { BannerAd, BannerAdSize } = mobileAdsSDK;
  return (
    <>
      {!failed && (
        <View testID={`${placement}-ad-placement`} style={styles.section}>
          <Text style={styles.label}>Advertisement</Text>
          <View style={styles.inventory}>
            {!loaded && (
              <Text style={styles.loading} accessibilityLiveRegion="polite">
                Loading advertisement…
              </Text>
            )}
            {width > 0 && (
              <View style={{ opacity: loaded ? 1 : 0 }}>
                <BannerAd
                  key={generation}
                  unitId={AD_UNITS.banner}
                  size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                  width={Math.max(1, width - 26)}
                  requestOptions={getRequestOptions()}
                  onAdLoaded={() => controller.loaded(generation)}
                  onAdFailedToLoad={() => controller.failed(generation)}
                />
              </View>
            )}
          </View>
        </View>
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
