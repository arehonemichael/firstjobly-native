// Optional observers stay outside UI primitives: web/Expo Go need no ad SDK.
let observer: (() => void) | null = null;
export function setInteractionObserver(next: (() => void) | null) {
  observer = next;
}
export function signalUserInteraction() {
  observer?.();
}
