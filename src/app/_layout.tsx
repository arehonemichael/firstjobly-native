import "../global.css";
import { View } from "react-native";
import { Colors, Layout } from "../constants/theme";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useCallback, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LaunchSplash } from "../components/launch-splash";
import { useAuth } from "../hooks/use-auth";

export default function RootLayout() {
  const auth = useAuth();
  const authAny = auth as any;
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const firstName = String(authAny?.user?.user_metadata?.full_name ?? authAny?.user?.user_metadata?.name ?? "").trim().split(/\s+/)[0] || null;
  const authReady = !authAny?.loading;
  const finishLaunchSplash = useCallback(() => setShowLaunchSplash(false), []);
  const [fontsLoaded] = useFonts({
    FirstJoblyEditorial: require("../../assets/fonts/Lora-Variable.ttf"),
    FirstJoblyEditorialItalic: require("../../assets/fonts/Lora-Italic-Variable.ttf"),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  if (showLaunchSplash) {
    return (
      <>
        <StatusBar style="light" />
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

      <View style={{ flex: 1, backgroundColor: Colors.background }}><View style={{ flex: 1, width: "100%", maxWidth: Layout.content, alignSelf: "center" }}><Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="jobs/[id]" />
        <Stack.Screen
          name="auth"
          options={{ presentation: "modal" }}
        />
      </Stack></View></View>
    </>
  );
}





