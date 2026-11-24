import { fullscreenLock } from "../../ads/fullscreen-lock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo";
import { Linking, Platform } from "react-native";
import { isExpoGo } from "../runtime-environment";
import { createReviewController } from "./controller";
import { reviewLink } from "./store-links";
const key = "fj-review-engagement:v1";
const supported =
  (Platform.OS === "ios" || Platform.OS === "android") && !isExpoGo;
const native = async () => {
  if (!supported) return null;
  const module = requireOptionalNativeModule<{
    requestReview?: unknown;
    isAvailableAsync?: unknown;
  }>("ExpoStoreReview");
  if (
    typeof module?.requestReview !== "function" ||
    typeof module?.isAvailableAsync !== "function"
  )
    return null;
  return import("expo-store-review");
};
export const reviewPrompts = createReviewController({
  supported,
  version:
    Constants.nativeAppVersion || Constants.expoConfig?.version || "unknown",
  now: Date.now,
  read: () => AsyncStorage.getItem(key),
  write: (value) => AsyncStorage.setItem(key, value),
  available: async () => (await native())?.isAvailableAsync() ?? false,
  request: async (guard) => {
    const sdk = await native();
    if (!sdk || !(await sdk.isAvailableAsync()) || !guard()) return;
    if (!fullscreenLock.tryAcquire("store-review")) return;
    // Android may resolve only when the sheet closes; a broken callback must
    // never reserve the shared ad lock or metadata queue indefinitely.
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fullscreenLock.release("store-review");
        resolve();
      };
      const timer = setTimeout(finish, 60000);
      try {
        void sdk.requestReview().then(finish, finish);
      } catch {
        finish();
      }
    });
  },
});
export async function openReviewStore(store: "ios" | "android") {
  reviewPrompts.manualAttempt();
  if (store === "android" && Platform.OS === "android") {
    try {
      await Linking.openURL(
        "market://details?id=com.first.firstjobly&showAllReviews=true",
      );
      return;
    } catch {
      /* Devices without Play Store can use the public listing. */
    }
  }
  await Linking.openURL(reviewLink(store));
}
