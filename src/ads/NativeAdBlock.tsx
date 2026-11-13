import { AppText as Text } from "../components/ui/primitives";
import { Colors } from "../constants/theme";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { NativeAd as NativeAdInstance } from "react-native-google-mobile-ads";
import { useAdsConsent } from "./privacy";
import { mobileAdsSDK } from "./sdk";

import { AD_UNITS } from "./config";

type NativeAdBlockProps = {
  variant?: "detail" | "feed";
};

export function NativeAdBlock(props: NativeAdBlockProps) {
  const consent = useAdsConsent();
  return consent.canRequestAds && mobileAdsSDK ? (
    <AuthorizedNativeAd {...props} />
  ) : null;
}
function AuthorizedNativeAd({ variant = "detail" }: NativeAdBlockProps) {
  const [nativeAd, setNativeAd] = useState<NativeAdInstance | null>(null);
  const compact = variant === "feed";

  useEffect(() => {
    if (!mobileAdsSDK) return;
    const { NativeAd } = mobileAdsSDK;
    let alive = true;
    let loadedAd: NativeAdInstance | null = null;

    NativeAd.createForAdRequest(AD_UNITS.native, {
      requestNonPersonalizedAdsOnly: true,
    })
      .then((ad) => {
        loadedAd = ad;
        if (alive) setNativeAd(ad);
        else ad.destroy();
      })
      .catch((error) => {
        if (__DEV__) console.warn("Native ad failed to load", error);
      });

    return () => {
      alive = false;
      loadedAd?.destroy();
    };
  }, []);

  if (!nativeAd || !mobileAdsSDK) return null;
  const { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } =
    mobileAdsSDK;

  return (
    <View style={[styles.outer, compact && styles.feedOuter]}>
      <NativeAdView
        nativeAd={nativeAd}
        style={[styles.card, compact && styles.feedCard]}
      >
        <View style={styles.topRow}>
          {nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={[styles.icon, compact && styles.feedIcon]}
              />
            </NativeAsset>
          ) : null}

          <View style={styles.copy}>
            <Text style={styles.sponsored}>Sponsored</Text>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text
                style={[styles.headline, compact && styles.feedHeadline]}
                numberOfLines={2}
              >
                {nativeAd.headline}
              </Text>
            </NativeAsset>
          </View>
        </View>

        <NativeMediaView style={[styles.media, compact && styles.feedMedia]} />

        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text
              style={[styles.body, compact && styles.feedBody]}
              numberOfLines={compact ? 2 : 3}
            >
              {nativeAd.body}
            </Text>
          </NativeAsset>
        ) : null}

        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={[styles.cta, compact && styles.feedCta]}>
              {nativeAd.callToAction}
            </Text>
          </NativeAsset>
        ) : null}
      </NativeAdView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  feedOuter: {
    paddingHorizontal: 0,
    marginTop: 12,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: Colors.background,
  },
  feedCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.surface,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  feedIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  copy: {
    flex: 1,
  },
  sponsored: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
    textTransform: "none",
    letterSpacing: 0,
    marginBottom: 4,
  },
  headline: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: Colors.foreground,
  },
  feedHeadline: {
    fontSize: 14,
    lineHeight: 20,
  },
  media: {
    width: "100%",
    height: 180,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  feedMedia: {
    height: 120,
    marginTop: 12,
    borderRadius: 10,
  },
  body: {
    marginTop: 12,
    color: Colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  feedBody: {
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
  },
  cta: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: Colors.foreground,
    color: Colors.surface,
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    overflow: "hidden",
  },
  feedCta: {
    marginTop: 8,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
