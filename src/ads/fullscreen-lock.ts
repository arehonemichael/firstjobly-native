import { ADS_CONFIG } from "./config";

/** Release starts the gap even after a presentation failure. No owner can
 * accidentally release another format's reservation. */
export function createFullscreenLock(
  gapMs = ADS_CONFIG.fullscreenMinGapMs,
  now = Date.now,
) {
  let held: string | null = null;
  let releasedAt: number | null = null;
  return {
    tryAcquire(owner: string) {
      if (held !== null || (releasedAt !== null && now() - releasedAt < gapMs))
        return false;
      held = owner;
      return true;
    },
    release(owner: string) {
      if (held !== owner) return;
      held = null;
      releasedAt = now();
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
