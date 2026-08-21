import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";

import { theme } from "../constants/theme";
import { AD_UNITS } from "./config";

type NativeAdBlockProps = {
  variant?: "detail" | "feed";
};

export function NativeAdBlock({ variant = "detail" }: NativeAdBlockProps) {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const compact = variant === "feed";

  useEffect(() => {
    let alive = true;
    let loadedAd: NativeAd | null = null;

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

  // Feed placements reserve the final card footprint while AdMob loads so the
  // surrounding job cards do not jump when the native creative arrives.
  if (!nativeAd) return compact ? <View style={styles.feedPlaceholder} /> : null;

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
    marginTop: 0,
    marginBottom: 0,
  },
  feedPlaceholder: {
    minHeight: 250,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 14,
    backgroundColor: theme.colors.background,
  },
  feedCard: {
    minHeight: 250,
    borderRadius: theme.radius.md,
    padding: 12,
    backgroundColor: theme.colors.surface,
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
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headline: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  feedHeadline: {
    fontSize: 14,
    lineHeight: 19,
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
    marginTop: 10,
    borderRadius: 10,
  },
  body: {
    marginTop: 10,
    color: theme.colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  feedBody: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  cta: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.ink,
    color: theme.colors.primaryForeground,
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  feedCta: {
    marginTop: 9,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
