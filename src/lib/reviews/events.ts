const successes = new Set<(key: string) => void>();
const interactions = new Set<() => void>();
export function recordReviewSuccess(key: string) {
  for (const fn of successes) {
    try {
      fn(key);
    } catch {
      /* Never affect the completed action. */
    }
  }
}
export function recordReviewInteraction() {
  for (const fn of interactions) {
    try {
      fn();
    } catch {
      /* Review timing cannot block a tap. */
    }
  }
}
export function subscribeReviewSuccess(fn: (key: string) => void) {
  successes.add(fn);
  return () => {
    successes.delete(fn);
  };
}
export function subscribeReviewInteraction(fn: () => void) {
  interactions.add(fn);
  return () => {
    interactions.delete(fn);
  };
}
