const DAY = 86400000;
export const REVIEW_POLICY = {
  minAgeMs: 7 * DAY,
  minSessions: 3,
  minActions: 2,
  cooldownMs: 90 * DAY,
  yearMs: 365 * DAY,
  maxYearly: 3,
  pendingMs: 10 * 60000,
} as const;
type Attempt = { at: number; version: string };
type Record = {
  firstSeen: number;
  sessions: number;
  actions: number;
  attempts: Attempt[];
  manualAt: number;
};
export type ReviewPort = {
  supported: boolean;
  version: string;
  now(): number;
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  available(): Promise<boolean>;
  request(guard: () => boolean): Promise<void>;
};
function decode(value: string | null, now: number): Record {
  const fresh = {
    firstSeen: now,
    sessions: 0,
    actions: 0,
    attempts: [],
    manualAt: 0,
  };
  if (!value) return fresh;
  try {
    const r = JSON.parse(value);
    if (
      r.v !== 1 ||
      !Number.isFinite(r.firstSeen) ||
      r.firstSeen < 0 ||
      r.firstSeen > now ||
      !Number.isInteger(r.sessions) ||
      r.sessions < 0 ||
      !Number.isInteger(r.actions) ||
      r.actions < 0 ||
      !Array.isArray(r.attempts) ||
      !Number.isFinite(r.manualAt) ||
      r.manualAt < 0 ||
      r.manualAt > now
    )
      return fresh;
    if (
      r.attempts.some(
        (a: Attempt) =>
          !Number.isFinite(a.at) ||
          a.at < 0 ||
          a.at > now ||
          typeof a.version !== "string",
      )
    )
      return fresh;
    return {
      firstSeen: r.firstSeen,
      sessions: Math.min(r.sessions, 10000),
      actions: Math.min(r.actions, 100),
      attempts: r.attempts.slice(-10),
      manualAt: r.manualAt,
    };
  } catch {
    return fresh;
  }
}
/** Installation-wide counters only. No account IDs, ratings, job IDs or content persist. */
export function createReviewController(port: ReviewPort) {
  let record: Record | null = null,
    writable = true,
    started = false,
    busy = false;
  let lastSessionAt = 0;
  let pendingUntil = 0,
    manualAt = 0,
    epoch = 0;
  let queue = Promise.resolve();
  const seen = new Set<string>();
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        /* Optional UI observers must not block actions. */
      }
    }
  };
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
  async function load() {
    if (!record) {
      try {
        record = decode(await port.read(), port.now());
      } catch {
        writable = false;
        record = decode(null, port.now());
      }
    }
    return record;
  }
  async function persist() {
    if (!writable) return false;
    try {
      await port.write(JSON.stringify({ v: 1, ...record }));
      return true;
    } catch {
      writable = false;
      return false;
    }
  }
  function eligible() {
    if (!record || !writable || !port.supported) return false;
    const now = port.now(),
      history = record.attempts;
    const latest = Math.max(
      manualAt,
      record.manualAt,
      ...history.map((a) => a.at),
    );
    return (
      now >= record.firstSeen &&
      now - record.firstSeen >= REVIEW_POLICY.minAgeMs &&
      record.sessions >= REVIEW_POLICY.minSessions &&
      record.actions >= REVIEW_POLICY.minActions &&
      (!latest || now - latest >= REVIEW_POLICY.cooldownMs) &&
      !history.some((a) => a.version === port.version) &&
      history.filter((a) => now - a.at < REVIEW_POLICY.yearMs).length <
        REVIEW_POLICY.maxYearly
    );
  }
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    hasPending: () => pendingUntil > port.now(),
    clearPending() {
      epoch++;
      pendingUntil = 0;
      emit();
    },
    startSession() {
      if (started || !port.supported) return Promise.resolve();
      started = true;
      lastSessionAt = port.now();
      return serial(async () => {
        const r = await load();
        r.sessions = Math.min(10000, r.sessions + 1);
        await persist();
      });
    },
    resumeSession(awayMs: number) {
      if (
        !port.supported ||
        !started ||
        awayMs < 30 * 60000 ||
        port.now() - lastSessionAt < 30 * 60000
      )
        return Promise.resolve();
      lastSessionAt = port.now();
      epoch++;
      pendingUntil = 0;
      emit();
      return serial(async () => {
        const r = await load();
        r.sessions = Math.min(10000, r.sessions + 1);
        await persist();
      });
    },
    positive(key: string) {
      if (!port.supported || seen.has(key)) return Promise.resolve();
      if (seen.size >= 100) return Promise.resolve();
      seen.add(key);
      const ticket = epoch;
      const occurredAt = port.now();
      return serial(async () => {
        const r = await load();
        r.actions = Math.min(100, r.actions + 1);
        if (
          (await persist()) &&
          ticket === epoch &&
          occurredAt + REVIEW_POLICY.pendingMs > port.now() &&
          eligible()
        ) {
          pendingUntil = occurredAt + REVIEW_POLICY.pendingMs;
          emit();
        }
      });
    },
    manualAttempt() {
      epoch++;
      pendingUntil = 0;
      manualAt = port.now();
      emit();
      // Opening a store is never blocked on storage or native review availability.
      void serial(async () => {
        const r = await load();
        r.manualAt = manualAt;
        await persist();
      });
    },
    async tryRequest(guard: () => boolean) {
      if (busy) return false;
      busy = true;
      const ticket = epoch;
      try {
        return await serial(async () => {
          await load();
          const safe = () =>
            ticket === epoch &&
            pendingUntil > port.now() &&
            eligible() &&
            guard();
          if (!safe()) return false;
          if (!(await port.available())) {
            pendingUntil = 0;
            return false;
          }
          if (!safe()) return false;
          const now = port.now();
          record!.attempts = [
            ...record!.attempts.filter(
              (a) => now - a.at < REVIEW_POLICY.yearMs,
            ),
            { at: now, version: port.version },
          ];
          pendingUntil = 0;
          // Persist intent BEFORE calling the OS: no retry storm when it suppresses UI.
          if (!(await persist()) || ticket !== epoch || !guard()) return false;
          await port.request(() => ticket === epoch && guard());
          return true; // An attempted request, never proof of a rating or visible dialog.
        });
      } catch {
        pendingUntil = 0;
        return false;
      } finally {
        busy = false;
      }
    },
  };
}
