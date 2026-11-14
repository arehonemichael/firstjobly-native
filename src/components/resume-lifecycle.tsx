import { getHomeProfile } from "../lib/recommendations/api";
import { useEffect, useLayoutEffect, useRef } from "react";
import { AppState, Linking, Platform } from "react-native";
import { useNavigationContainerRef, usePathname } from "expo-router";
import { supabase } from "../lib/supabase";
import { nativeAuthState } from "../lib/resume/auth-refresh";
import {
  createResumeController,
  RESUME_LINK_GRACE_MS,
  safeResumeRoutes,
} from "../lib/resume/controller";
import {
  refreshResumedHome,
  subscribeResumeDestination,
} from "../lib/resume/events";
import { fullscreenLock } from "../ads/fullscreen-lock";
import { adsPrivacy } from "../ads/privacy";
import { weeklyReminders } from "../lib/reminders/runtime";

export function ResumeLifecycle({
  ready,
  userId,
}: {
  ready: boolean;
  userId: string | null;
}) {
  const navigation = useNavigationContainerRef();
  const pathname = usePathname();
  const context = useRef({ ready, userId, pathname });
  useLayoutEffect(() => {
    context.current = { ready, userId, pathname };
  }, [ready, userId, pathname]);
  const controller = useRef(createResumeController());
  const drain = useRef(() => {});
  useEffect(() => {
    if (Platform.OS === "web") return; // Browser auth already handles visibility itself.
    const resume = controller.current;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const blocked = () =>
      fullscreenLock.isHeld() ||
      adsPrivacy.getSnapshot().presenting ||
      weeklyReminders.getSnapshot().busy;
    let profileOwner: string | null = null;
    let profileReady = false;
    let checkingProfile = false;
    const check = () => {
      const value = context.current;
      if (
        disposed ||
        AppState.currentState !== "active" ||
        !navigation.isReady()
      )
        return;
      if (
        !resume.pending() ||
        !value.ready ||
        blocked() ||
        !safeResumeRoutes.has(value.pathname)
      )
        return;
      if (value.userId && (profileOwner !== value.userId || !profileReady)) {
        if (checkingProfile) return;
        checkingProfile = true;
        const owner = value.userId;
        void getHomeProfile(owner)
          .then((profile) => {
            if (context.current.userId === owner) {
              profileOwner = owner;
              profileReady = profile?.onboarding_completed === true;
            }
          })
          .catch(() => {})
          .finally(() => {
            checkingProfile = false;
            if (profileReady && profileOwner === context.current.userId)
              check();
          });
        return;
      }
      if (!resume.consume(value.pathname, !value.ready || blocked())) return;
      if (value.pathname === "/") refreshResumedHome();
      else {
        // Retain navigator/screen keys so cached Home state stays mounted. Drop
        // the root stack and tab history, rather than constructing a new app tree.
        const root = navigation.getRootState();
        const tabs = root.routes.find((route) => route.name === "(tabs)");
        const tabState = tabs?.state;
        const homeIndex =
          tabState?.routes.findIndex((route) => route.name === "index") ?? -1;
        const home = homeIndex >= 0 ? tabState!.routes[homeIndex] : undefined;
        if (tabs && tabState && home) {
          navigation.resetRoot({
            ...root,
            index: 0,
            routes: [
              {
                ...tabs,
                state: {
                  ...tabState,
                  index: homeIndex,
                  history: [{ type: "route", key: home.key }],
                },
              },
            ],
          });
        } else {
          navigation.resetRoot({
            index: 0,
            routes: [
              {
                name: "(tabs)",
                state: { index: 0, routes: [{ name: "index" }] },
              },
            ],
          });
        }
      }
    };
    drain.current = check;
    nativeAuthState(supabase.auth, AppState.currentState);
    const state = AppState.addEventListener("change", (next) => {
      nativeAuthState(supabase.auth, next);
      if (next === "background") {
        profileOwner = null;
        profileReady = false;
      }
      resume.state(next, blocked());
      if (timer) clearTimeout(timer);
      if (next === "active" && resume.pending())
        timer = setTimeout(check, RESUME_LINK_GRACE_MS);
    });
    // Router still processes the URL normally. Our observer only cancels the Home reset.
    const links = Linking.addEventListener("url", () => resume.destination());
    const destination = subscribeResumeDestination(() => resume.destination());
    const unlock = fullscreenLock.subscribe(check);
    const consent = adsPrivacy.subscribe(check);
    const reminders = weeklyReminders.subscribe(check);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      state.remove();
      links.remove();
      destination();
      unlock();
      consent();
      reminders();
      resume.cancel();
      drain.current = () => {};
      nativeAuthState(supabase.auth, "background");
    };
  }, [navigation]);
  useEffect(() => {
    drain.current();
  }, [pathname, ready]);
  useEffect(() => {
    controller.current.cancel();
  }, [userId]);
  return null;
}
