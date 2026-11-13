import { ADS_CONFIG } from "./config";

/** Release starts the gap even after a presentation failure. No owner can
 * accidentally release another format's reservation. */
export function createFullscreenLock(
  gapMs: number = ADS_CONFIG.fullscreenMinGapMs,
  now = Date.now,
) {
  let held: string | null = null;
  let releasedAt: number | null = null;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        /* Coordination observers cannot break existing ads. */
      }
    }
  };
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    tryAcquire(owner: string, requiredGapMs = gapMs) {
      if (
        held !== null ||
        (releasedAt !== null &&
          now() - releasedAt < Math.max(gapMs, requiredGapMs))
      )
        return false;
      held = owner;
      emit();
      return true;
    },
    release(owner: string) {
      if (held !== owner) return;
      held = null;
      releasedAt = now();
      emit();
    },
    isHeld: () => held !== null,
    _reset() {
      held = null;
      releasedAt = null;
    },
  };
}
export const fullscreenLock = createFullscreenLock();
export const { tryAcquire, release, isHeld, _reset } = fullscreenLock;
