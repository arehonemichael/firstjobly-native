import { WeeklyReminderCard } from "../components/weekly-reminders";
import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { AppText as Text } from "../components/ui/primitives";
import { Colors } from "../constants/theme";
import {
  Button,
  ErrorState,
  PageShell,
  SignIn,
  Skeleton,
  cs,
} from "../components/circular/shared";
import { useCircularQuery, circularChanged } from "../hooks/use-circular";
import { circularAPI } from "../lib/circular/client";
import { isExpoGo } from "../lib/runtime-environment";
export default function Notifications() {
  const query = useCircularQuery<{ enabled: boolean }>("/circular-alerts");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [notice, setNotice] = useState("");
  async function change(enabled: boolean) {
    if (!query.userId || busy) return;
    setBusy(true);
    try {
      await circularAPI.request(query.userId, "/circular-alerts", "POST", {
        enabled,
      });
      circularChanged();
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  async function permission() {
    if (isExpoGo) {
      setNotice("Use an iOS or Android native build for notifications.");
      return;
    }
    try {
      const notifications = await import("expo-notifications");
      const result = await notifications.requestPermissionsAsync();
      setNotice(
        result.granted
          ? "Device notifications are allowed."
          : "Notifications are off for this device. You can enable them in device settings.",
      );
    } catch {
      setNotice("Device notifications are unavailable here.");
    }
  }
  return (
    <PageShell back title="Notifications">
      <ScrollView contentContainerStyle={cs.content}>
        <WeeklyReminderCard />
        {query.authLoading || (query.loading && !query.data) ? (
          <Skeleton />
        ) : !query.userId ? (
          <SignIn returnTo="/notifications" />
        ) : (
          <View style={{ gap: 16 }}>
            <View style={cs.card}>
              <View style={[cs.row, { flexWrap: "nowrap" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={cs.heading}>New government circulars</Text>
                  <Text style={cs.muted}>
                    Get notified when a new circular is published.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="New government circulars"
                  disabled={busy || !query.data}
                  value={query.data?.enabled ?? false}
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                  onValueChange={(value) => void change(value)}
                />
              </View>
            </View>
            <Text style={cs.muted}>
              This preference is saved to your account. Notification delivery
              also depends on your device permissions and registration.
            </Text>
            <Button
              label="Check device permission"
              secondary
              onPress={() => void permission()}
            />
            {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
            {(error || query.error) && (
              <ErrorState
                error={(error || query.error)!}
                retry={() => {
                  setError(undefined);
                  void query.refresh();
                }}
              />
            )}
          </View>
        )}
      </ScrollView>
    </PageShell>
  );
}
