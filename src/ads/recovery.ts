import { adDiagnostics as diag } from "./diagnostics";
/** One recovery clock per placement. Backoff does not reset on rerender. */
export function createAdRecovery(
  backoff: readonly number[],
  retry: () => void,
) {
  let attempt = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    failed() {
      if (disposed || timer !== null) return;
      const delay = backoff[attempt++];
      if (delay === undefined) return;
      timer = setTimeout(() => {
        timer = null;
        retry();
      }, delay);
    },
    loaded() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      attempt = 0;
    },
    reset() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      attempt = 0;
      disposed = false;
    },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

/** A timed-out native promise may still resolve: always destroy its inventory. */
export function loadNativeWithTimeout<T extends { destroy(): void }>(
  request: () => Promise<T>,
  loaded: (ad: T) => void,
  failed: (error?: unknown) => void,
  timeoutMs = 10000,
) {
  let active = true;
  let inventory: T | null = null;
  const fail = (error?: unknown) => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    failed(error);
  };
  const timer = setTimeout(fail, timeoutMs);
  try {
    void request()
      .then((ad) => {
        if (!active) {
          ad.destroy();
          return;
        }
        clearTimeout(timer);
        inventory = ad;
        loaded(ad);
      })
      .catch(fail);
  } catch (error) {
    fail(error);
  }
  return () => {
    active = false;
    clearTimeout(timer);
    inventory?.destroy();
    inventory = null;
  };
}

export function createBannerController(
  backoff: readonly number[],
  changed: (state: {
    generation: number;
    loaded: boolean;
    failed: boolean;
  }) => void,
  placement?: string,
) {
  let state = { generation: 0, loaded: false, failed: false };
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const recovery = createAdRecovery(backoff, () => {
    state = { generation: state.generation + 1, loaded: false, failed: false };
    changed(state);
    startTimeout();
  });
  function fail(generation: number) {
    if (disposed || generation !== state.generation || state.failed) return;
    clear();
    state = { ...state, loaded: false, failed: true };
    changed(state);
    recovery.failed();
  }
  function startTimeout() {
    clear();
    if (!state.loaded && !state.failed) {
      diag.record("load.attempt", {
        format: "banner",
        placement,
        attempt: state.generation + 1,
      });
      timer = setTimeout(() => {
        diag.record("load.failed", {
          format: "banner",
          placement,
          reason: "timeout",
          delayMs: 12000,
        });
        fail(state.generation);
      }, 12000);
    }
  }
  return {
    start() {
      if (disposed) {
        disposed = false;
        recovery.reset();
      }
      startTimeout();
    },
    failed: fail,
    loaded(generation: number) {
      if (disposed || generation !== state.generation || state.failed) return;
      diag.record("loaded", { format: "banner", placement, loaded: true });
      clear();
      recovery.loaded();
      state = { ...state, loaded: true };
      changed(state);
    },
    dispose() {
      disposed = true;
      clear();
      recovery.dispose();
    },
  };
}
