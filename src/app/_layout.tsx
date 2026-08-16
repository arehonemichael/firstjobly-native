import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AdMobLifecycle } from "../ads/AdMobLifecycle";

export default function RootLayout() {
  return (
    <>
      <AdMobLifecycle />
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
