import type { Permission, ReminderPort } from "./controller";
import { REMINDER_CHANNEL, REMINDER_VERSION, reminderId } from "./schedule";
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
export function createReminderPort(
  notifications: () => Promise<typeof import("expo-notifications")>,
  storage: Storage,
  platform: "ios" | "android",
): ReminderPort {
  const calendarContext = () =>
    `${Intl.DateTimeFormat().resolvedOptions().timeZone}:${new Date().getTimezoneOffset()}`;
  return {
    calendarContext,
    read: () => storage.getItem("firstjobly.weekly-reminders.v1"),
    write: (value) => storage.setItem("firstjobly.weekly-reminders.v1", value),
    async setup() {
      const api = await notifications();
      if (platform === "android")
        await api.setNotificationChannelAsync(REMINDER_CHANNEL, {
          name: "Weekly job reminders",
          importance: api.AndroidImportance.DEFAULT,
          sound: "default",
        });
      api.setNotificationHandler({
        handleNotification: async (notification) => {
          const ours =
            notification.request.content.data?.kind === "weekly_job_reminder";
          return {
            shouldShowBanner: ours,
            shouldShowList: ours,
            shouldPlaySound: ours,
            shouldSetBadge: false,
          };
        },
      });
    },
    async permission(request) {
      const api = await notifications();
      let result = await api.getPermissionsAsync();
      if (request && !result.granted && result.canAskAgain)
        result = await api.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: false, allowSound: true },
        });
      return (
        result.granted ||
        result.ios?.status === api.IosAuthorizationStatus.PROVISIONAL
          ? "granted"
          : result.canAskAgain
            ? "undetermined"
            : "denied"
      ) as Permission;
    },
    async list() {
      return (
        await (await notifications()).getAllScheduledNotificationsAsync()
      ).map((item) => ({
        identifier: item.identifier,
        version: item.content.data?.scheduleVersion,
        context: item.content.data?.calendarContext,
      }));
    },
    async cancel(id) {
      await (await notifications()).cancelScheduledNotificationAsync(id);
    },
    async schedule(reminder) {
      const api = await notifications();
      await api.scheduleNotificationAsync({
        identifier: reminderId(reminder.slot),
        content: {
          title: reminder.title,
          body: reminder.body,
          sound: "default",
          data: {
            kind: "weekly_job_reminder",
            link: "/jobs",
            scheduleVersion: REMINDER_VERSION,
            calendarContext: calendarContext(),
          },
        },
        trigger: {
          type: api.SchedulableTriggerInputTypes.WEEKLY,
          weekday: reminder.weekday,
          hour: reminder.hour,
          minute: reminder.minute,
          channelId: REMINDER_CHANNEL,
        },
      });
    },
  };
}
