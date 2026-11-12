import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const supportsNativeAds = Platform.OS !== "web" && !isExpoGo;
