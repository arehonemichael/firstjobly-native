import Constants, { ExecutionEnvironment } from "expo-constants";
import { iosAdsConfigured } from "../ads/ios-units";
import { Platform } from "react-native";

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const nativeAdsPlatform = Platform.OS;
const iosTestAds =
  (typeof __DEV__ !== "undefined" && __DEV__) ||
  process.env.EXPO_PUBLIC_ADS_TEST_MODE === "true";
export const supportsNativeAds =
  !isExpoGo &&
  (Platform.OS === "android" ||
    (Platform.OS === "ios" && (iosTestAds || iosAdsConfigured)));
