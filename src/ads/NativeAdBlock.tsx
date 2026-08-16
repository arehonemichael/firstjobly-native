import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";

import { AD_UNITS } from "./config";

export function NativeAdBlock() {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let alive = true;
    let loadedAd: NativeAd | null = null;

    NativeAd.createForAdRequest(AD_UNITS.native)
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

  if (!nativeAd) return null;

  return (
    <View style={styles.outer}>
      <NativeAdView nativeAd={nativeAd} style={styles.card}>
        <View style={styles.topRow}>
          {nativeAd.icon ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
            </NativeAsset>
          ) : null}

          <View style={styles.copy}>
            <Text style={styles.sponsored}>Sponsored</Text>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={2}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
          </View>
        </View>

        <NativeMediaView style={styles.media} />

        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.body} numberOfLines={3}>
              {nativeAd.body}
            </Text>
          </NativeAsset>
        ) : null}

        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta}>{nativeAd.callToAction}</Text>
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
  card: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#FAFAFA",
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
  copy: {
    flex: 1,
  },
  sponsored: {
    fontSize: 11,
    fontWeight: "800",
    color: "#667085",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headline: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    color: "#0B1F30",
  },
  media: {
    width: "100%",
    height: 180,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  body: {
    marginTop: 10,
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#0B1F30",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
});
