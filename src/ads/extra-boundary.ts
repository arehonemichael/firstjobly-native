export type ExtraSource = "jobs" | "circular-jobs";
const entries = new Map<
  symbol,
  { source: ExtraSource | null; ready: () => boolean; scrolledAt: number }
>();
export function registerExtraBoundary(
  source: ExtraSource | null,
  ready: () => boolean,
  now = Date.now,
) {
  const key = Symbol("extra-boundary");
  entries.set(key, { source, ready, scrolledAt: now() });
  return {
    scroll() {
      const entry = entries.get(key);
      if (entry) entry.scrolledAt = now();
    },
    dispose() {
      entries.delete(key);
    },
  };
}
export function extraBoundaryReady(source: string, now = Date.now) {
  let found = false;
  for (const entry of entries.values()) {
    if (!entry.ready() || now() - entry.scrolledAt < 1000) return false;
    if (entry.source === source) found = true;
  }
  return found;
}
