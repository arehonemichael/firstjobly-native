import { prioritizeResumeDestination } from "../lib/resume/events";
import { useEffect } from "react";
import { Linking } from "react-native";
import { router, useRootNavigationState, type Href } from "expo-router";
import { isExpoGo } from "../lib/runtime-environment";
import { notificationDestination } from "../lib/circular/links";
import { signalUserInteraction } from "../lib/user-interaction";
const consumed = new Set<string>();
/** Handles the audit's notification link field. Registration, delivery and
 * permission prompts stay with the existing backend/app configuration. */
export function useCommunityNotifications() {
  const navigation = useRootNavigationState();
  useEffect(() => {
    if (!navigation?.key || isExpoGo) return;
    let disposed = false;
    let subscription: { remove(): void } | undefined;
    void import("expo-notifications")
      .then(async (notifications) => {
        if (disposed) return;
        function handle(
          response: import("expo-notifications").NotificationResponse | null,
        ) {
          if (
            !response ||
            disposed ||
            response.actionIdentifier !==
              notifications.DEFAULT_ACTION_IDENTIFIER
          )
            return;
          const destination = notificationDestination(
            response.notification.request.content.data,
          );
          const id = response.notification.request.identifier;
          if (!destination || consumed.has(id)) return;
          consumed.add(id);
          if (consumed.size > 30)
            consumed.delete(consumed.values().next().value!);
          prioritizeResumeDestination();
          signalUserInteraction();
          router.push(destination as Href);
          void notifications
            .clearLastNotificationResponseAsync()
            .catch(() => {});
        }
        subscription =
          notifications.addNotificationResponseReceivedListener(handle);
        // Explicit launch URLs win over a stale last-notification response.
        const initialUrl = await Linking.getInitialURL();
        if (!initialUrl && !disposed)
          handle(await notifications.getLastNotificationResponseAsync());
      })
      .catch(() => {
        /* Optional notification support never blocks startup. */
      });
    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [navigation?.key]);
}
