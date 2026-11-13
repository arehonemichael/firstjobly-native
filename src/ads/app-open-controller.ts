import { adDiagnostics as diag } from "./diagnostics";
import { ADS_CONFIG } from "./config";
import { fullscreenLock } from "./fullscreen-lock";
type Ad = {
  load(): void;
  show(): Promise<void>;
  removeAllListeners(): void;
  addAdEventListener(
    event: string,
    handler: (error?: unknown) => void,
  ): () => void;
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
type Context = { eligible: boolean; consent: boolean };
type Options = {
  createAd: () => Ad;
  storage: Storage;
  now?: () => number;
  minLaunches?: number;
  cooldownMs?: number;
  maxAgeMs?: number;
  enabled?: () => boolean;
  coldStartEnabled?: () => boolean;
  coldStartWindowMs?: number;
  lock?: typeof fullscreenLock;
  schedule?: (action: () => void) => () => void;
};
export function createAppOpenController({
  createAd,
  storage,
  now = Date.now,
  minLaunches = ADS_CONFIG.appOpen.minLaunches,
  cooldownMs = ADS_CONFIG.appOpen.cooldownMs,
  maxAgeMs = ADS_CONFIG.appOpen.maxAdAgeMs,
  enabled = () => ADS_CONFIG.appOpen.enabled,
  coldStartEnabled = () => ADS_CONFIG.appOpen.coldStartEnabled,
  coldStartWindowMs = ADS_CONFIG.appOpen.coldStartWindowMs,
  lock = fullscreenLock,
  schedule = (action) => {
    const timer = setTimeout(action, 75);
    return () => clearTimeout(timer);
  },
}: Options) {
  let context: Context = { eligible: false, consent: false },
    ad: Ad | null = null,
    loadedAt: number | null = null,
    showing = false,
    spent = true,
    interacted = false,
    lastShown = 0,
    launches = 0,
    initialized = false,
    disposed = false,
    active = true;
  let backgroundAt: number | null = null,
    cancelPending: (() => void) | null = null;
  let listeners: (() => void)[] = [];
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;
  let coldChecked = false,
    coldAvailable = false,
    coldUntil = 0,
    storageReady = false;
  let coldTimer: ReturnType<typeof setTimeout> | null = null;
  function endCold(reason?: string) {
    if (reason && coldAvailable)
      diag.record("skip", {
        format: "app-open",
        placement: "cold-start",
        reason,
      });
    coldAvailable = false;
    if (coldTimer !== null) clearTimeout(coldTimer);
    coldTimer = null;
  }
  function maybeCold() {
    if (!coldAvailable || disposed || showing || cancelPending || !storageReady)
      return;
    if (now() >= coldUntil) {
      endCold("startup-window-expired");
      return;
    }
    if (!active || !context.eligible || !context.consent) return;
    if (launches < minLaunches || now() - lastShown < cooldownMs) {
      endCold(launches < minLaunches ? "launch-threshold" : "cooldown");
      return;
    }
    if (loadedAt === null || !ad) return;
    if (now() - loadedAt < 0 || now() - loadedAt >= maxAgeMs) {
      clearAd();
      preload();
      return;
    }
    spent = false;
    offer(true);
  }
  const owner = "app-open";
  const release = () => {
    if (safetyTimer !== null) clearTimeout(safetyTimer);
    safetyTimer = null;
    lock.release(owner);
  };
  const cancel = () => {
    cancelPending?.();
    cancelPending = null;
    spent = true;
  };
  const clearAd = () => {
    cancel();
    listeners.forEach((f) => f());
    listeners = [];
    ad?.removeAllListeners();
    ad = null;
    loadedAt = null;
  };
  const preload = () => {
    if (disposed || !enabled() || !context.consent || ad || showing) return;
    try {
      diag.record("request", { format: "app-open" });
      ad = createAd();
      listeners = [
        ad.addAdEventListener("loaded", () => {
          diag.record("loaded", { format: "app-open", loaded: true });
          loadedAt = now();
          maybeCold();
        }),
        ad.addAdEventListener("closed", () => {
          diag.record("closed", { format: "app-open" });
          showing = false;
          release();
          clearAd();
          preload();
        }),
        ad.addAdEventListener("error", (error) => {
          diag.error(
            "app-open",
            showing ? "presentation.failed" : "load.failed",
            error,
          );
          const wasShowing = showing;
          showing = false;
          release();
          clearAd();
          // Avoid a synchronous no-fill loop. Later foreground/context changes
          // can retry a failed preload; a failed presentation preloads once.
          if (wasShowing) preload();
        }),
      ];
      try {
        listeners.push(
          ad.addAdEventListener("opened", () =>
            diag.record("opened", { format: "app-open", shown: true }),
          ),
        );
      } catch {
        /* Optional observation cannot break a valid load. */
      }
      ad.load();
    } catch (error) {
      diag.error("app-open", "load.failed", error);
      clearAd();
      showing = false;
      release();
    }
  };
  const initialize = async () => {
    if (initialized) return;
    initialized = true;
    try {
      const [count, last] = await Promise.all([
        storage.getItem("fj_admob_launch_count"),
        storage.getItem("fj_admob_last_app_open"),
      ]);
      if (disposed) return;
      launches = Math.max(0, Number(count) || 0) + 1;
      lastShown = Number(last) || 0;
      await storage.setItem("fj_admob_launch_count", String(launches));
      storageReady = true;
      preload();
      maybeCold();
    } catch {
      storageReady = true;
      endCold("storage-unavailable");
      launches = 0;
    }
  };
  function onState(next: string) {
    if (disposed) return;
    active = next === "active";
    if (!active) {
      endCold("left-startup");
      cancel();
    }
    if (next === "background") {
      backgroundAt = now();
      return;
    }
    if (!active || backgroundAt === null) return;
    const away = now() - backgroundAt;
    backgroundAt = null;
    spent = false;
    interacted = false;
    if (
      !enabled() ||
      away < 1000 ||
      !context.eligible ||
      !context.consent ||
      showing ||
      launches < minLaunches ||
      now() - lastShown < cooldownMs
    ) {
      diag.record("skip", {
        format: "app-open",
        reason: !enabled()
          ? "disabled"
          : away < 1000
            ? "brief-background"
            : !context.eligible
              ? "route-onboarding-or-consent-ui"
              : !context.consent
                ? "consent"
                : showing
                  ? "already-showing"
                  : launches < minLaunches
                    ? "launch-threshold"
                    : "cooldown",
      });
      spent = true;
      preload();
      return;
    }
    if (loadedAt === null || !ad) {
      diag.record("skip", {
        format: "app-open",
        reason: "not-loaded-at-foreground",
      });
      spent = true;
      preload();
      return;
    }
    if (now() - loadedAt < 0 || now() - loadedAt >= maxAgeMs) {
      diag.record("skip", { format: "app-open", reason: "expired" });
      spent = true;
      clearAd();
      preload();
      return;
    }
    offer(false);
  }
  function offer(cold: boolean) {
    if (!ad || loadedAt === null) return;
    const inventory = ad,
      foregroundAt = now();
    // A short bounded guard lets foreground URL/navigation/touch events cancel.
    // Only inventory ready at the event is eligible; loading never triggers show.
    cancelPending = schedule(() => {
      cancelPending = null;
      if (
        disposed ||
        (cold && (!coldAvailable || now() >= coldUntil)) ||
        !enabled() ||
        spent ||
        interacted ||
        !active ||
        !context.eligible ||
        !context.consent ||
        ad !== inventory ||
        showing ||
        loadedAt === null ||
        now() - loadedAt >= maxAgeMs ||
        now() - foregroundAt < 0 ||
        now() - foregroundAt > 200
      ) {
        diag.record("skip", {
          format: "app-open",
          reason: "foreground-guard-cancelled-or-late",
        });
        spent = true;
        if (cold) endCold("startup-guard-cancelled");
        return;
      }
      spent = true;
      if (cold) endCold();
      if (!lock.tryAcquire(owner)) {
        diag.record("skip", {
          format: "app-open",
          reason: "fullscreen-lock-or-gap",
        });
        return;
      }
      showing = true;
      // Defensively release a broken SDK presentation with no terminal event.
      safetyTimer = setTimeout(() => {
        diag.record("presentation.timeout", {
          format: "app-open",
          reason: "terminal-event-missing",
        });
        showing = false;
        release();
        clearAd();
        preload();
      }, 120000);
      loadedAt = null;
      lastShown = now();
      void storage
        .setItem("fj_admob_last_app_open", String(lastShown))
        .catch(() => {});
      try {
        diag.record("show", {
          format: "app-open",
          placement: cold ? "cold-start" : "background-return",
        });
        void inventory.show().catch((error) => {
          if (ad !== inventory) return;
          diag.error("app-open", "presentation.failed", error);
          showing = false;
          release();
          clearAd();
          preload();
        });
      } catch (error) {
        diag.error("app-open", "presentation.failed", error);
        showing = false;
        release();
        clearAd();
        preload();
      }
    });
  }
  return {
    initialize,
    beginColdStart(home: boolean) {
      if (coldChecked || disposed) return;
      coldChecked = true;
      if (!home || interacted || !enabled() || !coldStartEnabled()) {
        diag.record("skip", {
          format: "app-open",
          placement: "cold-start",
          reason: !home
            ? "startup-destination"
            : interacted
              ? "startup-interaction"
              : "cold-start-disabled",
        });
        return;
      }
      coldAvailable = true;
      coldUntil = now() + coldStartWindowMs;
      diag.record("startup.window", {
        format: "app-open",
        delayMs: coldStartWindowMs,
      });
      coldTimer = setTimeout(() => {
        endCold("startup-window-expired");
        cancel();
      }, coldStartWindowMs);
      maybeCold();
    },
    onState,
    markInteraction() {
      endCold("startup-interaction");
      interacted = true;
      cancel();
    },
    setContext(next: Context, preloadNow = true) {
      context = next;
      if (!next.eligible || !next.consent) cancel();
      if (!next.consent && !showing) clearAd();
      if (preloadNow) preload();
      maybeCold();
    },
    dispose() {
      disposed = true;
      endCold();
      release();
      clearAd();
    },
    getDebugState: () => ({ loadedAt, showing, launches, spent }),
  };
}
