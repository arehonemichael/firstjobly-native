/* eslint-disable @typescript-eslint/no-require-imports -- Metro must gate native SDK evaluation synchronously. */
import { supportsNativeAds } from "../lib/runtime-environment";

// A static import evaluates TurboModuleRegistry before a component can guard it.
// Keep the require behind the runtime boundary; Metro still includes the SDK for
// custom native builds, while Expo Go/web never evaluate its native entry point.
export const mobileAdsSDK:
  typeof import("react-native-google-mobile-ads") | null = supportsNativeAds
  ? require("react-native-google-mobile-ads")
  : null;
