import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { Alert, Linking, Platform } from "react-native";

const SESSION_COUNT_KEY = "fj_app_session_count";
const RATE_PROMPT_SHOWN_KEY = "fj_rate_prompt_shown";
const ANDROID_PACKAGE = "com.first.firstjobly";

async function openPlayStore() {
  const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
  const webUrl = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

  try {
    const canOpenMarket = await Linking.canOpenURL(marketUrl);
    await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
}

export function RateUsPrompt() {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    let active = true;

    const checkSession = async () => {
      try {
        const [countRaw, shownRaw] = await Promise.all([
          AsyncStorage.getItem(SESSION_COUNT_KEY),
          AsyncStorage.getItem(RATE_PROMPT_SHOWN_KEY),
        ]);

        if (!active || shownRaw === "1") return;

        const sessionCount = Number(countRaw || 0) + 1;
        await AsyncStorage.setItem(SESSION_COUNT_KEY, String(sessionCount));

        if (sessionCount !== 4 || !active) return;

        // Mark it before showing so a reload/remount cannot duplicate the prompt.
        await AsyncStorage.setItem(RATE_PROMPT_SHOWN_KEY, "1");

        Alert.alert(
          "Enjoying FirstJobly?",
          "Your rating helps more South Africans discover FirstJobly.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Rate us",
              onPress: () => {
                void openPlayStore();
              },
            },
          ],
          { cancelable: true },
        );
      } catch (error) {
        if (__DEV__) console.warn("Rate prompt check failed", error);
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
