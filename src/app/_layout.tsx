import "../global.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Colors, Layout } from "../constants/theme";
import { LaunchSplash } from "../components/launch-splash";
import { useAuth } from "../hooks/use-auth";
import { useHomeHeroSession } from "../hooks/use-home-hero-session";
import { useMotionPreference } from "../hooks/use-reduced-motion";

// Hold only until our first branded frame is laid out, not until network data.
if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  SplashScreen.setOptions({ fade: false, duration: 0 });
}

// Memory-only launch latch also covers navigator-driven root remounts.
let launchCompleted = false;

export default function RootLayout() {
  const { reducedMotion, motionReady } = useMotionPreference();
  const auth = useAuth();
  useHomeHeroSession(auth.userId, auth.loading || !!auth.error);
  const [showLaunchSplash, setShowLaunchSplash] = useState(
    () => !launchCompleted,
  );
  const finishLaunchSplash = useCallback(() => {
    launchCompleted = true;
    setShowLaunchSplash(false);
  }, []);
  const [fontsLoaded, fontError] = useFonts({
    FirstJoblyEditorial: require("../../assets/fonts/Lora-Variable.ttf"),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
  });
  const [fontDeadlineElapsed, setFontDeadlineElapsed] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontDeadlineElapsed(true), 4000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);
  const nativeHandoff = useRef(false);
  const onLayout = useCallback(() => {
    if (Platform.OS === "web" || nativeHandoff.current) return;
    nativeHandoff.current = true;
    try {
      SplashScreen.hide();
    } catch {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, []);
  const ready =
    !auth.loading &&
    !auth.error &&
    (fontsLoaded || !!fontError || fontDeadlineElapsed);
  return (
    <>
      <StatusBar style="dark" />
      <View style={stylesPage} onLayout={onLayout}>
        <View
          testID="application-shell"
          style={[stylesPage, { opacity: ready || !showLaunchSplash ? 1 : 0 }]}
          pointerEvents={showLaunchSplash ? "none" : "auto"}
          accessibilityElementsHidden={showLaunchSplash}
          importantForAccessibility={
            showLaunchSplash ? "no-hide-descendants" : "auto"
          }
          {...(Platform.OS === "web"
            ? {
                inert: showLaunchSplash ? true : undefined,
                dataSet: { startupReady: String(ready) },
              }
            : {})}
        >
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: Layout.content,
              alignSelf: "center",
            }}
          >
            {/* Keep the navigator mounted so initial deep links and auth return URLs survive startup. */}
            <Stack
              screenOptions={{
                headerShown: false,
                animation: reducedMotion ? "none" : "slide_from_right",
                contentStyle: { backgroundColor: Colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="jobs/[id]" />
              <Stack.Screen name="auth" options={{ presentation: "modal" }} />
            </Stack>
          </View>
        </View>
        {showLaunchSplash && (
          <LaunchSplash
            ready={ready}
            fontsReady={fontsLoaded}
            reducedMotion={reducedMotion}
            motionReady={motionReady}
            error={auth.error}
            onRetry={auth.retry}
            onDone={finishLaunchSplash}
          />
        )}
      </View>
    </>
  );
}
const stylesPage = { flex: 1, backgroundColor: Colors.background } as const;
