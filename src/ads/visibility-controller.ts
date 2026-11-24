export type AdRect = { x: number; y: number; width: number; height: number };
/** A small look-ahead permits loading just before scrolling into view, never pages away. */
export function isNearAdViewport(
  rect: AdRect,
  viewport: { width: number; height: number },
  margin = 160,
) {
  return (
    [
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      viewport.width,
      viewport.height,
    ].every(Number.isFinite) &&
    rect.width > 0 &&
    rect.height >= 0 &&
    viewport.width > 0 &&
    viewport.height > 0 &&
    rect.x < viewport.width &&
    rect.x + rect.width > 0 &&
    rect.y < viewport.height + margin &&
    rect.y + Math.max(1, rect.height) > -margin
  );
}
/** Once admitted, keep inventory while scrolling. Blur/background resets admission.
 * No scroll event can show a fullscreen ad or repeatedly reload a native placement. */
export function createAdVisibility() {
  let active = false,
    admitted = false;
  const listeners = new Set<() => void>();
  const publish = (value: boolean) => {
    if (admitted === value) return;
    admitted = value;
    listeners.forEach((fn) => fn());
  };
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => admitted,
    setActive(value: boolean) {
      active = value;
      if (!active) publish(false);
    },
    measure(rect: AdRect, viewport: { width: number; height: number }) {
      if (active && isNearAdViewport(rect, viewport)) publish(true);
    },
  };
}
