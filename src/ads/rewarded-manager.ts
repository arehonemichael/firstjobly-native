import { ADS_CONFIG, AD_UNITS } from "./config";
import { mobileAdsSDK } from "./sdk";
import { adsPrivacy, getRequestOptions } from "./privacy";
import { fullscreenLock } from "./fullscreen-lock";
import { adDiagnostics as diag } from "./diagnostics";

type Outcome = "earned" | "unavailable" | "cancelled" | "busy";
type Ad = {
  load(): void;
  show(): Promise<void>;
  addAdEventListener(
    event: string,
    handler: (error?: unknown) => void,
  ): () => void;
  removeAllListeners(): void;
};
type Port = {
  permitted(): boolean;
  createAd(): Ad;
  events: {
    LOADED: string;
    OPENED: string;
    EARNED: string;
    CLOSED: string;
    ERROR: string;
  };
};
export function createRewardedManager(
  port: Port | null,
  policy = ADS_CONFIG.rewarded,
  lock = fullscreenLock,
) {
  let ad: Ad | null = null,
    loaded = false,
    opened = false,
    earned = false;
  let listeners: (() => void)[] = [];
  let retry = 0,
    exhausted = false,
    resetting = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let loadTimer: ReturnType<typeof setTimeout> | null = null;
  let finish: ((outcome: Outcome) => void) | null = null;
  let credit = false;
  const creditListeners = new Set<() => void>();
  function setCredit(value: boolean) {
    if (credit === value) return;
    credit = value;
    creditListeners.forEach((listener) => listener());
  }
  const owner = "rewarded-download";
  function discard() {
    if (loadTimer !== null) clearTimeout(loadTimer);
    loadTimer = null;
    listeners.forEach((remove) => {
      try {
        remove();
      } catch {
        /* Cleanup is best effort. */
      }
    });
    listeners = [];
    const old = ad;
    ad = null;
    loaded = false;
    opened = false;
    earned = false;
    try {
      old?.removeAllListeners();
    } catch {
      /* No callback may gate a download forever. */
    }
  }
  function failure(error?: unknown) {
    diag.error("rewarded", "load.failed", error);
    discard();
    if (!port?.permitted() || !policy.enabled || resetting) return;
    const delay = policy.retryBackoffMs[retry++];
    if (delay === undefined) {
      exhausted = true;
      return;
    }
    diag.record("load.retry", {
      format: "rewarded",
      attempt: retry,
      delayMs: delay,
    });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      prepare();
    }, delay);
  }
  function prepare() {
    if (
      !policy.enabled ||
      !port?.permitted() ||
      ad ||
      finish ||
      retryTimer !== null ||
      resetting ||
      credit
    )
      return;
    if (exhausted) {
      retry = 0;
      exhausted = false;
    }
    try {
      const inventory = port.createAd();
      ad = inventory;
      listeners = [
        inventory.addAdEventListener(port.events.LOADED, () => {
          if (ad !== inventory) return;
          if (loadTimer !== null) clearTimeout(loadTimer);
          loadTimer = null;
          loaded = true;
          retry = 0;
          diag.record("loaded", { format: "rewarded", loaded: true });
        }),
        inventory.addAdEventListener(port.events.OPENED, () => {
          if (ad !== inventory || !finish) return;
          opened = true;
          diag.record("opened", { format: "rewarded", shown: true });
        }),
        inventory.addAdEventListener(port.events.EARNED, () => {
          if (ad !== inventory || !finish) return;
          earned = true;
          setCredit(true);
          diag.record("reward.earned", { format: "rewarded" });
        }),
        inventory.addAdEventListener(port.events.CLOSED, () => {
          if (ad !== inventory) return;
          if (finish) finish(earned ? "earned" : "cancelled");
          else {
            discard();
            prepare();
          }
        }),
        inventory.addAdEventListener(port.events.ERROR, (error) => {
          if (ad !== inventory) return;
          if (finish) {
            diag.error("rewarded", "presentation.failed", error);
            finish(earned ? "earned" : "unavailable");
          } else failure(error);
        }),
      ];
      loadTimer = setTimeout(() => {
        diag.record("load.timeout", { format: "rewarded" });
        failure();
      }, policy.loadTimeoutMs);
      diag.record("request", { format: "rewarded" });
      inventory.load();
    } catch (error) {
      failure(error);
    }
  }
  function request(): Promise<Outcome> {
    if (finish) return Promise.resolve("busy");
    if (credit) return Promise.resolve("earned");
    prepare();
    if (
      !policy.enabled ||
      !port?.permitted() ||
      !loaded ||
      !ad ||
      !lock.tryAcquire(owner)
    ) {
      diag.record("download.fallback", {
        format: "rewarded",
        reason: !port
          ? "unsupported"
          : !policy.enabled
            ? "disabled"
            : !port.permitted()
              ? "consent"
              : !loaded
                ? "not-loaded"
                : "fullscreen-lock-or-gap",
      });
      return Promise.resolve("unavailable");
    }
    const inventory = ad;
    return new Promise((resolve) => {
      let done = false;
      let startTimer: ReturnType<typeof setTimeout> | null = null;
      let safetyTimer: ReturnType<typeof setTimeout> | null = null;
      const complete = (outcome: Outcome) => {
        if (done) return;
        done = true;
        if (startTimer !== null) clearTimeout(startTimer);
        if (safetyTimer !== null) clearTimeout(safetyTimer);
        finish = null;
        lock.release(owner);
        discard();
        prepare();
        resolve(outcome);
      };
      finish = complete;
      startTimer = setTimeout(() => {
        if (!opened) complete(earned ? "earned" : "unavailable");
      }, policy.startTimeoutMs);
      safetyTimer = setTimeout(
        () => complete(earned ? "earned" : "unavailable"),
        policy.safetyTimeoutMs,
      );
      try {
        diag.record("show", { format: "rewarded" });
        void inventory.show().catch((error) => {
          diag.error("rewarded", "presentation.failed", error);
          complete(earned ? "earned" : "unavailable");
        });
      } catch (error) {
        diag.error("rewarded", "presentation.failed", error);
        complete(earned ? "earned" : "unavailable");
      }
    });
  }
  function revoke() {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    retry = 0;
    exhausted = false;
    if (finish) finish("unavailable");
    else discard();
  }
  return {
    prepare,
    request,
    revoke,
    getCredit: () => credit,
    subscribeCredit(listener: () => void) {
      creditListeners.add(listener);
      return () => {
        creditListeners.delete(listener);
      };
    },
    consumeReward() {
      setCredit(false);
      prepare();
    },
    _test: {
      reset() {
        resetting = true;
        revoke();
        discard();
        setCredit(false);
        resetting = false;
      },
    },
  };
}
const sdk = mobileAdsSDK;
export const rewardedManager = createRewardedManager(
  sdk
    ? {
        permitted: () => adsPrivacy.getSnapshot().canRequestAds,
        createAd: () =>
          sdk.RewardedAd.createForAdRequest(
            AD_UNITS.rewarded,
            getRequestOptions(),
          ),
        events: {
          LOADED: sdk.RewardedAdEventType.LOADED,
          EARNED: sdk.RewardedAdEventType.EARNED_REWARD,
          OPENED: sdk.AdEventType.OPENED,
          CLOSED: sdk.AdEventType.CLOSED,
          ERROR: sdk.AdEventType.ERROR,
        },
      }
    : null,
);
adsPrivacy.subscribe(() => {
  if (!adsPrivacy.getSnapshot().canRequestAds) rewardedManager.revoke();
});
