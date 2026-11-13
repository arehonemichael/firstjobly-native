import { useCallback, useEffect } from "react";
import { AppState, Linking, Switch, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useWeeklyReminders } from "../hooks/use-weekly-reminders";
import { weeklyReminders } from "../lib/reminders/runtime";
import { REMINDER_TIMES } from "../lib/reminders/schedule";
import { AppText as Text } from "./ui/primitives";
import { Button, cs } from "./circular/shared";
import { Colors } from "../constants/theme";
export function WeeklyRemindersLifecycle({ ready }: { ready: boolean }) {
  useEffect(() => {
    if (!ready) return;
    void weeklyReminders.refresh();
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") void weeklyReminders.refresh();
    });
    return () => listener.remove();
  }, [ready]);
  return null;
}
export function WeeklyReminderCard({ compact = false }: { compact?: boolean }) {
  const reminders = useWeeklyReminders();
  useFocusEffect(
    useCallback(() => {
      void weeklyReminders.refresh();
    }, []),
  );
  if (
    compact &&
    (!reminders.supported ||
      !reminders.ready ||
      reminders.enabled ||
      reminders.dismissed)
  )
    return null;
  return (
    <View style={[cs.card, compact && { marginTop: 16 }]}>
      <View style={[cs.row, { flexWrap: "nowrap" }]}>
        <Text style={[cs.heading, { flex: 1 }]}>Weekly job reminders</Text>
        {!compact && (
          <Switch
            accessibilityLabel="Weekly job reminders"
            disabled={
              !reminders.supported || !reminders.ready || reminders.busy
            }
            value={reminders.enabled}
            trackColor={{ true: Colors.primary, false: Colors.border }}
            onValueChange={(value) => void reminders.setEnabled(value)}
          />
        )}
      </View>
      <Text style={cs.muted}>{REMINDER_TIMES}</Text>
      <Text style={cs.muted}>
        Five reminders a week, in your phone’s local time. Available without
        signing in.
      </Text>
      {!reminders.supported ? (
        <Text style={cs.muted}>
          Use an iOS or Android native build to enable reminders.
        </Text>
      ) : (
        <>
          {compact && (
            <>
              <Button
                label={reminders.busy ? "Enabling…" : "Enable reminders"}
                disabled={reminders.busy}
                onPress={() => void reminders.setEnabled(true)}
              />
              <Button
                label="Not now"
                secondary
                disabled={reminders.busy}
                onPress={() => void reminders.dismiss()}
              />
            </>
          )}
          {reminders.enabled && (
            <Text accessibilityLiveRegion="polite">
              {reminders.active
                ? "Weekly reminders are scheduled on this device."
                : reminders.permission !== "granted"
                  ? "Reminders are enabled, but device permission is off."
                  : "Reminders could not be scheduled yet. Retry below."}
            </Text>
          )}
          {reminders.permission !== "granted" && reminders.dismissed && (
            <Button
              label="Open device notification settings"
              secondary
              onPress={() => void Linking.openSettings().catch(() => {})}
            />
          )}
          {reminders.error && (
            <>
              <Text accessibilityRole="alert">{reminders.error}</Text>
              <Button
                label="Retry reminders"
                secondary
                disabled={reminders.busy}
                onPress={() => void reminders.refresh()}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}
