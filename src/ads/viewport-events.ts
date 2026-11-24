/** Coalesce scroll/layout notifications; subscribers exist only on a focused screen. */
export function createAdViewportEvents(
  schedule: (fn: () => void) => () => void,
) {
  const listeners = new Set<() => void>();
  let cancel: (() => void) | null = null;
  return {
    signal() {
      if (!listeners.size || cancel) return;
      cancel = schedule(() => {
        cancel = null;
        for (const fn of listeners) {
          try {
            fn();
          } catch {
            /* A stale native view cannot block other placements. */
          }
        }
      });
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
        if (!listeners.size) {
          cancel?.();
          cancel = null;
        }
      };
    },
  };
}
const viewport = createAdViewportEvents((fn) => {
  const frame = requestAnimationFrame(fn);
  return () => cancelAnimationFrame(frame);
});
export const signalAdViewportChange = viewport.signal;
export const subscribeAdViewportChanges = viewport.subscribe;
