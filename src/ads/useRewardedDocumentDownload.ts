import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRewardedAd } from "react-native-google-mobile-ads";

import { AD_UNITS } from "./config";

type DownloadAction = () => void | Promise<void>;

const MAX_UNAVAILABLE_ATTEMPTS_BEFORE_FALLBACK = 2;

export function useRewardedDocumentDownload() {
  const pendingAction = useRef<DownloadAction | null>(null);
  const rewardEarned = useRef(false);
  const adInProgress = useRef(false);
  const unavailableAttempts = useRef(0);

  const {
    isLoaded,
    isClosed,
    isEarnedReward,
    error,
    load,
    show,
  } = useRewardedAd(AD_UNITS.rewardedDocument, {
    requestNonPersonalizedAdsOnly: true,
  });

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isLoaded) unavailableAttempts.current = 0;
  }, [isLoaded]);

  useEffect(() => {
    if (isEarnedReward) rewardEarned.current = true;
  }, [isEarnedReward]);

  useEffect(() => {
    if (!isClosed || !adInProgress.current) return;

    const action = pendingAction.current;
    const earned = rewardEarned.current;

    pendingAction.current = null;
    rewardEarned.current = false;
    adInProgress.current = false;

    if (earned && action) {
      unavailableAttempts.current = 0;
      void Promise.resolve(action()).catch((actionError) => {
        console.error("Rewarded document action failed:", actionError);
      });
    } else if (action) {
      Alert.alert(
        "Download not unlocked",
        "Watch the ad to completion to download your document.",
      );
    }

    load();
  }, [isClosed, load]);

  useEffect(() => {
    if (error) console.warn("Rewarded document ad failed to load:", error);
  }, [error]);

  const requestRewardedDownload = useCallback(
    async (action: DownloadAction) => {
      if (adInProgress.current || pendingAction.current) return;

      if (!isLoaded) {
        load();
        unavailableAttempts.current += 1;

        if (error && unavailableAttempts.current >= MAX_UNAVAILABLE_ATTEMPTS_BEFORE_FALLBACK) {
          Alert.alert(
            "Ad unavailable",
            "We couldn't load a rewarded ad after multiple attempts. You can download your document now or try the ad again.",
            [
              { text: "Try again", onPress: () => load() },
              {
                text: "Download now",
                onPress: () => {
                  unavailableAttempts.current = 0;
                  void Promise.resolve(action()).catch((actionError) => {
                    console.error("Rewarded document fallback action failed:", actionError);
                  });
                },
              },
            ],
          );
          return;
        }

        Alert.alert(
          "Ad still loading",
          error
            ? "The rewarded ad is unavailable right now. Please try again shortly."
            : "The rewarded ad is still loading. Please try again in a moment.",
          [{ text: "OK" }],
        );
        return;
      }

      unavailableAttempts.current = 0;
      rewardEarned.current = false;
      pendingAction.current = action;
      adInProgress.current = true;

      try {
        await show();
      } catch (showError) {
        console.error("Rewarded document ad failed to show:", showError);
        pendingAction.current = null;
        rewardEarned.current = false;
        adInProgress.current = false;
        load();
        Alert.alert(
          "Ad unavailable",
          "We couldn't show the rewarded ad. Please try again shortly.",
        );
      }
    },
    [error, isLoaded, load, show],
  );

  return {
    requestRewardedDownload,
    rewardedAdReady: isLoaded,
  };
}
