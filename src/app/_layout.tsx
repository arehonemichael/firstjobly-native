import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AdMobLifecycle } from "../ads/AdMobLifecycle";
import { RateUsPrompt } from "../components/RateUsPrompt";

export default function RootLayout() {
  return (
    <>
      <AdMobLifecycle />
      <RateUsPrompt />
      <StatusBar style="dark" />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="jobs/[id]" />
        <Stack.Screen
          name="auth"
          options={{ presentation: "modal" }}
        />
      </Stack>
    </>
  );
}
