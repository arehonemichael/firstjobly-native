// Optional observers stay outside UI primitives: web/Expo Go need no ad SDK.
const listeners = new Set<() => void>();
export function subscribeUserInteraction(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
let observer: (() => void) | null = null;
export function setInteractionObserver(next: (() => void) | null) {
  observer = next;
}
export function signalUserInteraction() {
  observer?.();
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* Optional observers cannot block actions. */
    }
  }
}
