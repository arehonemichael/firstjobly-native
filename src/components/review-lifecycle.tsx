import { subscribeAdViewportChanges } from "../ads/viewport-events";
import { useEffect, useLayoutEffect, useRef } from "react";
import { AppState, Keyboard, Linking, TextInput } from "react-native";
import { fullscreenLock } from "../ads/fullscreen-lock";
import { adsPrivacy } from "../ads/privacy";
import { weeklyReminders } from "../lib/reminders/runtime";
import { reviewPrompts } from "../lib/reviews/runtime";
import {
  subscribeReviewInteraction,
  subscribeReviewSuccess,
} from "../lib/reviews/events";

/** Fresh completed action -> idle Home only. Never a launch, route-change or resume prompt. */
export function ReviewLifecycle({
  ready,
  pathname,
  userId,
}: {
  ready: boolean;
  pathname: string;
  userId: string | null;
}) {
  const context = useRef({ ready, pathname, userId });
  useLayoutEffect(() => {
    if (context.current.userId !== userId) reviewPrompts.clearPending();
    context.current = { ready, pathname, userId };
  }, [ready, pathname, userId]);
  useEffect(() => {
    let alive = true,
      keyboard = false,
      lastInteraction = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backgroundAt: number | null = null;
    const home = () =>
      ["/", "/(tabs)", "/(tabs)/index"].includes(context.current.pathname);
    const safe = () =>
      alive &&
      context.current.ready &&
      home() &&
      AppState.currentState === "active" &&
      !keyboard &&
      !TextInput.State.currentlyFocusedInput() &&
      fullscreenLock.canAcquire() &&
      !adsPrivacy.getSnapshot().presenting &&
      Date.now() - adsPrivacy.getSnapshot().lastUiAt > 1000 &&
      !weeklyReminders.getSnapshot().busy &&
      Date.now() - lastInteraction >= 5000;
    const check = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (
        !alive ||
        !reviewPrompts.hasPending() ||
        !context.current.ready ||
        !home() ||
        AppState.currentState !== "active"
      )
        return;
      timer = setTimeout(() => {
        timer = null;
        void reviewPrompts.tryRequest(safe).finally(check);
      }, 5000);
    };
    const action = subscribeReviewSuccess((key) => {
      void reviewPrompts.positive(key).then(check);
    });
    const touches = subscribeReviewInteraction(() => {
      lastInteraction = Date.now();
      check();
    });
    const viewport = subscribeAdViewportChanges(() => {
      lastInteraction = Date.now();
      check();
    });
    const changes = reviewPrompts.subscribe(check);
    const lock = fullscreenLock.subscribe(check);
    const consent = adsPrivacy.subscribe(check);
    const reminders = weeklyReminders.subscribe(check);
    const state = AppState.addEventListener("change", (next) => {
      lastInteraction = Date.now();
      if (next === "background") backgroundAt = Date.now();
      if (next !== "active") reviewPrompts.clearPending();
      else if (backgroundAt !== null) {
        void reviewPrompts.resumeSession(Date.now() - backgroundAt);
        backgroundAt = null;
      }
      check();
    });
    const link = Linking.addEventListener("url", () =>
      reviewPrompts.clearPending(),
    );
    const show = Keyboard.addListener("keyboardDidShow", () => {
      keyboard = true;
      check();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboard = false;
      lastInteraction = Date.now();
      check();
    });
    void reviewPrompts.startSession();
    check();
    return () => {
      alive = false;
      if (timer !== null) clearTimeout(timer);
      action();
      touches();
      viewport();
      changes();
      lock();
      consent();
      reminders();
      state.remove();
      link.remove();
      show.remove();
      hide.remove();
    };
  }, [ready, pathname]);
  return null;
}
