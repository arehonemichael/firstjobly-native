import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { isExpoGo } from "../runtime-environment";
import { createWeeklyReminders } from "./controller";
import { createReminderPort } from "./native-port";
const supported =
  (Platform.OS === "ios" || Platform.OS === "android") && !isExpoGo;
let native: Promise<typeof import("expo-notifications")> | null = null;
const notifications = () =>
  (native ??= import("expo-notifications").catch((error) => {
    native = null;
    throw error;
  }));
export const weeklyReminders = createWeeklyReminders(
  supported
    ? createReminderPort(
        notifications,
        AsyncStorage,
        Platform.OS === "ios" ? "ios" : "android",
      )
    : null,
);
