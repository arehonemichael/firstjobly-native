import { useEffect, useLayoutEffect } from "react";
import { AppState, Keyboard, TextInput } from "react-native";
import { subscribeUserInteraction } from "../lib/user-interaction";
import { getHomeProfile } from "../lib/recommendations/api";
import { fullscreenLock } from "./fullscreen-lock";
import { adsPrivacy } from "./privacy";
import { mobileAdsSDK } from "./sdk";
import { interstitialManager } from "./interstitial-manager";
import { createExtraInterstitialController } from "./extra-interstitial-controller";
import { extraBoundaryReady } from "./extra-boundary";
import { adDiagnostics as diag } from "./diagnostics";

// One running JS process, matching the existing interstitial session. Root
// remounts, account changes and backgrounding do not reset counters or elapsed use.
const session = createExtraInterstitialController();
let ready = false,
  onboarded = false,
  keyboard = false;
let previousHeld = false;
function sync() {
  const privacy = adsPrivacy.getSnapshot();
  const held = fullscreenLock.isHeld();
  if (previousHeld && !held) session.fullscreenEnded();
  previousHeld = held;
  session.setActive(
    !!mobileAdsSDK &&
      ready &&
      onboarded &&
      AppState.currentState === "active" &&
      !held &&
      privacy.canRequestAds &&
      !privacy.presenting,
  );
}
export const extraTransitionPending = () => session.isBusy();
export function offerExtraHomeTransition(source: string, proceed: () => void) {
  if (!mobileAdsSDK) return false;
  if (session.isBusy()) return true;
  sync();
  const privacy = adsPrivacy.getSnapshot();
  if (
    keyboard ||
    TextInput.State.currentlyFocusedInput() ||
    privacy.presenting ||
    Date.now() - privacy.lastUiAt <= 1000 ||
    !extraBoundaryReady(source)
  )
    return false;
  return session.offer(
    (done, opened) =>
      interstitialManager.onAdditionalTransition(done, () => {
        opened();
        diag.record("opened", {
          format: "additional-interstitial",
          shownThisSession: session.state().shown,
        });
      }),
    proceed,
  );
}
export function ExtraInterstitialLifecycle({
  ready: initialized,
  userId,
}: {
  ready: boolean;
  userId: string | null;
}) {
  useEffect(() => {
    if (!mobileAdsSDK) return;
    const interaction = subscribeUserInteraction(() =>
      session.noteInteraction(),
    );
    const state = AppState.addEventListener("change", sync);
    const show = Keyboard.addListener("keyboardDidShow", () => {
      keyboard = true;
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboard = false;
    });
    const lock = fullscreenLock.subscribe(sync);
    const privacy = adsPrivacy.subscribe(sync);
    sync();
    return () => {
      interaction();
      state.remove();
      show.remove();
      hide.remove();
      lock();
      privacy();
      ready = false;
      sync();
    };
  }, []);
  useLayoutEffect(() => {
    let current = true;
    ready = initialized;
    onboarded = false;
    sync();
    if (mobileAdsSDK && initialized && userId)
      void getHomeProfile(userId)
        .then((profile) => {
          if (!current) return;
          onboarded = profile?.onboarding_completed === true;
          sync();
        })
        .catch(() => {});
    return () => {
      current = false;
      ready = false;
      onboarded = false;
      sync();
    };
  }, [initialized, userId]);
  return null;
}
