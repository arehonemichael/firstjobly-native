import { adDiagnostics as diag } from "./diagnostics";
import { AppText as Text } from "../components/ui/primitives";
import { Colors } from "../constants/theme";
import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { NativeAd as NativeAdInstance } from "react-native-google-mobile-ads";
import { getRequestOptions, useAdsConsent } from "./privacy";
import { mobileAdsSDK } from "./sdk";

import { ADS_CONFIG, AD_UNITS } from "./config";

import { createAdRecovery, loadNativeWithTimeout } from "./recovery";

type NativeAdBlockProps = {
  variant?: "detail" | "feed";
};

export function NativeAdBlock(props: NativeAdBlockProps) {
  const consent = useAdsConsent();
  const enabled =
    props.variant === "feed"
      ? ADS_CONFIG.native.feedEnabled
      : ADS_CONFIG.native.detailEnabled;
  useEffect(() => {
    diag.record("placement", {
      format: "native",
      placement: props.variant || "detail",
      eligible: enabled && consent.canRequestAds && !!mobileAdsSDK,
      reason: !mobileAdsSDK
        ? "unsupported"
        : !enabled
          ? "disabled"
          : !consent.canRequestAds
            ? "consent"
            : "ready",
    });
  }, [enabled, consent.canRequestAds, props.variant]);
  return enabled && consent.canRequestAds && mobileAdsSDK ? (
    <AuthorizedNativeAd
      key={`${props.variant || "detail"}:${consent.personalized}`}
      {...props}
    />
  ) : null;
}
function AuthorizedNativeAd({ variant = "detail" }: NativeAdBlockProps) {
  const [nativeAd, setNativeAd] = useState<NativeAdInstance | null>(null);
  const compact = variant === "feed";

  const [failed, setFailed] = useState(false),
    [generation, setGeneration] = useState(0);
  const recovery = useMemo(
    () =>
      createAdRecovery([5000], () => {
        setNativeAd(null);
        setFailed(false);
        setGeneration((value) => value + 1);
      }),
    [],
  );
  useEffect(() => {
    recovery.reset();
    return () => recovery.dispose();
  }, [recovery]);
  useEffect(() => {
    if (!mobileAdsSDK) return;
    let removeImpression: (() => void) | undefined;
    diag.record("request", {
      format: "native",
      placement: variant,
      attempt: generation + 1,
    });
    const cancel = loadNativeWithTimeout(
      () =>
        mobileAdsSDK!.NativeAd.createForAdRequest(
          AD_UNITS.native,
          getRequestOptions(),
        ),
      (ad) => {
        diag.record("loaded", {
          format: "native",
          placement: variant,
          loaded: true,
        });
        try {
          const subscription = ad.addAdEventListener(
            mobileAdsSDK!.NativeAdEventType.IMPRESSION,
            () =>
              diag.record("impression", {
                format: "native",
                placement: variant,
              }),
          );
          removeImpression = () => subscription.remove();
        } catch {
          /* Observation must not turn a loaded ad into a failure. */
        }
        setNativeAd(ad);
        setFailed(false);
      },
      (error) => {
        if (error) diag.error("native", "load.failed", error);
        else
          diag.record("load.failed", {
            format: "native",
            placement: variant,
            reason: "timeout",
          });
        setFailed(true);
        recovery.failed();
      },
    );
    return () => {
      try {
        removeImpression?.();
      } catch {
        /* Cleanup still destroys inventory. */
      }
      cancel();
    };
  }, [generation, recovery, variant]);

  if (!nativeAd || !mobileAdsSDK)
    return compact && !failed ? (
      <View
        accessibilityLabel="Loading advertisement"
        style={{ minHeight: 260, marginVertical: 12 }}
      />
    ) : null;
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
