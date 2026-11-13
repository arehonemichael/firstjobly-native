type Ad = {
  load(): void;
  show(): Promise<void>;
  removeAllListeners(): void;
  addAdEventListener(event: string, handler: () => void): () => void;
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
  schedule?: (action: () => void) => () => void;
};
export function createAppOpenController({
  createAd,
  storage,
  now = Date.now,
  minLaunches = 3,
  cooldownMs = 14400000,
  maxAgeMs = 12600000,
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
    if (disposed || !context.consent || ad || showing) return;
    try {
      ad = createAd();
      listeners = [
        ad.addAdEventListener("loaded", () => {
          loadedAt = now();
        }),
        ad.addAdEventListener("closed", () => {
          showing = false;
          clearAd();
          preload();
        }),
        ad.addAdEventListener("error", () => {
          showing = false;
          clearAd();
        }),
      ];
      ad.load();
    } catch {
      clearAd();
      showing = false;
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
      preload();
    } catch {
      launches = 0;
    }
  };
  function onState(next: string) {
    if (disposed) return;
    active = next === "active";
    if (!active) cancel();
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
      away < 1000 ||
      !context.eligible ||
      !context.consent ||
      showing ||
      launches < minLaunches ||
      now() - lastShown < cooldownMs
    ) {
      spent = true;
      preload();
      return;
    }
    if (loadedAt === null || !ad) {
      spent = true;
      preload();
      return;
    }
    if (now() - loadedAt < 0 || now() - loadedAt >= maxAgeMs) {
      spent = true;
      clearAd();
      preload();
      return;
    }
    const inventory = ad,
      foregroundAt = now();
    // A short bounded guard lets foreground URL/navigation/touch events cancel.
    // Only inventory ready at the event is eligible; loading never triggers show.
    cancelPending = schedule(() => {
      cancelPending = null;
      if (
        disposed ||
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
        spent = true;
        return;
      }
      spent = true;
      showing = true;
      loadedAt = null;
      lastShown = now();
      void storage
        .setItem("fj_admob_last_app_open", String(lastShown))
        .catch(() => {});
      try {
        void inventory.show().catch(() => {
          showing = false;
          clearAd();
          preload();
        });
      } catch {
        showing = false;
        clearAd();
        preload();
      }
    });
  }
  return {
    initialize,
    onState,
    markInteraction() {
      interacted = true;
      cancel();
    },
    setContext(next: Context, preloadNow = true) {
      context = next;
      if (!next.eligible || !next.consent) cancel();
      if (!next.consent && !showing) clearAd();
      if (preloadNow) preload();
    },
    dispose() {
      disposed = true;
      clearAd();
    },
    getDebugState: () => ({ loadedAt, showing, launches, spent }),
  };
}
