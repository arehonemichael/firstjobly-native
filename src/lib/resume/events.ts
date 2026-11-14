const listeners = new Set<() => void>();
export function subscribeHomeResume(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function refreshResumedHome() {
  for (const listener of listeners) listener();
}
const destinationListeners = new Set<() => void>();
export function subscribeResumeDestination(listener: () => void) {
  destinationListeners.add(listener);
  return () => {
    destinationListeners.delete(listener);
  };
}
export function prioritizeResumeDestination() {
  for (const listener of destinationListeners) listener();
}
