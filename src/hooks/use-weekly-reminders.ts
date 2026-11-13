import { useSyncExternalStore } from "react";
import { weeklyReminders } from "../lib/reminders/runtime";
export function useWeeklyReminders() {
  return {
    ...useSyncExternalStore(
      weeklyReminders.subscribe,
      weeklyReminders.getSnapshot,
      weeklyReminders.getSnapshot,
    ),
    setEnabled: weeklyReminders.setEnabled,
    refresh: weeklyReminders.refresh,
    dismiss: weeklyReminders.dismiss,
  };
}
