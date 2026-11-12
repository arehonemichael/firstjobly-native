import { useHomeHeroSession } from "../hooks/use-home-hero-session";
import { useReducedMotion } from "../hooks/use-reduced-motion";
import "../global.css";
import { View } from "react-native";
import { Colors, Layout } from "../constants/theme";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useCallback, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LaunchSplash } from "../components/launch-splash";
import { useAuth } from "../hooks/use-auth";

export default function RootLayout() {
  const reducedMotion = useReducedMotion();
  const auth = useAuth();
  useHomeHeroSession(auth.userId, auth.loading);
  const authAny = auth as any;
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const firstName =
    String(
      authAny?.user?.user_metadata?.full_name ??
        authAny?.user?.user_metadata?.name ??
        "",
    )
      .trim()
      .split(/\s+/)[0] || null;
  const authReady = !authAny?.loading;
  const finishLaunchSplash = useCallback(() => setShowLaunchSplash(false), []);
  const [fontsLoaded] = useFonts({
    FirstJoblyEditorial: require("../../assets/fonts/Lora-Variable.ttf"),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
  });

  if (!fontsLoaded) return null;

  if (showLaunchSplash) {
    return (
      <>
        <StatusBar style="dark" />
        <LaunchSplash
          firstName={firstName}
          ready={authReady}
          onDone={finishLaunchSplash}
        />
      </>
    );
  }
  return (
    <>
      <StatusBar style="dark" />

      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: Layout.content,
            alignSelf: "center",
          }}
        >
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
    </>
  );
}
