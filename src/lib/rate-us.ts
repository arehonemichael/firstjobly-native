import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Platform } from "react-native";
import * as StoreReview from "expo-store-review";

const SESSION_COUNT_KEY = "firstjobly.review.session-count.v1";
const LAST_REQUEST_AT_KEY = "firstjobly.review.last-request-at.v1";
const REQUEST_COUNT_KEY = "firstjobly.review.request-count.v1";

const MIN_SESSIONS = 2;
const MAX_REQUEST_ATTEMPTS = 3;
const REQUEST_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const ANDROID_PACKAGE = "com.first.firstjobly";

let requestInFlight = false;

function parseStoredNumber(value: string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function recordAppSession() {
  try {
    const current = parseStoredNumber(await AsyncStorage.getItem(SESSION_COUNT_KEY));
    await AsyncStorage.setItem(SESSION_COUNT_KEY, String(current + 1));
  } catch (error) {
    console.warn("Rate Us session tracking failed:", error);
  }
}

async function openStoreReviewFallback() {
  const configuredStoreUrl = StoreReview.storeUrl();
  if (configuredStoreUrl) {
    await Linking.openURL(configuredStoreUrl);
    return;
  }

  if (Platform.OS === "android") {
    const marketUrl = `market://details?id=${ANDROID_PACKAGE}&showAllReviews=true`;
    const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&showAllReviews=true`;
    try {
      const canOpenMarket = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
      return;
    } catch {
      await Linking.openURL(webUrl);
      return;
    }
  }
}

export async function maybeRequestReviewAfterSuccessfulApply() {
  if (requestInFlight) return false;
  requestInFlight = true;

  try {
    const [sessionRaw, lastRequestRaw, requestCountRaw] = await Promise.all([
      AsyncStorage.getItem(SESSION_COUNT_KEY),
      AsyncStorage.getItem(LAST_REQUEST_AT_KEY),
      AsyncStorage.getItem(REQUEST_COUNT_KEY),
    ]);

    const sessions = parseStoredNumber(sessionRaw);
    const lastRequestAt = parseStoredNumber(lastRequestRaw);
    const requestCount = parseStoredNumber(requestCountRaw);

    if (sessions < MIN_SESSIONS) return false;
    if (requestCount >= MAX_REQUEST_ATTEMPTS) return false;
    if (lastRequestAt > 0 && Date.now() - lastRequestAt < REQUEST_COOLDOWN_MS) return false;

    const available = await StoreReview.isAvailableAsync();

    if (!available) {
      await openStoreReviewFallback();
      await AsyncStorage.multiSet([
        [LAST_REQUEST_AT_KEY, String(Date.now())],
        [REQUEST_COUNT_KEY, String(requestCount + 1)],
      ]);
      return true;
    }

    // Google Play intentionally does not report whether the review card was
    // actually displayed, so track our request attempt and allow another only
    // after a long cooldown rather than permanently marking the user as shown.
    await StoreReview.requestReview();
    await AsyncStorage.multiSet([
      [LAST_REQUEST_AT_KEY, String(Date.now())],
      [REQUEST_COUNT_KEY, String(requestCount + 1)],
    ]);
    return true;
  } catch (error) {
    console.warn("Rate Us request failed:", error);
    return false;
  } finally {
    requestInFlight = false;
  }
}
